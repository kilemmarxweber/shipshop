import { createHash } from "crypto";
import {
  DetectModerationLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import type { MediaModerationDecision, Prisma } from "@/generated/prisma/client";
import { assertChipShopOwner } from "@/lib/kyc";
import { extractVideoJpegFrames } from "@/lib/moderation-frames.server";
import { prisma, withDbRetry } from "@/lib/prisma";

export type ModerationVariant = "product" | "avatar" | "document";
export type MediaKind = "image" | "video";

export type ModerationLabel = { name: string; parent?: string; confidence: number };

export type ScanCategory = "clean" | "suggestive" | "explicit" | "csam" | "error";

export type ScanResult = {
  category: ScanCategory;
  score: number;
  labels: ModerationLabel[];
  error?: string;
};

const EXPLICIT_BAN = 0.9;
const EXPLICIT_STRIKE_BAN = 0.7;
const STRIKE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const CSAM_RE =
  /child|minor|underage|infant|exploitation|pedo|pre-?teen/i;
const EXPLICIT_RE =
  /explicit|sexual.?activity|sex.?toys?|graphic.+(nudity|sexual)|genital|pornograph|exposed.?private|intimate.?parts/i;
const SUGGESTIVE_RE =
  /suggestive|swimwear|underwear|revealing|partial.?nudity|barechested|non-explicit|lingerie/i;

function failClosed() {
  if (process.env.MODERATION_FAIL_CLOSED != null) {
    return process.env.MODERATION_FAIL_CLOSED !== "false";
  }
  return process.env.NODE_ENV === "production";
}

function provider() {
  return (process.env.MODERATION_PROVIDER ?? "rekognition").toLowerCase();
}

function hasAwsCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

/** Sans clés AWS : pas d'appel Rekognition / ffmpeg, upload inchangé. */
function catalogModerationActive() {
  const chosen = provider();
  if (chosen === "none" || chosen === "off") return false;
  return hasAwsCredentials();
}

function contentHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function classifyLabels(labels: ModerationLabel[]): Omit<ScanResult, "labels"> {
  let csam = 0;
  let explicit = 0;
  let suggestive = 0;
  for (const label of labels) {
    const conf = label.confidence;
    const text = `${label.parent ?? ""} ${label.name}`;
    if (CSAM_RE.test(text)) {
      csam = Math.max(csam, conf);
      continue;
    }
    if (/non-explicit/i.test(text) || SUGGESTIVE_RE.test(text)) {
      suggestive = Math.max(suggestive, conf);
      continue;
    }
    if (EXPLICIT_RE.test(text)) {
      explicit = Math.max(explicit, conf);
    }
  }
  if (csam >= 0.5) {
    return { category: "csam", score: csam };
  }
  if (explicit >= 0.5) {
    return { category: "explicit", score: explicit };
  }
  if (suggestive >= 0.5) {
    return { category: "suggestive", score: suggestive };
  }
  return { category: "clean", score: 0 };
}

let rekognition: RekognitionClient | null = null;

function getRekognition() {
  rekognition ??= new RekognitionClient({
    region: process.env.AWS_REGION?.trim() || "eu-west-1",
  });
  return rekognition;
}

async function detectImageLabels(buffer: Buffer): Promise<ModerationLabel[]> {
  const out = await getRekognition().send(
    new DetectModerationLabelsCommand({
      Image: { Bytes: new Uint8Array(buffer) },
      MinConfidence: 50,
    }),
  );
  return (out.ModerationLabels ?? []).map((label) => ({
    name: label.Name ?? "unknown",
    parent: label.ParentName || undefined,
    confidence: (label.Confidence ?? 0) / 100,
  }));
}

async function scanWithRekognition(
  buffer: Buffer,
  kind: MediaKind,
): Promise<ScanResult> {
  try {
    const frames =
      kind === "video" ? await extractVideoJpegFrames(buffer) : [buffer];
    const all: ModerationLabel[] = [];
    for (const frame of frames) {
      all.push(...(await detectImageLabels(frame)));
    }
    const classified = classifyLabels(all);
    return { ...classified, labels: all };
  } catch (error) {
    return {
      category: "error",
      score: 0,
      labels: [],
      error: error instanceof Error ? error.message : "scan failed",
    };
  }
}

export async function scanMediaBuffer(
  buffer: Buffer,
  kind: MediaKind,
): Promise<ScanResult> {
  if (!catalogModerationActive()) {
    return { category: "clean", score: 0, labels: [] };
  }
  return scanWithRekognition(buffer, kind);
}

export async function disableUserForNsfw(
  userId: string,
  reason: "NSFW" | "CSAM",
) {
  const { isOwner } = await assertChipShopOwner(userId);
  if (isOwner) {
    return { skipped: true as const, reason: "platform" };
  }

  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          disabledAt: new Date(),
          disabledReason: reason,
        },
      });
      await tx.session.deleteMany({ where: { userId } });
      const shops = await tx.shop.findMany({
        where: { ownerUserId: userId },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);
      if (shopIds.length) {
        await tx.shop.updateMany({
          where: { id: { in: shopIds } },
          data: { isActive: false },
        });
        await tx.product.updateMany({
          where: { shopId: { in: shopIds }, status: "ACTIVE" },
          data: { status: "HIDDEN" },
        });
      }
    }),
  );
  return { skipped: false as const };
}

