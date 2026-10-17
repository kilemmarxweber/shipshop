import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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
    const request = await withDbRetry(() =>
      prisma.wantedRequest.findUnique({
        where: { id },
        include: {
          buyer: { select: { id: true, name: true, image: true } },
          product: { select: { id: true, title: true, priceCents: true } },
          offers: {
            orderBy: { createdAt: "desc" },
            include: {
              seller: { select: { id: true, name: true, image: true } },
              shop: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  lat: true,
                  lng: true,
                  isOccasionStall: true,
                },
              },
            },
          },
        },
      }),
    );
    if (!request) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    const isOwner = session?.user.id === request.buyerId;
    const offers = request.offers.map((o) => ({
      id: o.id,
      priceCents: o.priceCents,
      message: o.message,
      images: o.images,
      condition: o.condition,
      status: o.status,
      createdAt: o.createdAt,
      seller: o.seller,
      shop: o.shop,
      overBudget: o.priceCents > request.budgetCents,
      sellerCommune: o.sellerCommune,
      sellerQuartier: o.sellerQuartier,
      sellerAddress:
        isOwner || o.status === "ACCEPTED" ? o.sellerAddress : null,
      mine: session?.user.id === o.sellerUserId,
    }));

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
    return NextResponse.json({ error: "Demande indisponible" }, { status: 500 });
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
