import { NextResponse } from "next/server";
import { z } from "zod";
import { isInsufficientFunds, purchaseProduct } from "@/lib/checkout";
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
              shop: { select: { fxCdfPerUsd: true, fxKwPerUsd: true } },
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
      (item) => item.product.status !== "ACTIVE" || item.product.quantity < 1,
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

    let neededUsd = 0;
    let displayCurrency = "USD";
    let checkFx = shopFxRates(cartItems[0]?.product.shop);
    for (const item of cartItems) {
      let shipping = 0;
      if (fulfillment.fulfillmentType === "DELIVERY") {
        const quote = await quoteShipping({
          shopId: item.product.shopId,
          city: fulfillment.deliveryCity,
          commune: fulfillment.deliveryCommune,
          lat: fulfillment.deliveryLat,
          lng: fulfillment.deliveryLng,
        });
        shipping = quote.shippingCents;
      }
      const code = parseCurrency(item.product.currency);
      const itemFx = shopFxRates(item.product.shop);
      checkFx = itemFx;
      displayCurrency = code;
      neededUsd += usdCentsNeeded(
        item.product.priceCents + shipping,
        code,
        itemFx,
      );
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
    if (walletUsdCents(wallet, checkFx) < neededUsd) {
      return NextResponse.json(
        {
          error: "Solde insuffisant",
          code: "INSUFFICIENT_FUNDS",
          needed: fromUsdCents(neededUsd, displayCurrency, checkFx),
          balance: walletEquivalentCents(wallet, displayCurrency, checkFx),
          currency: displayCurrency,
        },
        { status: 402 },
      );
    }

    const result = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const orders = [];
        let balanceCents = wallet.balanceCents;
        for (const item of cartItems) {
          const purchased = await purchaseProduct(
            tx,
            session.user.id,
            item.productId,
            fulfillment,
          );
          orders.push(purchased.order);
          balanceCents = purchased.balanceCents;
        }
        return { orders, balanceCents, count: orders.length };
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
          error: error.message,
          code: "INSUFFICIENT_FUNDS",
          needed: error.needed,
          balance: error.balance,
        },
        { status: 402 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Paiement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