export async function reactivateUser(userId: string) {
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          disabledAt: null,
          disabledReason: null,
        },
      });
      await tx.shop.updateMany({
        where: { ownerUserId: userId },
        data: { isActive: true },
      });
    }),
  );
}

export type EnforceResult = {
  allowed: boolean;
  httpStatus: number;
  error: string;
  code: string;
  decision: MediaModerationDecision | "SKIP" | "ERROR";
  banned: boolean;
};

export async function enforceCatalogModeration(opts: {
  userId: string;
  buffer: Buffer;
  kind: MediaKind;
  variant: ModerationVariant;
}): Promise<EnforceResult> {
  const { userId, buffer, kind, variant } = opts;
  if (variant === "document") {
    return {
      allowed: true,
      httpStatus: 200,
      error: "",
      code: "SKIP_DOCUMENT",
      decision: "SKIP",
      banned: false,
    };
  }

  if (!catalogModerationActive()) {
    return {
      allowed: true,
      httpStatus: 200,
      error: "",
      code: "SCAN_SKIPPED",
      decision: "SKIP",
      banned: false,
    };
  }

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { disabledAt: true, nsfwStrikeCount: true },
    }),
  );
  if (user?.disabledAt) {
    return {
      allowed: false,
      httpStatus: 403,
      error: "Compte désactivé — contenu interdit",
      code: "ACCOUNT_DISABLED",
      decision: "BAN",
      banned: true,
    };
  }

  const scan = await scanMediaBuffer(buffer, kind);
  const hash = contentHash(buffer);

  if (scan.category === "error") {
    if (failClosed()) {
      return {
        allowed: false,
        httpStatus: 503,
        error: "Modération indisponible — réessayez plus tard",
        code: "MODERATION_UNAVAILABLE",
        decision: "ERROR",
        banned: false,
      };
    }
    return {
      allowed: true,
      httpStatus: 200,
      error: "",
      code: "SCAN_SKIPPED",
      decision: "SKIP",
      banned: false,
    };
  }

  if (scan.category === "clean" || scan.category === "suggestive") {
    if (scan.category === "suggestive") {
      await logEvent({
        userId,
        variant,
        kind,
        decision: "ALLOW",
        labels: scan.labels,
        score: scan.score,
        contentHash: hash,
      });
    }
    return {
      allowed: true,
      httpStatus: 200,
      error: "",
      code: "ALLOW",
      decision: "ALLOW",
      banned: false,
    };
  }

  if (scan.category === "csam") {
    await logEvent({
      userId,
      variant,
      kind,
      decision: "CSAM_HOLD",
      labels: scan.labels,
      score: scan.score,
      contentHash: hash,
    });
    await disableUserForNsfw(userId, "CSAM");
    return {
      allowed: false,
      httpStatus: 422,
      error: "Média refusé — contenu interdit",
      code: "CSAM_HOLD",
      decision: "CSAM_HOLD",
      banned: true,
    };
  }

  const since = new Date(Date.now() - STRIKE_WINDOW_MS);
  const prior = await withDbRetry(() =>
    prisma.mediaModerationEvent.count({
      where: {
        userId,
        createdAt: { gte: since },
        decision: { in: ["REJECT", "BAN"] },
      },
    }),
  );
  const strikeNumber = prior + 1;
  const immediateBan = scan.score >= EXPLICIT_BAN;
  const secondStrikeBan = scan.score >= EXPLICIT_STRIKE_BAN && strikeNumber >= 2;
  const shouldBan = immediateBan || secondStrikeBan;

  await withDbRetry(() =>
    prisma.user.update({
      where: { id: userId },
      data: { nsfwStrikeCount: { increment: 1 } },
    }),
  );

  const decision: MediaModerationDecision = shouldBan ? "BAN" : "REJECT";
  await logEvent({
    userId,
    variant,
    kind,
    decision,
    labels: scan.labels,
    score: scan.score,
    contentHash: hash,
  });

  if (shouldBan) {
    await disableUserForNsfw(userId, "NSFW");
  }

  return {
    allowed: false,
    httpStatus: 422,
    error: shouldBan
      ? "Compte désactivé — contenu pornographique détecté"
      : "Média refusé — contenu sexuel explicite interdit",
    code: shouldBan ? "ACCOUNT_DISABLED" : "NSFW_REJECTED",
    decision,
    banned: shouldBan,
  };
}

async function logEvent(data: {
  userId: string;
  variant: string;
  kind: string;
  decision: MediaModerationDecision;
  labels: ModerationLabel[];
  score: number;
  contentHash: string;
}) {
  const labels = data.labels as unknown as Prisma.InputJsonValue;
  await withDbRetry(() =>
    prisma.mediaModerationEvent.create({
      data: {
        userId: data.userId,
        variant: data.variant,
        kind: data.kind,
        decision: data.decision,
        labels,
        score: data.score,
        contentHash: data.contentHash,
      },
    }),
  );
}

export function isDisabledUser(user: { disabledAt?: Date | null } | null) {
  return Boolean(user?.disabledAt);
}
