import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageShopDelivery,
  requirePlatformDeliveryAdmin,
} from "@/lib/delivery-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(40).optional(),
  address: z.string().min(3).max(240).optional().nullable(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  zoneId: z.string().optional().nullable(),
  shopId: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  archivedAt: z.string().datetime().optional().nullable(),
  archivedReason: z.string().max(240).optional().nullable(),
  companyId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  postnom: z.string().max(80).optional(),
  passportPhotoUrl: z.string().max(500).optional().nullable(),
  idFrontUrl: z.string().max(500).optional().nullable(),
  idBackUrl: z.string().max(500).optional().nullable(),
});

async function assertCourierAccess(userId: string, courierId: string) {
  const courier = await withDbRetry(() =>
    prisma.courier.findUnique({ where: { id: courierId } }),
  );
  if (!courier) {
    return { ok: false as const, status: 404, error: "Livreur introuvable" };
  }
  const platform = await requirePlatformDeliveryAdmin(userId);
  if (platform.ok) return { ok: true as const, courier, platform: true };

  if (!courier.shopId) {
    return {
      ok: false as const,
      status: 403,
      error: "Livreur plateforme — admin uniquement",
    };
  }
  const access = await canManageShopDelivery(userId, courier.shopId);
  if (!access.ok) {
    return { ok: false as const, status: access.status, error: access.error };
  }
  return { ok: true as const, courier, platform: false };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const access = await assertCourierAccess(session.user.id, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = patchSchema.parse(await req.json());
    if (body.shopId !== undefined && body.shopId !== null) {
      const shopAccess = await canManageShopDelivery(
        session.user.id,
        body.shopId,
      );
      if (!shopAccess.ok) {
        return NextResponse.json(
          { error: shopAccess.error },
          { status: shopAccess.status },
        );
      }
    }

    const courier = await withDbRetry(() =>
      prisma.courier.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
          ...(body.address !== undefined
            ? {
                address:
                  body.address === null ? null : body.address.trim() || null,
              }
            : {}),
          ...(body.lat !== undefined ? { lat: body.lat } : {}),
          ...(body.lng !== undefined ? { lng: body.lng } : {}),
          ...(body.zoneId !== undefined ? { zoneId: body.zoneId } : {}),
          ...(body.shopId !== undefined ? { shopId: body.shopId } : {}),
          ...(body.isAvailable !== undefined
            ? { isAvailable: body.isAvailable }
            : {}),
          ...(body.archivedAt !== undefined
            ? {
                archivedAt: body.archivedAt ? new Date(body.archivedAt) : null,
                isAvailable: body.archivedAt ? false : undefined,
              }
            : {}),
          ...(body.archivedReason !== undefined
            ? { archivedReason: body.archivedReason }
            : {}),
          ...(body.companyId !== undefined ? { companyId: body.companyId } : {}),
          ...(body.userId !== undefined ? { userId: body.userId } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.postnom !== undefined ? { postnom: body.postnom } : {}),
          ...(body.passportPhotoUrl !== undefined
            ? { passportPhotoUrl: body.passportPhotoUrl }
            : {}),
          ...(body.idFrontUrl !== undefined ? { idFrontUrl: body.idFrontUrl } : {}),
          ...(body.idBackUrl !== undefined ? { idBackUrl: body.idBackUrl } : {}),
        },
        include: {
          zone: { select: { id: true, commune: true, kind: true } },
          shop: { select: { id: true, name: true, slug: true } },
        },
      }),
    );
    return NextResponse.json({ courier });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const access = await assertCourierAccess(session.user.id, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    await withDbRetry(() => prisma.courier.delete({ where: { id } }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
