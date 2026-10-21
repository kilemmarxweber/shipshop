import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCanManageShop } from "@/lib/shop-access";
import { PRISMA_FEATURES, prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { boostPack } from "@/lib/shop-boost";
import { lockWallet } from "@/lib/payments/ledger";
import { drainBucketsData } from "@/lib/wallet-buckets";
import { parseCurrency, walletCents } from "@/lib/money";

const schema = z.object({
  days: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(7),
    z.literal(30),
    z.literal(180),
    z.literal(365),
  ]),
  zone: z
    .object({
      country: z.string().max(80).optional().nullable(),
      city: z.string().max(80).optional().nullable(),
      commune: z.string().max(80).optional().nullable(),
      quartier: z.string().max(80).optional().nullable(),
      avenue: z.string().max(120).optional().nullable(),
    })
    .optional(),
  zones: z
    .array(
      z.object({
        country: z.string().max(80).optional().nullable(),
        city: z.string().max(80).optional().nullable(),
        commune: z.string().max(80).optional().nullable(),
        quartier: z.string().max(80).optional().nullable(),
        avenue: z.string().max(120).optional().nullable(),
      }),
    )
    .max(50)
    .optional(),
});

function cleanPart(value?: string | null) {
  const v = value?.trim();
  return v ? v : null;
}

function isUnknownTargetCityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Unknown argument `targetCity`");
}

function isInsufficientBoostBalance(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Solde insuffisant") ||
    message.includes("Solde du pot insuffisant")
  );
}

type ZoneTarget = {
  targetCity: string | null;
  targetCommune: string | null;
  targetQuartier: string | null;
  targetAvenue: string | null;
};

function normalizeZones(body: z.infer<typeof schema>): ZoneTarget[] {
  const raw = body.zones?.length ? body.zones : body.zone ? [body.zone] : [];
  const mapped = raw.map((z) => {
    const country = cleanPart(z.country);
    const targetCity = cleanPart(z.city);
    const targetCommune = cleanPart(z.commune);
    const targetQuartier = cleanPart(z.quartier);
    const targetAvenue = cleanPart(z.avenue);
    const hasAny =
      Boolean(country) ||
      Boolean(targetCity) ||
      Boolean(targetCommune) ||
      Boolean(targetQuartier) ||
      Boolean(targetAvenue);
    if (!hasAny) return null;
    if (!country || !targetCity) {
      throw new Error("Pays et ville sont obligatoires pour chaque zone boost");
    }
    return {
      country,
      targetCity,
      targetCommune,
      targetQuartier,
      targetAvenue,
    };
  });
  const onlyFilled = mapped.filter((row) => row !== null);
  const unique = new Map<string, ZoneTarget>();
  for (const zone of onlyFilled) {
    const key = [
      zone.country?.toLowerCase() ?? "",
      zone.targetCity?.toLowerCase() ?? "",
      zone.targetCommune?.toLowerCase() ?? "",
      zone.targetQuartier?.toLowerCase() ?? "",
      zone.targetAvenue?.toLowerCase() ?? "",
    ].join("|");
    unique.set(key, {
      targetCity: zone.targetCity,
      targetCommune: zone.targetCommune,
      targetQuartier: zone.targetQuartier,
      targetAvenue: zone.targetAvenue,
    });
  }
  return [...unique.values()];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Payload boost invalide" }, { status: 400 });
  }
  const pack = boostPack(body.days);
  if (!pack) {
    return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  }

  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id },
      select: { id: true, shopId: true, shop: { select: { ownerUserId: true, currency: true } } },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const access = await assertCanManageShop(session.user.id, product.shopId);
  if (!access.ok) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const sellerId = product.shop.ownerUserId;
  if (!sellerId) {
    return NextResponse.json({ error: "Boutique sans vendeur" }, { status: 400 });
  }

  const currency = parseCurrency(product.shop.currency);
  const endsAt = new Date(Date.now() + pack.days * 86_400_000);

  let targetZones: ZoneTarget[];
  try {
    targetZones = normalizeZones(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Zones de boost invalides";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const boostCount = targetZones.length || 1;
  const totalCents = pack.usdCents * boostCount;

  try {
    const boosts = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: sellerId },
        create: { userId: sellerId, balanceCents: 0, currency: "USD" },
        update: {},
      });
      await lockWallet(tx, wallet.id);
      const locked = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!locked) throw new Error("Portefeuille introuvable");
      if (walletCents(locked, currency) < totalCents) {
        throw new Error("Solde vendeur insuffisant pour ShipBoost");
      }
      const next = walletCents(locked, currency) - totalCents;
      await tx.wallet.update({
        where: { id: locked.id },
        data: drainBucketsData(locked, currency, totalCents, [
          "VENDOR",
          "BUYER",
          "COURIER",
        ]),
      });
      await tx.walletTransaction.create({
        data: {
          walletId: locked.id,
          type: "PLATFORM_FEE",
          amountCents: -totalCents,
          currency,
          balanceAfterCents: next,
          provider: "INTERNAL",
          status: "SUCCESS",
          reference: `BOOST-${id.slice(0, 8)}`,
          metadata: {
            productId: id,
            days: pack.days,
            boostCount,
            zones: targetZones,
          },
        },
      });

      const rows = targetZones.length
        ? targetZones
        : [
            {
              targetCity: null,
              targetCommune: null,
              targetQuartier: null,
              targetAvenue: null,
            },
          ];
      try {
        return await Promise.all(
          rows.map((row) =>
            tx.shopBoost.create({
              data: {
                shopId: product.shopId,
                productId: id,
                budgetCents: pack.usdCents,
                currency,
                days: pack.days,
                ...(PRISMA_FEATURES.shopBoostZoneTargeting
                  ? {
                      targetCity: row.targetCity,
                      targetCommune: row.targetCommune,
                      targetQuartier: row.targetQuartier,
                      targetAvenue: row.targetAvenue,
                    }
                  : {}),
                endsAt,
              },
            }),
          ),
        );
      } catch (error) {
        if (!isUnknownTargetCityError(error)) throw error;
        return await Promise.all(
          rows.map(() =>
            tx.shopBoost.create({
              data: {
                shopId: product.shopId,
                productId: id,
                budgetCents: pack.usdCents,
                currency,
                days: pack.days,
                endsAt,
              },
            }),
          ),
        );
      }
    });

    return NextResponse.json({ boosts, boostCount, totalCents });
  } catch (error) {
    if (isInsufficientBoostBalance(error)) {
      return NextResponse.json(
        { error: "Solde vendeur insuffisant pour ShipBoost" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Boost impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
