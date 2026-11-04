import { prisma, withDbRetry } from "@/lib/prisma";

export const WANTED_UNPAID_MS = 30 * 60 * 1000;

export async function reopenUnpaidWantedMatches() {
  try {
    await reopenUnpaidWantedMatchesUnsafe();
  } catch (error) {
    console.error("[wanted timeout]", error);
  }
}

async function reopenUnpaidWantedMatchesUnsafe() {
  const cutoff = new Date(Date.now() - WANTED_UNPAID_MS);
  const stale = await withDbRetry(() =>
    prisma.wantedRequest.findMany({
      where: {
        status: "MATCHED",
        NOT: { paymentRail: "OFF_PLATFORM" },
        AND: [
          {
            OR: [
              { matchedAt: { lt: cutoff } },
              { matchedAt: null, updatedAt: { lt: cutoff } },
            ],
          },
          {
            OR: [
              { product: null },
              {
                product: {
                  orders: {
                    none: {
                      status: { notIn: ["CANCELLED", "REFUNDED", "FAILED"] },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        acceptedOfferId: true,
        product: { select: { id: true } },
      },
      take: 40,
    }),
  );

  for (const row of stale) {
    await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        if (row.acceptedOfferId) {
          await tx.wantedOffer.update({
            where: { id: row.acceptedOfferId },
            data: { status: "PENDING", productId: null },
          });
        }
        if (row.product?.id) {
          await tx.product.update({
            where: { id: row.product.id },
            data: { wantedRequestId: null, status: "DRAFT" },
          });
        }
        await tx.wantedRequest.update({
          where: { id: row.id },
          data: {
            status: "OPEN",
            acceptedOfferId: null,
            paymentRail: null,
            fulfillmentIntent: null,
            matchedAt: null,
            offPlatformWaiverAt: null,
          },
        });
      }),
    );
  }
}
