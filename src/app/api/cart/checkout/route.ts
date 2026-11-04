import { isInsufficientFunds, purchaseProduct } from "@/lib/checkout";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import { walletEquivalentCents } from "@/lib/money";
import {
    cartCheckoutFingerprint,
    checkoutPaymentId,
    findCompletedCheckout,
    lockBuyerCheckout,
    refundDuplicateCheckouts,
} from "@/lib/payments/checkout-guard";
import {
    beginIdempotentInTx,
    completeIdempotentInTx,
    findIdempotentOp,
    isUniqueConflict,
    snapshotJson,
} from "@/lib/payments/idempotent-op";
import { idempotencyFrom, parseIdempotencyKey } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";
import { quoteShipping } from "@/lib/shipping";
import { createShopHandover } from "@/lib/shop-handover";
import { NextResponse } from "next/server";
import { z } from "zod";

const coord = z
  .union([z.number(), z.null()])
  .optional()
  .transform((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );

const schema = z.object({
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  deliveryCity: z.string().max(80).optional().nullable(),
  deliveryAddress: z.string().max(400).optional().nullable(),
  deliveryCommune: z.string().max(120).optional().nullable(),
  deliveryQuartier: z.string().max(120).optional().nullable(),
  deliveryAvenue: z.string().max(120).optional().nullable(),
  deliveryParcelle: z.string().max(40).optional().nullable(),
  deliveryLat: coord,
  deliveryLng: coord,
  contactPhone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .regex(/^\+?[0-9]{8,20}$/, "Téléphone de contact invalide"),
  attributedCreatorId: z.string().min(1).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

type CheckoutPayload = {
  orders: {
    id: string;
    fulfillmentType: string;
    courierId?: string | null;
  }[];
  tickets: unknown[];
  balanceCents: number;
  count: number;
  checkoutId?: string;
  replayed?: boolean;
};

function issuePath(issue: { path?: unknown }) {
  const path = issue.path;
  if (Array.isArray(path)) return path.map(String);
  if (typeof path === "string") return [path];
  return [];
}

function publicCheckoutError(error: unknown) {
  const issues =
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: { path?: unknown }[] }).issues)
      ? (error as { issues: { path?: unknown }[] }).issues
      : null;
  if (issues?.length) {
    const phone = issues.some((issue) =>
      issuePath(issue).includes("contactPhone"),
    );
    return phone
      ? "Téléphone de contact invalide"
      : "Données de paiement invalides";
  }
  const prismaCode =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (prismaCode === "P2002") {
    return "Paiement déjà enregistré — vérifie tes commandes";
  }
  if (prismaCode === "P2003") {
    return "Commande incomplète — réessaie";
  }
  if (prismaCode === "P2021") {
    return "Le paiement n’a pas pu s’enregistrer — réessaie";
  }
  if (prismaCode === "P2028" || prismaCode === "P2034") {
    return "Le paiement a pris trop de temps — réessaie";
  }
  const message = error instanceof Error ? error.message.trim() : "";
  if (message === "Auto-achat interdit") {
    return "Tu ne peux pas acheter un produit de ta propre boutique";
  }
  if (/solde du pot insuffisant|solde insuffisant/i.test(message)) {
    return "Solde insuffisant — rechargez votre portefeuille";
  }
  if (/transaction is aborted|25P02|can't execute/i.test(message)) {
    return "Écriture base interrompue — réessaie le paiement";
  }
  if (
    message &&
    message.length < 180 &&
    !/turbopack|__next|internal server error|Invalid `|ECONN|circular|prepared statement|08P01|bind message|at \w+ \(/i.test(
      message,
    )
  ) {
    return message;
  }
  console.error("[checkout]", prismaCode || message || error);
  return "Paiement impossible — réessaie dans un instant";
}

function asPayload(value: unknown): CheckoutPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as CheckoutPayload;
  if (!Array.isArray(row.orders)) return null;
  return row;
}

/** Achats : solde ShipShop uniquement. CinetPay = dépôt / retrait. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let key = "";
  let checkoutId = "";
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: publicCheckoutError(parsed.error) },
        { status: 400 },
      );
    }
    const fulfillment = parsed.data;
    key = idempotencyFrom(req, fulfillment.idempotencyKey);
    const clientKey = parseIdempotencyKey(key);

    await getOrCreateWallet(session.user.id);

    if (fulfillment.fulfillmentType === "DELIVERY") {
      const preview = await prisma.cartItem.findMany({
        where: { userId: session.user.id },
        select: { product: { select: { shopId: true } } },
      });
      const shops = [...new Set(preview.map((item) => item.product.shopId))];
      for (const shopId of shops) {
        await quoteShipping({
          shopId,
          city: fulfillment.deliveryCity,
          commune: fulfillment.deliveryCommune,
          lat: fulfillment.deliveryLat,
          lng: fulfillment.deliveryLng,
        });
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await lockBuyerCheckout(tx, session.user.id);

        const cartItems = await tx.cartItem.findMany({
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
        });

        const cartHash = cartItems.length
          ? cartCheckoutFingerprint(
              session.user.id,
              cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            )
          : "";
        checkoutId = cartHash ? checkoutPaymentId(cartHash) : "";

        const prior = await findCompletedCheckout(tx, {
          userId: session.user.id,
          key: cartItems.length === 0 ? clientKey : undefined,
          cartHash: cartHash || undefined,
        });
        if (prior?.status === "COMPLETED" && prior.response) {
          await tx.cartItem.deleteMany({ where: { userId: session.user.id } });
          const replayed = asPayload(prior.response);
          return {
            ...(replayed ?? {
              orders: [],
              tickets: [],
              balanceCents: 0,
              count: 0,
            }),
            replayed: true,
          };
        }

        if (cartItems.length === 0) {
          throw new Error("Panier vide");
        }

        const unavailable = cartItems.filter(
          (item) =>
            item.product.status !== "ACTIVE" ||
            item.product.quantity <= 0 ||
            item.product.quantity < Math.max(1, item.quantity),
        );
        if (unavailable.length > 0) {
          throw new Error("Certains produits ne sont plus disponibles");
        }

        const wallet = await tx.wallet.findUnique({
          where: { userId: session.user.id },
        });
        if (!wallet) throw new Error("Portefeuille introuvable");
        const priced = cartItems.filter((item) => item.product.priceCents > 0);
        const haveUsd = walletEquivalentCents(wallet, "USD");
        if (priced.length > 0 && haveUsd <= 0) {
          const err = new Error("Solde insuffisant") as Error & {
            code: "INSUFFICIENT_FUNDS";
            needed: number;
            balance: number;
          };
          err.code = "INSUFFICIENT_FUNDS";
          err.needed =
            priced[0].product.priceCents * Math.max(1, priced[0].quantity);
          err.balance = 0;
          throw err;
        }

        const byShop = new Map<string, typeof cartItems>();
        for (const item of cartItems) {
          const list = byShop.get(item.product.shopId) ?? [];
          list.push(item);
          byShop.set(item.product.shopId, list);
        }

        const chargeKey = `cart:${cartHash.slice(0, 48)}`;
        const began = await beginIdempotentInTx(tx, {
          userId: session.user.id,
          scope: "CHECKOUT",
          key: chargeKey,
          requestHash: cartHash,
          allowHashMismatch: true,
        });
        if (began.replayed) {
          await tx.cartItem.deleteMany({ where: { userId: session.user.id } });
          const replayed = asPayload(began.replay.response);
          if (replayed) return { ...replayed, replayed: true };
        }

        const orders: CheckoutPayload["orders"] = [];
        const tickets = [];
        let balanceCents = wallet.balanceCents;
        let unit = 0;
        for (const [shopId, items] of byShop) {
          const handover = await createShopHandover(
            tx,
            session.user.id,
            shopId,
          );
          let first = true;
          const ticketOrderIds: string[] = [];
          for (const item of items) {
            const units = Math.max(1, item.quantity);
            for (let i = 0; i < units; i++) {
              unit += 1;
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
                  checkoutId,
                  paymentRef: `PAY:${checkoutId}:${item.productId}:${unit}`,
                },
              );
              orders.push({
                id: purchased.order.id,
                fulfillmentType: purchased.order.fulfillmentType,
                courierId: purchased.order.courierId ?? null,
              });
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
        await tx.cartItem.deleteMany({ where: { userId: session.user.id } });
        const fresh: CheckoutPayload = {
          orders,
          tickets,
          balanceCents,
          count: orders.length,
          checkoutId,
          replayed: false,
        };
        await completeIdempotentInTx(tx, {
          userId: session.user.id,
          scope: "CHECKOUT",
          key: chargeKey,
          httpStatus: 201,
          response: fresh,
        });
        if (clientKey !== chargeKey) {
          await tx.idempotentOperation.upsert({
            where: {
              userId_scope_clientKey: {
                userId: session.user.id,
                scope: "CHECKOUT",
                clientKey,
              },
            },
            create: {
              userId: session.user.id,
              scope: "CHECKOUT",
              clientKey,
              requestHash: cartHash,
              status: "COMPLETED",
              httpStatus: 201,
              response: snapshotJson(fresh),
            },
            update: {
              requestHash: cartHash,
              status: "COMPLETED",
              httpStatus: 201,
              response: snapshotJson(fresh),
            },
          });
        }
        return fresh;
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    const payload = asPayload(result);
    if (!payload) {
      return NextResponse.json({ error: "Panier vide" }, { status: 400 });
    }

    if (payload.checkoutId || checkoutId) {
      void refundDuplicateCheckouts(
        session.user.id,
        payload.checkoutId || checkoutId,
      ).catch(console.error);
    }

    for (const order of payload.orders ?? []) {
      const eventKey =
        order.fulfillmentType === "PICKUP"
          ? "PICKUP_READY"
          : order.courierId
            ? "COURIER_ASSIGNED"
            : null;
      if (eventKey)
        void notifyOrderEvent(order.id, eventKey).catch(console.error);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error) && key) {
      const row = await findIdempotentOp({
        userId: session.user.id,
        scope: "CHECKOUT",
        key,
      });
      if (row?.status === "COMPLETED" && row.response) {
        await prisma.cartItem.deleteMany({
          where: { userId: session.user.id },
        });
        return NextResponse.json(row.response, {
          status: row.httpStatus || 201,
        });
      }
    }
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
    const message = publicCheckoutError(error);
    if (message === "Paiement déjà enregistré") {
      const row = key
        ? await findIdempotentOp({
            userId: session.user.id,
            scope: "CHECKOUT",
            key,
          })
        : null;
      if (row?.status === "COMPLETED" && row.response) {
        await prisma.cartItem.deleteMany({
          where: { userId: session.user.id },
        });
        return NextResponse.json(row.response, { status: 201 });
      }
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
