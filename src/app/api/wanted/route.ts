import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import {
  decodeTimeIdCursor,
  pageFromRows,
  parseListLimit,
  PUBLIC_PAGE_SIZE,
  timeIdCursorWhere,
} from "@/lib/list-cursor";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  WANTED_BATCH_MAX,
  WANTED_OPEN_LIMIT,
  wantedExpiresAt,
} from "@/lib/wanted";

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];

const itemSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  images: z.array(z.string().min(1)).max(12).default([]),
  category: z.enum(categoryIds),
  budgetCents: z.number().int().min(100),
  currency: z.string().min(3).max(8).default("USD"),
  condition: z.enum(["NEW_SHOP", "USED"]),
});

const placeSchema = z.object({
  city: z.string().trim().max(80).optional(),
  commune: z.string().trim().max(80).optional().nullable(),
  quartier: z.string().trim().max(80).optional().nullable(),
  avenue: z.string().trim().max(80).optional().nullable(),
});

const createSchema = itemSchema.merge(placeSchema);

const createManySchema = placeSchema.extend({
  items: z.array(itemSchema).min(1).max(WANTED_BATCH_MAX),
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

    const cursorRaw = searchParams.get("cursor");
    const paginated = searchParams.has("limit") || Boolean(cursorRaw);
    const limit = paginated
      ? parseListLimit(searchParams.get("limit"), PUBLIC_PAGE_SIZE)
      : 80;
    const cursor = decodeTimeIdCursor(cursorRaw);

    const fetched = await withDbRetry(() =>
      prisma.wantedRequest.findMany({
        where: {
          status: "OPEN",
          expiresAt: { gt: new Date() },
          ...(category ? { category } : {}),
          ...(condition === "NEW_SHOP" || condition === "USED"
            ? { condition }
            : {}),
          ...(cursor ? timeIdCursorWhere(cursor) : {}),
        },
        select: listSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const sliced = pageFromRows(fetched, limit);
    return NextResponse.json({
      requests: sliced.page,
      nextCursor: sliced.nextCursor,
    });
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

  const many = createManySchema.safeParse(body);
  const single = createSchema.safeParse(body);
  const items = many.success
    ? many.data.items
    : single.success
      ? [single.data]
      : null;
  const place = many.success ? many.data : single.success ? single.data : null;
  if (!items || !place) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  try {
    const openCount = await withDbRetry(() =>
      prisma.wantedRequest.count({
        where: { buyerId: session.user.id, status: "OPEN" },
      }),
    );
    if (openCount + items.length > WANTED_OPEN_LIMIT) {
      return NextResponse.json(
        {
          error: `Maximum ${WANTED_OPEN_LIMIT} demandes ouvertes — clôturez-en avant d’en ajouter ${items.length}`,
        },
        { status: 400 },
      );
    }

    const expiresAt = wantedExpiresAt();
    const city = place.city?.trim() || "Kinshasa";
    const commune = place.commune?.trim() || null;
    const quartier = place.quartier?.trim() || null;
    const avenue = place.avenue?.trim() || null;

    const requests = await withDbRetry(() =>
      prisma.$transaction(
        items.map((item) =>
          prisma.wantedRequest.create({
            data: {
              buyerId: session.user.id,
              title: item.title,
              description: item.description?.trim() || null,
              images: item.images,
              category: item.category,
              budgetCents: item.budgetCents,
              currency: item.currency,
              condition: item.condition,
              city,
              commune,
              quartier,
              avenue,
              expiresAt,
            },
            select: listSelect,
          }),
        ),
      ),
    );

    return NextResponse.json(
      { request: requests[0], requests },
      { status: 201 },
    );
  } catch (error) {
    console.error("[wanted POST]", error);
    return NextResponse.json(
      { error: "Impossible de publier la demande" },
      { status: 500 },
    );
  }
}
