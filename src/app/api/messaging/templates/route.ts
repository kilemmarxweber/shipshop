import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureMessagingSetup } from "@/lib/messaging/config";
import { DELIVERY_EVENT_KEYS } from "@/lib/messaging/templates";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function assertOwner(userId: string, organizationId: string) {
  return Boolean(
    await withDbRetry(() =>
      prisma.member.findFirst({
        where: { userId, organizationId, role: "owner" },
      }),
    ),
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { org } = await ensureMessagingSetup();
  if (!(await assertOwner(session.user.id, org.id))) {
    return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
  }

  const templates = await withDbRetry(() =>
    prisma.messageTemplate.findMany({
      where: { organizationId: org.id },
      orderBy: [{ eventKey: "asc" }, { channel: "asc" }],
    }),
  );

  return NextResponse.json({
    templates,
    eventKeys: DELIVERY_EVENT_KEYS,
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
    if (!(await assertOwner(session.user.id, org.id))) {
      return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
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
