import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type WantedPaymentRail = "SHIPSHOP" | "OFF_PLATFORM";
export type WantedFulfillmentIntent = "PICKUP" | "DELIVERY" | "SELLER_DROP";

export async function matchWantedOffer(
  tx: Tx,
  input: {
    requestId: string;
    offerId: string;
    buyerId: string;
    paymentRail: WantedPaymentRail;
    fulfillmentIntent: WantedFulfillmentIntent;
    waiver?: boolean;
  },
) {
  const request = await tx.wantedRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request || request.buyerId !== input.buyerId) {
    throw new Error("NOT_FOUND");
  }
  if (request.status !== "OPEN") {
    throw new Error("CLOSED");
  }
  if (input.paymentRail === "OFF_PLATFORM" && !input.waiver) {
    throw new Error("WAIVER");
  }

  const offer = await tx.wantedOffer.findFirst({
    where: {
      id: input.offerId,
      requestId: input.requestId,
      status: "PENDING",
    },
    include: { shop: true },
  });
  if (!offer) throw new Error("OFFER");

  await tx.wantedOffer.updateMany({
    where: { requestId: input.requestId, id: { not: input.offerId } },
    data: { status: "DECLINED" },
  });

  const snapshot =
    (await tx.product.findUnique({
      where: { wantedRequestId: input.requestId },
    })) ??
    (await tx.product.create({
      data: {
        shopId: offer.shopId,
        title: request.title,
        description: [
          request.description,
          request.condition === "USED"
            ? "Occasion (demande Je cherche)"
            : "Neuf / magasin (demande Je cherche)",
          offer.sellerAddress ? `Retrait : ${offer.sellerAddress}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        priceCents: offer.priceCents,
        quantity: 1,
        currency: request.currency,
        category: request.category,
        images: offer.images.length > 0 ? offer.images : request.images,
        location: offer.sellerAddress ?? request.commune,
        status: "ACTIVE",
        wantedRequestId: input.requestId,
      },
    }));

  await tx.wantedOffer.update({
    where: { id: input.offerId },
    data: { status: "ACCEPTED", productId: snapshot.id },
  });

  const now = new Date();
  await tx.wantedRequest.update({
    where: { id: input.requestId },
    data: {
      status: "MATCHED",
      acceptedOfferId: input.offerId,
      paymentRail: input.paymentRail,
      fulfillmentIntent: input.fulfillmentIntent,
      matchedAt: now,
      offPlatformWaiverAt:
        input.paymentRail === "OFF_PLATFORM" ? now : null,
    },
  });

  await tx.conversation.upsert({
    where: {
      buyerId_shopId: {
        buyerId: input.buyerId,
        shopId: offer.shopId,
      },
    },
    create: {
      buyerId: input.buyerId,
      shopId: offer.shopId,
      productId: snapshot.id,
      wantedRequestId: input.requestId,
    },
    update: {
      productId: snapshot.id,
      wantedRequestId: input.requestId,
    },
  });

  return {
    productId: snapshot.id,
    shopId: offer.shopId,
    shopName: offer.shop.name,
  };
}
