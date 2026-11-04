import { isInsufficientFunds, purchaseProduct } from "@/lib/checkout";
import { notifyOrderEvent } from "@/lib/messaging/notify";
import {
    beginIdempotentInTx,
    completeIdempotentInTx,
    findIdempotentOp,
    isUniqueConflict,
    snapshotJson,
} from "@/lib/payments/idempotent-op";
import { idempotencyFrom, parseIdempotencyKey } from "@/lib/payments/ledger";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getOrCreateWallet, getSession } from "@/lib/session";
import { createShopHandover } from "@/lib/shop-handover";
import { matchWantedOffer } from "@/lib/wanted-match";
import { reopenUnpaidWantedMatches } from "@/lib/wanted-timeout";
import { NextResponse } from "next/server";
import { z } from "zod";

const coord = z
  .union([z.number(), z.null()])
  .optional()
  .transform((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );

const schema = z.object({
  paymentRail: z.enum(["SHIPSHOP", "OFF_PLATFORM"]),
  fulfillmentType: z.enum(["PICKUP", "DELIVERY", "SELLER_DROP"]),
  waiver: z.boolean().optional(),
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
    .regex(/^\+?[0-9]{8,20}$/, "Téléphone de contact invalide")
    .optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id, offerId } = await params;
  await reopenUnpaidWantedMatches();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const input = parsed.data;
  if (input.paymentRail === "OFF_PLATFORM" && !input.waiver) {
    return NextResponse.json(
      {
        error:
          "Sans paiement ShipShop, pas de preuve ni de remboursement. Cochez l’avertissement.",
      },
      { status: 400 },
    );
  }
  if (input.paymentRail === "SHIPSHOP" && !input.contactPhone) {
    return NextResponse.json(
      { error: "Téléphone de contact obligatoire" },
      { status: 400 },
    );
  }
  if (input.fulfillmentType === "DELIVERY" && !input.deliveryCity?.trim()) {
    return NextResponse.json(
      { error: "Ville de livraison obligatoire" },
      { status: 400 },
    );
  }

  let key = "";
  try {
    if (input.paymentRail === "OFF_PLATFORM") {
      const result = await withDbRetry(() =>
        prisma.$transaction((tx) =>
          matchWantedOffer(tx, {
            requestId: id,
            offerId,
            buyerId: session.user.id,
            paymentRail: "OFF_PLATFORM",
            fulfillmentIntent: input.fulfillmentType,
            waiver: true,
          }),
        ),
      );
      return NextResponse.json({
        ok: true,
        paymentRail: "OFF_PLATFORM",
        shopId: result.shopId,
        productId: result.productId,
      });
    }

    key = idempotencyFrom(req, input.idempotencyKey);
    const clientKey = parseIdempotencyKey(key);
    await getOrCreateWallet(session.user.id);

    const orderFulfillment =
      input.fulfillmentType === "DELIVERY" ? "DELIVERY" : "PICKUP";

    const payload = await prisma.$transaction(
      async (tx) => {
        const began = await beginIdempotentInTx(tx, {
          userId: session.user.id,
          scope: "CHECKOUT",
          key: clientKey,
          requestHash: `${id}:${offerId}:${input.fulfillmentType}`,
          allowHashMismatch: true,
        });
        if (began.replayed && began.replay.response) {
          return began.replay.response as Record<string, unknown>;
        }

        const matched = await matchWantedOffer(tx, {
          requestId: id,
          offerId,
          buyerId: session.user.id,
          paymentRail: "SHIPSHOP",
          fulfillmentIntent: input.fulfillmentType,
        });

        const handover = await createShopHandover(
          tx,
          session.user.id,
          matched.shopId,
        );
        const checkoutId = `wanted:${id}:${offerId}`;
        const purchased = await purchaseProduct(
          tx,
          session.user.id,
          matched.productId,
          {
            fulfillmentType: orderFulfillment,
            deliveryCity: input.deliveryCity,
            deliveryAddress: input.deliveryAddress,
            deliveryCommune: input.deliveryCommune,
            deliveryQuartier: input.deliveryQuartier,
            deliveryAvenue: input.deliveryAvenue,
            deliveryParcelle: input.deliveryParcelle,
            deliveryLat: input.deliveryLat,
            deliveryLng: input.deliveryLng,
            contactPhone: input.contactPhone,
          },
          {
            handoverId: handover.id,
            checkoutId,
            paymentRef: `PAY:${checkoutId}`,
          },
        );

        const fresh = {
          ok: true,
          paymentRail: "SHIPSHOP",
          orderId: purchased.order.id,
          handoverId: handover.id,
          shopId: matched.shopId,
          productId: matched.productId,
          orders: [
            {
              id: purchased.order.id,
              fulfillmentType: purchased.order.fulfillmentType,
              courierId: purchased.order.courierId ?? null,
            },
          ],
          tickets: [
            {
              id: handover.id,
              shopId: matched.shopId,
              shopName: matched.shopName,
              code: handover.code,
              qrPayload: handover.qrPayload,
              orderIds: [purchased.order.id],
              itemCount: 1,
            },
          ],
          balanceCents: purchased.balanceCents,
          count: 1,
        };
        await completeIdempotentInTx(tx, {
          userId: session.user.id,
          scope: "CHECKOUT",
          key: clientKey,
          httpStatus: 201,
          response: snapshotJson(fresh),
        });
        return fresh;
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    const orders = Array.isArray(
      (payload as { orders?: { id: string; fulfillmentType?: string; courierId?: string | null }[] })
        .orders,
    )
      ? (payload as { orders: { id: string; fulfillmentType?: string; courierId?: string | null }[] })
          .orders
      : [];
    for (const order of orders) {
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
        return NextResponse.json(row.response, {
          status: row.httpStatus || 201,
        });
      }
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    if (code === "CLOSED") {
      return NextResponse.json({ error: "Demande déjà close" }, { status: 400 });
    }
    if (code === "OFFER") {
      return NextResponse.json({ error: "Offre indisponible" }, { status: 400 });
    }
    if (code === "WAIVER") {
      return NextResponse.json(
        {
          error:
            "Sans paiement ShipShop, pas de preuve ni de remboursement. Cochez l’avertissement.",
        },
        { status: 400 },
      );
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
    console.error("[wanted checkout]", error);
    const message =
      error instanceof Error && error.message.length < 180
        ? error.message
        : "Paiement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
