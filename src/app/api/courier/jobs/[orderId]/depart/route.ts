import { NextResponse } from "next/server";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { orderId } = await ctx.params;
  const courier = await withDbRetry(() =>
    prisma.courier.findUnique({ where: { userId: session.user.id } }),
  );
  if (!courier) {
    return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
  }

  const order = await withDbRetry(() =>
    prisma.order.findFirst({
      where: { id: orderId, courierId: courier.id },
    }),
  );
  if (!order) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }
  if (!["ASSIGNED", "FULFILLING"].includes(order.status)) {
    return NextResponse.json({ order });
  }

  const updated = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: order.id },
        data: { status: "OUT_FOR_DELIVERY" },
      });
      await tx.deliveryEvent.create({
        data: {
          orderId: order.id,
          status: "OUT_FOR_DELIVERY",
          note: "Livreur en route",
          actorUserId: session.user.id,
        },
      });
      return next;
    }),
  );
  void notifyOrderEvent(order.id, "OUT_FOR_DELIVERY").catch(console.error);
  return NextResponse.json({ order: updated });
}
