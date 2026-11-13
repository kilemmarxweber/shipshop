import { Prisma } from "@/generated/prisma/client";
import { createAppNotice } from "@/lib/app-notice";
import { deliverMail, isSmtpConfigured } from "@/lib/email/smtp";
import { prisma } from "@/lib/prisma";
import { createHash, randomUUID } from "crypto";

export const LOGIN_FAIL_THRESHOLD = 5;
const LOCK_MINUTES = [15, 30, 60] as const;
const MAX_LOCK_MINUTES = 60;
const IP_FAIL_WINDOW_MS = 15 * 60_000;
const IP_FAIL_MAX = 30;
const IP_MULTI_ACCOUNT_MAX = 8;
const ALERT_DEDUPE_MS = 30 * 60_000;

export function fingerprintSubject(raw: string) {
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
}

export function fingerprintIp(ip: string) {
  return createHash("sha256").update(ip.trim()).digest("hex");
}

/** IP client : ne fait confiance à X-Forwarded-For que si TRUST_PROXY=1. */
export function requestClientIp(input: {
  headers?: Headers | null;
  request?: Request | null;
}) {
  const headers = input.headers ?? input.request?.headers ?? null;
  if (!headers) return "unknown";
  const trustProxy = process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  }
  return "unknown";
}

function lockDurationMs(lockLevel: number) {
  const idx = Math.min(Math.max(lockLevel, 1), LOCK_MINUTES.length) - 1;
  const minutes = LOCK_MINUTES[idx] ?? MAX_LOCK_MINUTES;
  return Math.min(minutes, MAX_LOCK_MINUTES) * 60_000;
}

function isLocked(lockUntil: Date | null | undefined, now = new Date()) {
  return Boolean(lockUntil && lockUntil.getTime() > now.getTime());
}

export type LoginGate = {
  blocked: boolean;
  retryAfterSec?: number;
  reason?: "ACCOUNT_LOCK" | "IP_LOCK";
};

export async function assertLoginAllowed(input: {
  subjectRaw: string;
  ip: string;
}): Promise<LoginGate> {
  const now = new Date();
  const accountKey = fingerprintSubject(input.subjectRaw);
  const ipKey = fingerprintIp(input.ip || "unknown");

  const [account, ipRow] = await Promise.all([
    prisma.loginSecurity.findUnique({
      where: { kind_subjectKey: { kind: "ACCOUNT", subjectKey: accountKey } },
    }),
    prisma.loginSecurity.findUnique({
      where: { kind_subjectKey: { kind: "IP", subjectKey: ipKey } },
    }),
  ]);

  if (isLocked(account?.lockUntil, now)) {
    return {
      blocked: true,
      reason: "ACCOUNT_LOCK",
      retryAfterSec: Math.max(
        1,
        Math.ceil(
          ((account!.lockUntil as Date).getTime() - now.getTime()) / 1000,
        ),
      ),
    };
  }

  if (isLocked(ipRow?.lockUntil, now)) {
    return {
      blocked: true,
      reason: "IP_LOCK",
      retryAfterSec: Math.max(
        1,
        Math.ceil(
          ((ipRow!.lockUntil as Date).getTime() - now.getTime()) / 1000,
        ),
      ),
    };
  }

  return { blocked: false };
}

