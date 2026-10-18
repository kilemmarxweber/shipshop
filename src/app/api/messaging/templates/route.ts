import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { ensureMessagingSetup } from "@/lib/messaging/config";
import { ALL_EVENT_KEYS } from "@/lib/messaging/templates";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { org } = await ensureMessagingSetup();
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  const templates = await withDbRetry(() =>
    prisma.messageTemplate.findMany({
      where: { organizationId: org.id },
      orderBy: [{ eventKey: "asc" }, { channel: "asc" }],
    }),
  );

  return NextResponse.json({
    templates,
    eventKeys: ALL_EVENT_KEYS,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(80).optional(),
  body: z.string().min(10).max(2000).optional(),
  isActive: z.boolean().optional(),
  infobipTemplateName: z.string().max(120).optional().nullable(),
  infobipLanguage: z.string().max(10).optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { org } = await ensureMessagingSetup();
    const { isOwner } = await assertChipShopOwner(session.user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Réservé à l'owner ou à un admin Chip Shop" },
        { status: 403 },
      );
    }

    const body = patchSchema.parse(await req.json());
    const existing = await withDbRetry(() =>
      prisma.messageTemplate.findFirst({
        where: { id: body.id, organizationId: org.id },
      }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
    }

    const template = await withDbRetry(() =>
      prisma.messageTemplate.update({
        where: { id: body.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.body ? { body: body.body } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.infobipTemplateName !== undefined
            ? { infobipTemplateName: body.infobipTemplateName }
            : {}),
          ...(body.infobipLanguage
            ? { infobipLanguage: body.infobipLanguage }
            : {}),
        },
      }),
    );

    return NextResponse.json({ template });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
