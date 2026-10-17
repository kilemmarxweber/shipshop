import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id, offerId } = await params;

  try {
    const result = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const request = await tx.wantedRequest.findUnique({
          where: { id },
        });
        if (!request || request.buyerId !== session.user.id) {
          throw new Error("NOT_FOUND");
        }
        if (request.status !== "OPEN") {
          throw new Error("CLOSED");
        }

        const offer = await tx.wantedOffer.findFirst({
          where: { id: offerId, requestId: id, status: "PENDING" },
          include: { shop: true },
        });
        if (!offer) throw new Error("OFFER");

        await tx.wantedOffer.updateMany({
          where: { requestId: id, id: { not: offerId } },
          data: { status: "DECLINED" },
        });

        const snapshot =
          (await tx.product.findUnique({
            where: { wantedRequestId: id },
          })) ??
          (await tx.product.create({
            data: {
              shopId: offer.shopId,
              title: request.title,
              description: [
                request.description,
                request.condition === "USED" ? "Occasion (demande Je cherche)" : "Neuf / magasin (demande Je cherche)",
                offer.sellerAddress ? `Retrait : ${offer.sellerAddress}` : null,
              ]
                .filter(Boolean)
                .join("\n\n"),
              priceCents: offer.priceCents,
              quantity: 1,
              currency: request.currency,
              category: request.category,
              images:
                offer.images.length > 0 ? offer.images : request.images,
              location: offer.sellerAddress ?? request.commune,
              status: "ACTIVE",
              wantedRequestId: id,
            },
          }));

        await tx.wantedOffer.update({
          where: { id: offerId },
          data: { status: "ACCEPTED", productId: snapshot.id },
        });

        await tx.wantedRequest.update({
          where: { id },
          data: {
            status: "MATCHED",
            acceptedOfferId: offerId,
          },
        });

        await tx.cartItem.upsert({
          where: {
            userId_productId: {
              userId: session.user.id,
              productId: snapshot.id,
            },
          },
          create: { userId: session.user.id, productId: snapshot.id },
          update: {},
        });

        await tx.conversation.upsert({
          where: {
            buyerId_shopId: {
              buyerId: session.user.id,
              shopId: offer.shopId,
            },
          },
          create: {
            buyerId: session.user.id,
            shopId: offer.shopId,
            productId: snapshot.id,
            wantedRequestId: id,
          },
          update: {
            productId: snapshot.id,
            wantedRequestId: id,
          },
        });

        return { productId: snapshot.id, shopId: offer.shopId };
      }),
    );

    return NextResponse.json({
      ok: true,
      productId: result.productId,
      shopId: result.shopId,
    });
  } catch (error) {
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
    console.error("[wanted accept]", error);
    return NextResponse.json(
      { error: "Impossible d’accepter cette offre" },
      { status: 500 },
    );
  }
}
