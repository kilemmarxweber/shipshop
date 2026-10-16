import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { reactivateUser } from "@/lib/moderation.server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  const [events, disabled] = await Promise.all([
    withDbRetry(() =>
      prisma.mediaModerationEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              disabledAt: true,
              disabledReason: true,
              nsfwStrikeCount: true,
            },
          },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.user.findMany({
        where: { disabledAt: { not: null } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          disabledAt: true,
          disabledReason: true,
          nsfwStrikeCount: true,
        },
        orderBy: { disabledAt: "desc" },
        take: 50,
      }),
    ),
  ]);

  return NextResponse.json({ events, disabled });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["reactivate"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  try {
    const body = patchSchema.parse(await req.json());
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: body.userId },
        select: { id: true, disabledAt: true },
      }),
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (!user.disabledAt) {
      return NextResponse.json({ error: "Ce compte n'est pas désactivé" }, { status: 409 });
    }
    await reactivateUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }
    throw error;
  }
}
