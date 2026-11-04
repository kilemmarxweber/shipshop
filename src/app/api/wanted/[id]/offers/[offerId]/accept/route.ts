import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { matchWantedOffer } from "@/lib/wanted-match";
import { reopenUnpaidWantedMatches } from "@/lib/wanted-timeout";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id, offerId } = await params;
  await reopenUnpaidWantedMatches();

  try {
    const result = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const matched = await matchWantedOffer(tx, {
          requestId: id,
          offerId,
          buyerId: session.user.id,
          paymentRail: "SHIPSHOP",
          fulfillmentIntent: "PICKUP",
        });
        await tx.cartItem.upsert({
          where: {
            userId_productId: {
              userId: session.user.id,
              productId: matched.productId,
            },
          },
          create: {
            userId: session.user.id,
            productId: matched.productId,
          },
          update: {},
        });
        return matched;
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
