import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import {
  ensureMessagingSetup,
  messagingFormState,
} from "@/lib/messaging/config";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function assertOwner(userId: string, organizationId: string) {
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: { userId, organizationId, role: "owner" },
    }),
  );
  return Boolean(member);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { org, config } = await ensureMessagingSetup();
  const isOwner = await assertOwner(session.user.id, org.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé au owner Chip Shop" }, { status: 403 });
  }

  return NextResponse.json({
    organizationId: org.id,
    config: messagingFormState(config),
  });
}

const patchSchema = z.object({
  whatsappProvider: z.enum(["klambo", "infobip"]).optional(),
  klamboApiKey: z.string().optional().nullable(),
  klamboBaseUrl: z.string().url().optional(),
  klamboDefaultCountry: z.string().min(2).max(2).optional(),
  smsApiKey: z.string().optional().nullable(),
  smsBaseUrl: z.string().url().optional(),
  smsSender: z.string().min(2).max(20).optional(),
  waApiKey: z.string().optional().nullable(),
  waBaseUrl: z.string().url().optional(),
  waFromNumber: z.string().optional().nullable(),
  notifySms: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  brandPrefix: z.string().min(2).max(40).optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { org } = await ensureMessagingSetup();
    if (!(await assertOwner(session.user.id, org.id))) {
      return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
    }

    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = {};

    if (body.whatsappProvider) data.whatsappProvider = body.whatsappProvider;
    if (body.klamboBaseUrl) data.klamboBaseUrl = body.klamboBaseUrl;
    if (body.klamboDefaultCountry)
      data.klamboDefaultCountry = body.klamboDefaultCountry.toUpperCase();
    if (body.smsBaseUrl) data.smsBaseUrl = body.smsBaseUrl;
    if (body.smsSender) data.smsSender = body.smsSender;
    if (body.waBaseUrl) data.waBaseUrl = body.waBaseUrl;
    if (body.waFromNumber !== undefined)
      data.waFromNumber = body.waFromNumber?.trim() || null;
    if (body.notifySms !== undefined) data.notifySms = body.notifySms;
    if (body.notifyWhatsapp !== undefined)
      data.notifyWhatsapp = body.notifyWhatsapp;
    if (body.brandPrefix) data.brandPrefix = body.brandPrefix;

    if (body.klamboApiKey?.trim()) {
      data.klamboApiKeyEnc = encryptSecret(body.klamboApiKey.trim());
    }
    if (body.smsApiKey?.trim()) {
      data.smsApiKeyEnc = encryptSecret(body.smsApiKey.trim());
    }
    if (body.waApiKey?.trim()) {
      data.waApiKeyEnc = encryptSecret(body.waApiKey.trim());
    }

    const config = await withDbRetry(() =>
      prisma.messagingConfig.update({
        where: { organizationId: org.id },
        data,
      }),
    );

    return NextResponse.json({ config: messagingFormState(config) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
