import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { WANTED_OPEN_LIMIT, wantedExpiresAt } from "@/lib/wanted";

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  images: z.array(z.string().min(1)).max(12).default([]),
  category: z.enum(categoryIds),
  budgetCents: z.number().int().min(100),
  currency: z.string().min(3).max(8).default("USD"),
  condition: z.enum(["NEW_SHOP", "USED"]),
  city: z.string().trim().max(80).optional(),
  commune: z.string().trim().max(80).optional().nullable(),
  quartier: z.string().trim().max(80).optional().nullable(),
  avenue: z.string().trim().max(80).optional().nullable(),
});

const listSelect = {
  id: true,
  title: true,
  description: true,
  images: true,
  category: true,
  budgetCents: true,
  currency: true,
  condition: true,
  city: true,
  commune: true,
  quartier: true,
  avenue: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  buyer: { select: { id: true, name: true, image: true } },
  _count: { select: { offers: true } },
} as const;

export async function GET(req: Request) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "1";
  const category = searchParams.get("category");
  const condition = searchParams.get("condition");

  try {
    await withDbRetry(() =>
      prisma.wantedRequest.updateMany({
        where: { status: "OPEN", expiresAt: { lt: new Date() } },
        data: { status: "EXPIRED" },
      }),
    );

    if (mine) {
      if (!session) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
      const requests = await withDbRetry(() =>
        prisma.wantedRequest.findMany({
          where: { buyerId: session.user.id },
          select: listSelect,
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      );
      return NextResponse.json({ requests });
    }

    const requests = await withDbRetry(() =>
      prisma.wantedRequest.findMany({
        where: {
          status: "OPEN",
          expiresAt: { gt: new Date() },
          ...(category ? { category } : {}),
          ...(condition === "NEW_SHOP" || condition === "USED"
            ? { condition }
            : {}),
        },
        select: listSelect,
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    );
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("[wanted GET]", error);
    return NextResponse.json(
      { error: "Demandes indisponibles" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  try {
    const openCount = await withDbRetry(() =>
      prisma.wantedRequest.count({
        where: { buyerId: session.user.id, status: "OPEN" },
      }),
    );
    if (openCount >= WANTED_OPEN_LIMIT) {
      return NextResponse.json(
        {
          error: `Maximum ${WANTED_OPEN_LIMIT} demandes ouvertes — clôturez-en une d’abord`,
        },
        { status: 400 },
      );
    }

    const request = await withDbRetry(() =>
      prisma.wantedRequest.create({
        data: {
          buyerId: session.user.id,
          title: parsed.data.title,
          description: parsed.data.description?.trim() || null,
          images: parsed.data.images,
          category: parsed.data.category,
          budgetCents: parsed.data.budgetCents,
          currency: parsed.data.currency,
          condition: parsed.data.condition,
          city: parsed.data.city?.trim() || "Kinshasa",
          commune: parsed.data.commune?.trim() || null,
          quartier: parsed.data.quartier?.trim() || null,
          avenue: parsed.data.avenue?.trim() || null,
          expiresAt: wantedExpiresAt(),
        },
        select: listSelect,
      }),
    );

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error("[wanted POST]", error);
    return NextResponse.json(
      { error: "Impossible de publier la demande" },
      { status: 500 },
    );
  }
}
