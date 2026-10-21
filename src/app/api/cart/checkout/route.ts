import { NextResponse } from "next/server";
import { z } from "zod";
import { isInsufficientFunds, purchaseProduct } from "@/lib/checkout";
import { createShopHandover } from "@/lib/shop-handover";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { quoteShipping } from "@/lib/shipping";
import {
  fromUsdCents,
  parseCurrency,
  shopFxRates,
  usdCentsNeeded,
  walletEquivalentCents,
  walletUsdCents,
} from "@/lib/money";

const schema = z.object({
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
  attributedCreatorId: z.string().min(1).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const fulfillment = schema.parse(await req.json());

    const cartItems = await withDbRetry(() =>
      prisma.cartItem.findMany({
        where: { userId: session.user.id },
        include: {
          product: {
            select: {
              id: true,
              priceCents: true,
              currency: true,
              status: true,
              shopId: true,
              quantity: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  fxCdfPerUsd: true,
                  fxKwPerUsd: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    );

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "Panier vide" }, { status: 400 });
    }

    const unavailable = cartItems.filter(
      (item) =>
        item.product.status !== "ACTIVE" ||
        item.product.quantity < Math.max(1, item.quantity),
    );
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: "Certains produits ne sont plus disponibles",
          productIds: unavailable.map((i) => i.productId),
        },
        { status: 400 },
      );
    }

    const byShop = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const list = byShop.get(item.product.shopId) ?? [];
      list.push(item);
      byShop.set(item.product.shopId, list);
    }

    const shopShipping = new Map<string, number>();
    let neededUsd = 0;
    let displayCurrency = "USD";
    let checkFx = shopFxRates(cartItems[0]?.product.shop);
    for (const [shopId, items] of byShop) {
      let shipping = 0;
      if (fulfillment.fulfillmentType === "DELIVERY") {
        const quote = await quoteShipping({
          shopId,
          city: fulfillment.deliveryCity,
          commune: fulfillment.deliveryCommune,
          lat: fulfillment.deliveryLat,
          lng: fulfillment.deliveryLng,
        });
        shipping = quote.shippingCents;
      }
      shopShipping.set(shopId, shipping);
      for (const item of items) {
        const code = parseCurrency(item.product.currency);
        const itemFx = shopFxRates(item.product.shop);
        checkFx = itemFx;
        displayCurrency = code;
        neededUsd += usdCentsNeeded(
          item.product.priceCents * Math.max(1, item.quantity),
          code,
          itemFx,
        );
      }
      const first = items[0];
      if (first && shipping > 0) {
        neededUsd += usdCentsNeeded(
          shipping,
          parseCurrency(first.product.currency),
          shopFxRates(first.product.shop),
        );
      }
    }

    const wallet = await withDbRetry(() =>
      prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    );
    if (!wallet) {
      return NextResponse.json(
        { error: "Portefeuille introuvable" },
        { status: 400 },
      );
    }
    const usdBalance = walletUsdCents(wallet, checkFx);
    const hasPricedItems = cartItems.some((item) => item.product.priceCents > 0);
    if (usdBalance < neededUsd || (usdBalance <= 0 && hasPricedItems)) {
      return NextResponse.json(
        {
          error: "Solde insuffisant — rechargez votre portefeuille",
          code: "INSUFFICIENT_FUNDS",
          needed: fromUsdCents(
            Math.max(neededUsd, 1),
            displayCurrency,
            checkFx,
          ),
          balance: walletEquivalentCents(wallet, displayCurrency, checkFx),
          currency: displayCurrency,
        },
        { status: 402 },
      );
    }

    const result = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const orders = [];
        const tickets = [];
        let balanceCents = wallet.balanceCents;
        for (const [shopId, items] of byShop) {
          const handover = await createShopHandover(tx, session.user.id, shopId);
          let first = true;
          const ticketOrderIds: string[] = [];
          for (const item of items) {
            const units = Math.max(1, item.quantity);
            for (let i = 0; i < units; i++) {
              const purchased = await purchaseProduct(
                tx,
                session.user.id,
                item.productId,
                fulfillment,
                {
                  handoverId: handover.id,
                  skipShippingQuote: !first,
                  shippingCents: 0,
                  attributedCreatorId: fulfillment.attributedCreatorId,
                },
              );
              orders.push(purchased.order);
              ticketOrderIds.push(purchased.order.id);
              balanceCents = purchased.balanceCents;
              first = false;
            }
          }
          tickets.push({
            id: handover.id,
            shopId,
            shopName: items[0]?.product.shop.name ?? "",
            code: handover.code,
            qrPayload: handover.qrPayload,
            orderIds: ticketOrderIds,
            itemCount: items.length,
          });
        }
        return { orders, tickets, balanceCents, count: orders.length };
      }),
    );

    for (const order of result.orders) {
      const key =
        order.fulfillmentType === "PICKUP"
          ? "PICKUP_READY"
          : order.courierId
            ? "COURIER_ASSIGNED"
            : null;
      if (key) void notifyOrderEvent(order.id, key).catch(console.error);
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
      error instanceof Error ? error.message : "Paiement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