async function upsertFail(input: {
  kind: "ACCOUNT" | "IP";
  subjectKey: string;
  targetedSubject?: string;
}) {
  const now = new Date();
  const existing = await prisma.loginSecurity.findUnique({
    where: {
      kind_subjectKey: { kind: input.kind, subjectKey: input.subjectKey },
    },
  });

  if (!existing) {
    return prisma.loginSecurity.create({
      data: {
        kind: input.kind,
        subjectKey: input.subjectKey,
        failCount: 1,
        windowStart: now,
        lastAttemptAt: now,
        targetedSubjects: input.targetedSubject
          ? ([input.targetedSubject] as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  // Pendant un blocage : refuser sans prolonger (mise à jour lastAttempt seulement).
  if (isLocked(existing.lockUntil, now)) {
    return prisma.loginSecurity.update({
      where: { id: existing.id },
      data: { lastAttemptAt: now },
    });
  }

  const windowExpired =
    now.getTime() - existing.windowStart.getTime() > IP_FAIL_WINDOW_MS;
  const resetWindow = windowExpired || existing.failCount === 0;

  let failCount = resetWindow ? 1 : existing.failCount + 1;
  let windowStart = resetWindow ? now : existing.windowStart;
  let lockLevel = existing.lockLevel;
  let lockUntil = existing.lockUntil;
  let episodeId = existing.episodeId;
  let targeted = Array.isArray(existing.targetedSubjects)
    ? (existing.targetedSubjects as string[])
    : [];

  if (input.targetedSubject && input.kind === "IP") {
    if (!targeted.includes(input.targetedSubject)) {
      targeted = [...targeted, input.targetedSubject].slice(-40);
    }
  }

  const shouldLockAccount =
    input.kind === "ACCOUNT" && failCount >= LOGIN_FAIL_THRESHOLD;
  const shouldLockIp =
    input.kind === "IP" &&
    (failCount >= IP_FAIL_MAX || targeted.length >= IP_MULTI_ACCOUNT_MAX);

  if (shouldLockAccount || shouldLockIp) {
    // Ne pas prolonger si déjà sous lock ; sinon nouvel épisode.
    if (!isLocked(existing.lockUntil, now)) {
      lockLevel = Math.min(existing.lockLevel + 1, LOCK_MINUTES.length);
      lockUntil = new Date(now.getTime() + lockDurationMs(lockLevel));
      episodeId = randomUUID();
    }
  }

  return prisma.loginSecurity.update({
    where: { id: existing.id },
    data: {
      failCount,
      windowStart,
      lastAttemptAt: now,
      lockLevel,
      lockUntil,
      episodeId,
      targetedSubjects:
        input.kind === "IP" ? (targeted as Prisma.InputJsonValue) : undefined,
    },
  });
}

async function maybeSendSecurityAlert(input: {
  subjectRaw: string;
  ip: string;
  userAgent?: string | null;
  lockUntil: Date | null;
  episodeId: string | null;
  lastAlertAt: Date | null;
}) {
  if (!input.lockUntil || !input.episodeId) return;
  const now = Date.now();
  if (
    input.lastAlertAt &&
    now - input.lastAlertAt.getTime() < ALERT_DEDUPE_MS
  ) {
    return;
  }

  const emailRaw = input.subjectRaw.includes("@")
    ? input.subjectRaw.trim().toLowerCase()
    : null;

  const user = emailRaw
    ? await prisma.user.findUnique({
        where: { email: emailRaw },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          name: true,
        },
      })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { phone: input.subjectRaw },
            { email: input.subjectRaw.trim().toLowerCase() },
          ],
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          name: true,
        },
      });

  if (
    !user?.emailVerified ||
    !user.email ||
    user.email.includes("@phone.local")
  ) {
    return;
  }

  const when = new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Kinshasa",
  });
  const title = "Alerte de sécurité — tentatives de connexion";
  const body = [
    "Nous avons détecté plusieurs tentatives de connexion avec un mot de passe incorrect sur votre compte.",
    "",
    `Date et heure : ${when} (Africa/Kinshasa)`,
    input.userAgent ? `Appareil : ${input.userAgent.slice(0, 160)}` : null,
    input.ip && input.ip !== "unknown" ? `Adresse IP : ${input.ip}` : null,
    "",
    "Par mesure de sécurité, les connexions par mot de passe ont été temporairement limitées.",
    "",
    "Si vous n'êtes pas à l'origine de ces tentatives, changez votre mot de passe depuis ShipShop. Ne communiquez jamais votre mot de passe ni vos codes.",
  ]
    .filter(Boolean)
    .join("\n");

  await createAppNotice({
    userId: user.id,
    title,
    body,
    href: "/auth/forgot-password",
  });

  if (isSmtpConfigured()) {
    try {
      await deliverMail({
        to: user.email,
        subject:
          "Alerte de sécurité — tentative de connexion à votre compte ShipShop",
        text: body,
      });
    } catch (error) {
      console.error("[auth-security] email alert failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  await prisma.loginSecurity.updateMany({
    where: {
      kind: "ACCOUNT",
      subjectKey: fingerprintSubject(input.subjectRaw),
      episodeId: input.episodeId,
    },
    data: { lastAlertAt: new Date() },
  });
}

export async function recordLoginFailure(input: {
  subjectRaw: string;
  ip: string;
  userAgent?: string | null;
}) {
  const accountKey = fingerprintSubject(input.subjectRaw);
  const ipKey = fingerprintIp(input.ip || "unknown");

  const [account] = await Promise.all([
    upsertFail({ kind: "ACCOUNT", subjectKey: accountKey }),
    upsertFail({
      kind: "IP",
      subjectKey: ipKey,
      targetedSubject: accountKey,
    }),
  ]);

  if (
    account.lockUntil &&
    account.failCount >= LOGIN_FAIL_THRESHOLD &&
    account.episodeId
  ) {
    await maybeSendSecurityAlert({
      subjectRaw: input.subjectRaw,
      ip: input.ip,
      userAgent: input.userAgent,
      lockUntil: account.lockUntil,
      episodeId: account.episodeId,
      lastAlertAt: account.lastAlertAt,
    });
  }

  console.info("[auth-security] login_failure", {
    accountKeyPrefix: accountKey.slice(0, 8),
    ipKeyPrefix: ipKey.slice(0, 8),
    failCount: account.failCount,
    locked: isLocked(account.lockUntil),
  });

  return account;
}

export async function recordLoginSuccess(input: {
  subjectRaw: string;
  ip: string;
}) {
  const accountKey = fingerprintSubject(input.subjectRaw);
  const ipKey = fingerprintIp(input.ip || "unknown");
  const now = new Date();

  await Promise.all([
    prisma.loginSecurity.upsert({
      where: { kind_subjectKey: { kind: "ACCOUNT", subjectKey: accountKey } },
      create: {
        kind: "ACCOUNT",
        subjectKey: accountKey,
        failCount: 0,
        lockLevel: 0,
        lockUntil: null,
        episodeId: null,
        lastAttemptAt: now,
        windowStart: now,
      },
      update: {
        failCount: 0,
        lockUntil: null,
        episodeId: null,
        lastAttemptAt: now,
        windowStart: now,
      },
    }),
    // Succès légitime : on ne remet pas à zéro tout le compteur IP (partagée),
    // mais on retire le sujet de la liste ciblée.
    prisma.loginSecurity
      .findUnique({
        where: { kind_subjectKey: { kind: "IP", subjectKey: ipKey } },
      })
      .then(async (row) => {
        if (!row) return;
        const targeted = Array.isArray(row.targetedSubjects)
          ? (row.targetedSubjects as string[]).filter((s) => s !== accountKey)
          : [];
        await prisma.loginSecurity.update({
          where: { id: row.id },
          data: {
            targetedSubjects: targeted as Prisma.InputJsonValue,
            lastAttemptAt: now,
          },
        });
      }),
  ]);

  console.info("[auth-security] login_success", {
    accountKeyPrefix: accountKey.slice(0, 8),
  });
}
