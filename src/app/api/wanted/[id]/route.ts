import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { reopenUnpaidWantedMatches } from "@/lib/wanted-timeout";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["CANCELLED"]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;

  try {
    await reopenUnpaidWantedMatches();
    const request = await withDbRetry(() =>
      prisma.wantedRequest.findUnique({
        where: { id },
        include: {
          buyer: { select: { id: true, name: true, image: true } },
          product: { select: { id: true, title: true, priceCents: true } },
          offers: {
            orderBy: { updatedAt: "desc" },
            include: {
              seller: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  sellerKyc: { select: { status: true } },
                },
              },
              shop: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  lat: true,
                  lng: true,
                  isOccasionStall: true,
                  owner: {
                    select: { sellerKyc: { select: { status: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    );
    if (!request) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 },
      );
    }

    const isOwner = session?.user.id === request.buyerId;
    const offers = request.offers.map((o) => {
      const mine = session?.user.id === o.sellerUserId;
      const showContacts = isOwner || o.status === "ACCEPTED" || mine;
      const kycApproved =
        o.seller.sellerKyc?.status === "APPROVED" ||
        o.shop.owner?.sellerKyc?.status === "APPROVED";
      return {
        id: o.id,
        priceCents: o.priceCents,
        message: o.message,
        images: o.images,
        condition: o.condition,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        seller: {
          id: o.seller.id,
          name: o.seller.name,
          image: o.seller.image,
        },
        shop: {
          id: o.shop.id,
          name: o.shop.name,
          slug: o.shop.slug,
          lat: o.shop.lat,
          lng: o.shop.lng,
          isOccasionStall: o.shop.isOccasionStall,
        },
        kycApproved,
        overBudget: o.priceCents > request.budgetCents,
        sellerPhone: showContacts ? o.sellerPhone : null,
        sellerCommune: showContacts ? o.sellerCommune : o.sellerCommune,
        sellerQuartier: showContacts ? o.sellerQuartier : null,
        sellerAddress: showContacts ? o.sellerAddress : null,
        sellerLat: showContacts ? o.sellerLat : null,
        sellerLng: showContacts ? o.sellerLng : null,
        mine,
      };
    });

    const catalog = await withDbRetry(() =>
      prisma.product.findMany({
        where: {
          status: "ACTIVE",
          wantedRequestId: null,
          category: request.category,
        },
        select: {
          id: true,
          title: true,
          priceCents: true,
          images: true,
          shop: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    );

    return NextResponse.json({
      request: {
        ...request,
        offers,
        isOwner,
      },
      catalog,
    });
  } catch (error) {
    console.error("[wanted GET id]", error);
    return NextResponse.json(
      { error: "Demande indisponible" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const request = await withDbRetry(() =>
    prisma.wantedRequest.findUnique({ where: { id } }),
  );
  if (!request || request.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (request.status !== "OPEN") {
    return NextResponse.json({ error: "Demande déjà close" }, { status: 400 });
  }

  const updated = await withDbRetry(() =>
    prisma.wantedRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),
  );
  return NextResponse.json({ request: updated });
}
