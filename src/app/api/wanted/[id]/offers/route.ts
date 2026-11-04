import { composeAddress } from "@/lib/address";
import { createAppNotice } from "@/lib/app-notice";
import { assertKycApproved, resolveOfferShop } from "@/lib/occasion-shop";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const offerSchema = z.object({
  priceCents: z.number().int().min(100),
  message: z.string().trim().max(1000).optional().nullable(),
  images: z.array(z.string().min(1)).max(8).default([]),
  shopId: z.string().min(1).optional().nullable(),
  commune: z.string().trim().max(80).optional().nullable(),
  quartier: z.string().trim().max(80).optional().nullable(),
  avenue: z.string().trim().max(80).optional().nullable(),
  parcelle: z.string().trim().max(40).optional().nullable(),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
  phone: z.string().min(10).max(24),
});

export async function POST(
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
  const parsed = offerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const request = await withDbRetry(() =>
    prisma.wantedRequest.findUnique({ where: { id } }),
  );
  if (!request || request.status !== "OPEN") {
    return NextResponse.json(
      { error: "Cette demande n’est plus ouverte" },
      { status: 400 },
    );
  }
  if (request.buyerId === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas répondre à votre propre demande" },
      { status: 400 },
    );
  }

  if (request.condition === "NEW_SHOP") {
    try {
      await assertKycApproved(session.user.id);
    } catch (error) {
      if (error instanceof Error && error.message === "KYC_REQUIRED") {
        return NextResponse.json(
          {
            error: "Validez votre KYC pour proposer un article neuf",
            code: "KYC_REQUIRED",
          },
          { status: 403 },
        );
      }
      throw error;
    }
  }

  const phoneParts = splitPhone(parsed.data.phone);
  const sellerPhone = composePhone(phoneParts.dial, phoneParts.national);
  if (!isValidContactPhone(sellerPhone)) {
    return NextResponse.json(
      { error: "Indiquez un téléphone de contact avec l’indicatif pays" },
      { status: 400 },
    );
  }

  try {
    const shop = await resolveOfferShop({
      userId: session.user.id,
      userName: session.user.name ?? "Client",
      condition: request.condition,
      shopId: parsed.data.shopId,
      location: {
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        city: request.city,
        commune: parsed.data.commune,
        quartier: parsed.data.quartier,
        avenue: parsed.data.avenue,
        parcelle: parsed.data.parcelle,
      },
    });

    const sellerAddress = composeAddress({
      city: request.city || "Kinshasa",
      commune: parsed.data.commune,
      quartier: parsed.data.quartier,
      avenue: parsed.data.avenue,
      parcelle: parsed.data.parcelle,
    });

    const offer = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const row = await tx.wantedOffer.upsert({
          where: {
            requestId_sellerUserId: {
              requestId: id,
              sellerUserId: session.user.id,
            },
          },
          create: {
            requestId: id,
            sellerUserId: session.user.id,
            shopId: shop.id,
            message: parsed.data.message?.trim() || null,
            priceCents: parsed.data.priceCents,
            images: parsed.data.images,
            condition: request.condition,
            sellerPhone,
            sellerAddress,
            sellerCommune: parsed.data.commune?.trim() || null,
            sellerQuartier: parsed.data.quartier?.trim() || null,
            sellerAvenue: parsed.data.avenue?.trim() || null,
            sellerLat: parsed.data.lat ?? shop.lat,
            sellerLng: parsed.data.lng ?? shop.lng,
          },
          update: {
            shopId: shop.id,
            message: parsed.data.message?.trim() || null,
            priceCents: parsed.data.priceCents,
            images: parsed.data.images,
            sellerPhone,
            sellerAddress,
            sellerCommune: parsed.data.commune?.trim() || null,
            sellerQuartier: parsed.data.quartier?.trim() || null,
            sellerAvenue: parsed.data.avenue?.trim() || null,
            sellerLat: parsed.data.lat ?? shop.lat,
            sellerLng: parsed.data.lng ?? shop.lng,
            status: "PENDING",
          },
        });
        await tx.wantedRequest.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
        return row;
      }),
    );

    try {
      await createAppNotice({
        userId: request.buyerId,
        title: "Nouvelle offre sur votre recherche",
        body: `${session.user.name ?? "Un membre"} a répondu à « ${request.title} ».`,
        href: `/wanted/${id}`,
      });
    } catch (noticeError) {
      console.error("[wanted offer notice]", noticeError);
    }

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible d’envoyer l’offre";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
