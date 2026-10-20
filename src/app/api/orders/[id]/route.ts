import { NextResponse } from "next/server";
import { cancelOrder } from "@/lib/checkout";
import { canStaffShop } from "@/lib/shop-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function canViewOrder(userId: string, orderId: string) {
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        shop: true,
        courier: true,
        pickupReceipt: true,
        handover: {
          include: {
            orders: {
              include: {
                product: { select: { title: true, images: true } },
                pickupReceipt: {
                  select: { scannedAt: true, redeemedAt: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        zone: true,
        deliveryEvents: {
          orderBy: { createdAt: "asc" },
          include: { actor: { select: { id: true, name: true } } },
        },
        buyer: { select: { id: true, name: true, phone: true, email: true } },
      },
    }),
  );
  if (!order) return null;
  if (order.buyerId === userId) return order;
  if (order.courier?.userId === userId) return order;
  if (await canStaffShop(userId, order.shopId)) return order;
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const order = await canViewOrder(session.user.id, id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await withDbRetry(() =>
      prisma.$transaction((tx) => cancelOrder(tx, session.user.id, id)),
    );
    return NextResponse.json({
      order: result.order,
      balanceCents: result.balanceCents,
      refundCents: result.refundCents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Annulation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
