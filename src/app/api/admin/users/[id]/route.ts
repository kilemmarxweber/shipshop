import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { reactivateUser } from "@/lib/moderation.server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().min(2).max(120).optional(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email().optional(),
  }),
  z.object({
    action: z.literal("archive"),
    reason: z.string().min(2).max(500).optional(),
  }),
  z.object({
    action: z.literal("unarchive"),
  }),
]);

/** Owner plateforme : modifier / archiver / réactiver un utilisateur. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id: userId } = await ctx.params;

  try {
    const body = patchSchema.parse(await req.json());
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          disabledAt: true,
        },
      }),
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas modifier votre propre accès ainsi" },
        { status: 400 },
      );
    }

    const targetIsOwner = (await assertChipShopOwner(userId)).isOwner;
    if (targetIsOwner) {
      return NextResponse.json(
        { error: "Impossible d'agir sur un owner / admin plateforme" },
        { status: 403 },
      );
    }

    if (body.action === "update") {
      if (body.email && body.email !== user.email) {
        const taken = await withDbRetry(() =>
          prisma.user.findFirst({
            where: { email: body.email, NOT: { id: userId } },
            select: { id: true },
          }),
        );
        if (taken) {
          return NextResponse.json(
            { error: "Cet e-mail est déjà utilisé" },
            { status: 409 },
          );
        }
      }
      const updated = await withDbRetry(() =>
        prisma.user.update({
          where: { id: userId },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.email !== undefined ? { email: body.email } : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            disabledAt: true,
            disabledReason: true,
          },
        }),
      );
      return NextResponse.json({ ok: true, user: updated });
    }

    if (body.action === "archive") {
      const reason = body.reason?.trim() || "Archivé par l'admin plateforme";
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
        }),
      );
      return NextResponse.json({ ok: true, archived: true });
    }

    if (body.action === "unarchive") {
      await reactivateUser(userId);
      return NextResponse.json({ ok: true, archived: false });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Suppression définitive (refusée si commandes liées). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id: userId } = await ctx.params;

  try {
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 },
      );
    }

    const targetIsOwner = (await assertChipShopOwner(userId)).isOwner;
    if (targetIsOwner) {
      return NextResponse.json(
        { error: "Impossible de supprimer un owner / admin plateforme" },
        { status: 403 },
      );
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          _count: {
            select: { orders: true, ownedShops: true },
          },
        },
      }),
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (user._count.orders > 0) {
      return NextResponse.json(
        {
          error:
            "Ce compte a des commandes — archivez-le plutôt que de le supprimer",
        },
        { status: 409 },
      );
    }
    if (user._count.ownedShops > 0) {
      return NextResponse.json(
        {
          error:
            "Ce compte possède une boutique — gérez-la dans Vendeurs d'abord",
        },
        { status: 409 },
      );
    }

    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.session.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      }),
    );

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
