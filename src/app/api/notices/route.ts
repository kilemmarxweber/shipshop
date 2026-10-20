import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const stored =
    typeof prisma.appNotice?.findMany === "function"
      ? await withDbRetry(() =>
          prisma.appNotice.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 30,
          }),
        )
      : [];

  const pending = await withDbRetry(() =>
    prisma.order.findMany({
      where: {
        buyerId: session.user.id,
        status: {
          in: [
            "PAID",
            "ASSIGNED",
            "FULFILLING",
            "OUT_FOR_DELIVERY",
            "READY_FOR_PICKUP",
            "AWAITING_CONFIRM",
          ],
        },
      },
      include: {
        product: { select: { title: true, images: true } },
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  );

  const pendingNotices = pending.map((order) => ({
    id: `order-${order.id}`,
    title:
      order.status === "AWAITING_CONFIRM"
        ? "Confirmer la réception"
        : order.status === "OUT_FOR_DELIVERY"
          ? "Livreur en route"
          : order.status === "READY_FOR_PICKUP"
            ? "Prêt au retrait"
            : "Colis en cours",
    body: `${order.shop.name} · ${order.product.title}`,
    href: `/orders/${order.id}`,
    readAt: null as Date | null,
    createdAt: order.createdAt,
    orderId: order.id,
    status: order.status,
    product: order.product,
    shop: order.shop,
  }));

  const seen = new Set(pendingNotices.map((n) => n.href));
  const notices = [
    ...pendingNotices,
    ...stored.filter((n) => !n.href || !seen.has(n.href)),
  ];
  const unread = notices.filter((n) => !n.readAt).length;
  return NextResponse.json({ notices, unread });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length) {
    await withDbRetry(() =>
      prisma.appNotice.updateMany({
        where: { userId: session.user.id, id: { in: ids } },
        data: { readAt: new Date() },
      }),
    );
  }
  return NextResponse.json({ ok: true });
}
