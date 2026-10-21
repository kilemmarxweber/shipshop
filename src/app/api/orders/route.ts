import { NextResponse } from "next/server";
import { z } from "zod";
import { isInsufficientFunds, purchaseProduct } from "@/lib/checkout";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { SHOP_HOURS_SELECT } from "@/lib/shop-hours";
import { assertCanManageShop } from "@/lib/shop-access";

const createSchema = z.object({
  productId: z.string().min(1),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  deliveryCity: z.string().max(80).optional().nullable(),
  deliveryAddress: z.string().max(400).optional().nullable(),
  deliveryCommune: z.string().max(120).optional().nullable(),
  deliveryQuartier: z.string().max(120).optional().nullable(),
  deliveryAvenue: z.string().max(120).optional().nullable(),
  deliveryParcelle: z.string().max(40).optional().nullable(),
  deliveryLat: z.number().optional().nullable(),
  deliveryLng: z.number().optional().nullable(),
  contactPhone: z.string().min(10).max(24),
  optionColor: z.string().max(40).optional().nullable(),
  optionSize: z.string().max(20).optional().nullable(),
  attributedCreatorId: z.string().min(1).optional().nullable(),
});

const ACTIVE = [
  "PAID",
  "ASSIGNED",
  "FULFILLING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "AWAITING_CONFIRM",
  "FAILED",
];
const HISTORY = ["DELIVERED", "PICKED_UP", "CANCELLED", "REFUNDED"];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "all";
    const statusFilter = searchParams.get("status") ?? "all";
    const shopId = searchParams.get("shopId");

    let since: Date | undefined;
    const now = Date.now();
    if (period === "7d") since = new Date(now - 7 * 864e5);
    else if (period === "30d") since = new Date(now - 30 * 864e5);
    else if (period === "90d") since = new Date(now - 90 * 864e5);

    const statusWhere =
      statusFilter === "active"
        ? { status: { in: ACTIVE as never[] } }
        : statusFilter === "history"
          ? { status: { in: HISTORY as never[] } }
          : {};

    // Vendor shop filter
    if (shopId) {
      const shop = await withDbRetry(() =>
        prisma.shop.findUnique({ where: { id: shopId } }),
      );
      if (!shop) {
        return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
      }
      const access = await assertCanManageShop(session.user.id, shop.id);
      if (!access.ok) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const orders = await withDbRetry(() =>
        prisma.order.findMany({
          where: {
            shopId,
            ...(since ? { createdAt: { gte: since } } : {}),
            ...statusWhere,
          },
          include: {
            product: {
              select: { id: true, title: true, images: true, status: true },
            },
            shop: {
              select: { id: true, name: true, slug: true, ...SHOP_HOURS_SELECT },
            },
            courier: true,
            pickupReceipt: true,
            handover: {
              select: { id: true, code: true, completedAt: true, qrPayload: true },
            },
            buyer: { select: { id: true, name: true, phone: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 80,
        }),
      );
      return NextResponse.json({ orders });
    }

    const orders = await withDbRetry(() =>
      prisma.order.findMany({
        where: {
          buyerId: session.user.id,
          ...(since ? { createdAt: { gte: since } } : {}),
          ...statusWhere,
        },
        include: {
          product: {
            select: { id: true, title: true, images: true, status: true },
          },
          shop: {
            select: { id: true, name: true, slug: true, ...SHOP_HOURS_SELECT },
          },
          courier: true,
          pickupReceipt: true,
          handover: {
            select: { id: true, code: true, completedAt: true, qrPayload: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    );

    return NextResponse.json({ orders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur commandes";
    console.error("[api/orders GET]", message);
    return NextResponse.json({ error: message, orders: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());

    const result = await withDbRetry(() =>
      prisma.$transaction((tx) =>
        purchaseProduct(
          tx,
          session.user.id,
          body.productId,
          {
            fulfillmentType: body.fulfillmentType,
            deliveryCity: body.deliveryCity,
            deliveryAddress: body.deliveryAddress,
            deliveryCommune: body.deliveryCommune,
            deliveryQuartier: body.deliveryQuartier,
            deliveryAvenue: body.deliveryAvenue,
            deliveryParcelle: body.deliveryParcelle,
            deliveryLat: body.deliveryLat,
            deliveryLng: body.deliveryLng,
            contactPhone: body.contactPhone,
            optionColor: body.optionColor,
            optionSize: body.optionSize,
          },
          { attributedCreatorId: body.attributedCreatorId },
        ),
      ),
    );

    if (result.order) {
      const key =
        result.order.fulfillmentType === "PICKUP"
          ? "PICKUP_READY"
          : result.order.courierId
            ? "COURIER_ASSIGNED"
            : null;
      if (key) void notifyOrderEvent(result.order.id, key).catch(console.error);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isInsufficientFunds(error)) {
      return NextResponse.json(
        {
          error: "Solde insuffisant — rechargez votre portefeuille",
          code: "INSUFFICIENT_FUNDS",
          needed: error.needed ?? 0,
          balance: error.balance ?? 0,
        },
        { status: 402 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Erreur commande";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
