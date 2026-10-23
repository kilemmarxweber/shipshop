import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureActiveChallenges } from "../src/lib/growth/challenge";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function main() {
  const catalog = await ensureActiveChallenges();
  console.log(`Catalogue auto actif: ${catalog.length} challenge(s)`);

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    take: 4,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      images: true,
      priceCents: true,
      currency: true,
      category: true,
      shop: { select: { name: true } },
    },
  });

  const now = new Date();
  const extras: Array<{
    title: string;
    body: string;
    category: string | null;
    city: string;
    hours: number;
    productFocus: "none" | "catalog" | "teaser";
    productId?: string | null;
    productTeaser?: {
      title: string;
      image?: string | null;
      priceCents?: number | null;
      currency?: string | null;
      shopName?: string | null;
      note?: string | null;
    } | null;
  }> = [
    {
      title: "Test · Flash Kinshasa",
      body: "Challenge de test — regarde 2 produits locaux et like ton favori.",
      category: "Mode",
      city: "Kinshasa",
      hours: 48,
      productFocus: "none",
    },
    {
      title: "Test · Story Beauté",
      body: "Challenge de test — commente ton rituel beauté du jour.",
      category: "Beauté",
      city: "Kinshasa",
      hours: 24,
      productFocus: "none",
    },
    {
      title: "Test · Teaser sneakers",
      body: "Aperçu exclusif — like et commente si tu veux ce drop.",
      category: "Mode",
      city: "Kinshasa",
      hours: 36,
      productFocus: "teaser",
      productTeaser: {
        title: "Sneakers ShipDrop X",
        image: products[0]?.images?.[0] ?? null,
        priceCents: 6500,
        currency: "USD",
        shopName: "ShipShop Lab",
        note: "Teaser test — pas encore en catalogue",
      },
    },
  ];

  if (products[0]) {
    const p = products[0];
    extras.push({
      title: `Test · Catalogue · ${p.title}`.slice(0, 120),
      body:
        (p.description?.trim()
          ? `Découvre « ${p.title} » — ${p.description.trim().slice(0, 180)}`
          : `Découvre « ${p.title} », like et commente ton avis.`
        ).slice(0, 400),
      category: p.category,
      city: "Kinshasa",
      hours: 48,
      productFocus: "catalog",
      productId: p.id,
    });
  }

  if (products[1]) {
    const p = products[1];
    extras.push({
      title: `Test · Coup de cœur · ${p.title}`.slice(0, 120),
      body: `Challenge test — visite la fiche « ${p.title} » et partage ton avis.`,
      category: p.category,
      city: "Lubumbashi",
      hours: 72,
      productFocus: "catalog",
      productId: p.id,
    });
  }

  const created = [];
  const refreshed = [];
  for (const row of extras) {
    const existing = await prisma.dailyChallenge.findFirst({
      where: {
        title: row.title,
        endsAt: { gt: now },
      },
      select: { id: true, title: true },
    });
    if (existing) {
      // Remonte en tête du feed (orderBy startsAt desc) + prolonge la fenêtre
      const challenge = await prisma.dailyChallenge.update({
        where: { id: existing.id },
        data: {
          body: row.body,
          category: row.category,
          city: row.city,
          startsAt: now,
          endsAt: hoursFromNow(row.hours),
          productFocus: row.productFocus,
          productId: row.productId ?? null,
          productTeaser: row.productTeaser ?? undefined,
        },
        select: {
          id: true,
          title: true,
          productFocus: true,
          endsAt: true,
        },
      });
      refreshed.push(challenge);
      console.log(
        `Rafraîchi: ${challenge.title} [${challenge.productFocus}] → ${challenge.id}`,
      );
      continue;
    }
    const challenge = await prisma.dailyChallenge.create({
      data: {
        title: row.title,
        body: row.body,
        category: row.category,
        city: row.city,
        startsAt: now,
        endsAt: hoursFromNow(row.hours),
        productFocus: row.productFocus,
        productId: row.productId ?? null,
        productTeaser: row.productTeaser ?? undefined,
      },
      select: {
        id: true,
        title: true,
        productFocus: true,
        endsAt: true,
      },
    });
    created.push(challenge);
    console.log(
      `Créé: ${challenge.title} [${challenge.productFocus}] → ${challenge.id}`,
    );
  }

  const active = await prisma.dailyChallenge.findMany({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      category: true,
      productFocus: true,
      completions: true,
      endsAt: true,
    },
  });

  console.log("\n=== Challenges actifs ===");
  for (const c of active) {
    console.log(
      `- ${c.title} | ${c.category ?? "—"} | focus=${c.productFocus} | ends ${c.endsAt.toISOString()}`,
    );
  }
  console.log(
    `\nTotal actifs: ${active.length} (nouveaux: ${created.length}, rafraîchis: ${refreshed.length})`,
  );
  console.log(
    "→ Recharge /discover (ou Community) — GET /api/growth/surface doit lister les « Test · ».",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
