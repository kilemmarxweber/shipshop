import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";
import { ensureActiveChallenges } from "@/lib/growth/challenge";
import { packCatalog } from "@/lib/growth/campaign-packs";
import { firstVisualUrl, isProbablyVideo } from "@/lib/growth/challenge-look";

type HighlightProduct = {
  id: string;
  title: string;
  category: string;
  images: string[];
  soundtrack: { audioUrl: string; durationMs?: number } | null;
  soundtrackStartMs?: number;
  shop: {
    name: string;
    logoUrl: string | null;
    owner: { name: string; image: string | null } | null;
  };
  _count: { likes: number };
};

function pickHighlights(products: HighlightProduct[]) {
  const used = new Set<string>();
  const take = (pred: (product: HighlightProduct) => boolean) => {
    const found = products.find(
      (product) =>
        !used.has(product.id) && pred(product) && firstVisualUrl(product.images),
    );
    if (found) used.add(found.id);
    return found ?? null;
  };

  const slots = [
    take(
      (product) =>
        product.images.some(isProbablyVideo) || Boolean(product.soundtrack),
    ),
    take((product) => product.category === "Mode"),
    take((product) => product.category === "Beauté"),
    take(
      (product) =>
        product.category !== "Mode" && product.category !== "Beauté",
    ),
  ].filter((row): row is HighlightProduct => Boolean(row));

  for (const product of products) {
    if (slots.length >= 4) break;
    if (!used.has(product.id) && firstVisualUrl(product.images)) {
      used.add(product.id);
      slots.push(product);
    }
  }
  return slots.slice(0, 4);
}

export async function GET() {
  const session = await getSession();
  const active = await ensureActiveChallenges();
  const challengeIds = active.map((row) => row.id);

  const [doneRows, participantRows, stories, lives, catalog] = await Promise.all([
    session && challengeIds.length
      ? withDbRetry(() =>
          prisma.challengeCompletion.findMany({
            where: {
              userId: session.user.id,
              challengeId: { in: challengeIds },
            },
            select: { challengeId: true },
          }),
        )
      : Promise.resolve([]),
    challengeIds.length
      ? withDbRetry(() =>
          prisma.challengeCompletion.findMany({
            where: { challengeId: { in: challengeIds } },
            orderBy: { createdAt: "desc" },
            take: 40,
            select: {
              challengeId: true,
              user: { select: { name: true, image: true } },
            },
          }),
        )
      : Promise.resolve([]),
    withDbRetry(() =>
      prisma.brandCampaign.findMany({
        where: {
          status: "ACTIVE",
          kind: { in: ["STORY", "CHALLENGE", "FEED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          kind: true,
          objective: true,
          body: true,
          mediaUrl: true,
          ctaUrl: true,
          productId: true,
          category: true,
        },
      }),
    ),
    withDbRetry(() =>
      prisma.creatorLive.findMany({
        where: { status: "LIVE" },
        orderBy: { startedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          startedAt: true,
          giftCents: true,
          user: { select: { id: true, name: true, image: true } },
          product: {
            select: { id: true, title: true, images: true, priceCents: true },
          },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.product.findMany({
        where: {
          status: "ACTIVE",
          wantedRequestId: null,
        },
        orderBy: { createdAt: "desc" },
        take: 28,
        select: {
          id: true,
          title: true,
          category: true,
          images: true,
          soundtrackStartMs: true,
          soundtrack: { select: { audioUrl: true, durationMs: true } },
          shop: {
            select: {
              name: true,
              logoUrl: true,
              owner: { select: { name: true, image: true } },
            },
          },
          _count: { select: { likes: true } },
        },
      }),
    ),
  ]);

  const doneIds = new Set(doneRows.map((row) => row.challengeId));
  const facesByChallenge = new Map<
    string,
    { name: string; image: string | null }[]
  >();
  for (const row of participantRows) {
    const list = facesByChallenge.get(row.challengeId) ?? [];
    if (list.length < 3) {
      list.push({ name: row.user.name, image: row.user.image });
      facesByChallenge.set(row.challengeId, list);
    }
  }

  const open = active.filter((row) => !doneIds.has(row.id));
  const challenges = open.map((challenge) => {
    const coverCandidates = [
      ...catalog.filter((product) => product.category === challenge.category),
      ...catalog.filter((product) => product.category !== challenge.category),
    ]
      .map((product) => firstVisualUrl(product.images))
      .filter((url): url is string => Boolean(url))
      .filter((url, index, all) => all.indexOf(url) === index)
      .slice(0, 4);
    return {
      id: challenge.id,
      title: challenge.title,
      body: challenge.body,
      category: challenge.category,
      city: challenge.city,
      completions: challenge.completions,
      done: false,
      coverUrl: coverCandidates[0] ?? null,
      coverCandidates,
      participants: facesByChallenge.get(challenge.id) ?? [],
    };
  });

  const highlights = pickHighlights(catalog);
  const highlightIds = highlights.map((row) => row.id);
  const viewRows = highlightIds.length
    ? await withDbRetry(() =>
        prisma.productDwell.groupBy({
          by: ["productId"],
          where: { productId: { in: highlightIds } },
          _sum: { viewCount: true },
        }),
      )
    : [];
  const viewsById = new Map(
    viewRows.map((row) => [row.productId, row._sum.viewCount ?? 0]),
  );

  return NextResponse.json({
    challenges,
    challenge: challenges[0] ?? null,
    highlights: highlights.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      imageUrl: firstVisualUrl(row.images),
      images: row.images,
      soundtrack: row.soundtrack,
      soundtrackStartMs: row.soundtrackStartMs,
      hasVideo:
        row.images.some(isProbablyVideo) || Boolean(row.soundtrack?.audioUrl),
      likesCount: row._count.likes,
      viewsCount: viewsById.get(row.id) ?? 0,
      creator: {
        name: row.shop.owner?.name ?? row.shop.name,
        image: row.shop.owner?.image ?? row.shop.logoUrl,
      },
    })),
    stories,
    lives,
    packs: packCatalog(),
  });
}
