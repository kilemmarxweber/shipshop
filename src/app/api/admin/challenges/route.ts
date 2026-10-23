import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/session";
import {
  CHALLENGE_CATALOG,
  ensureActiveChallenges,
} from "@/lib/growth/challenge";
import {
  challengeTeaserSchema,
  isChallengeProductFocus,
  type ChallengeProductFocus,
} from "@/lib/growth/challenge-product";
import { challengeSpotlightSchema } from "@/lib/growth/challenge-spotlight";

function endsInHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

const productInclude = {
  product: {
    select: {
      id: true,
      title: true,
      description: true,
      images: true,
      priceCents: true,
      currency: true,
      category: true,
      status: true,
      shop: { select: { name: true } },
    },
  },
} as const;

async function resolveProduct(productId: string | null | undefined) {
  if (!productId) return null;
  return withDbRetry(() =>
    prisma.product.findFirst({
      where: { id: productId, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        images: true,
      },
    }),
  );
}

function fillFromProduct(
  product: {
    title: string;
    description: string | null;
    category: string;
  },
  overrides: { title?: string; body?: string; category?: string | null },
) {
  const title =
    (overrides.title ?? "").trim() ||
    `Challenge · ${product.title}`.slice(0, 120);
  const desc = (product.description ?? "").trim();
  const body =
    (overrides.body ?? "").trim() ||
    (desc
      ? `Découvre « ${product.title} » — ${desc.slice(0, 220)}`.slice(0, 400)
      : `Découvre « ${product.title} », like et commente ton avis.`);
  const category =
    overrides.category !== undefined && overrides.category !== null
      ? overrides.category.trim() || null
      : product.category;
  return { title, body, category };
}

function fillFromTeaser(
  teaser: z.infer<typeof challengeTeaserSchema>,
  overrides: { title?: string; body?: string },
) {
  const title =
    (overrides.title ?? "").trim() ||
    `Challenge · ${teaser.title}`.slice(0, 120);
  const note = (teaser.note ?? "").trim();
  const body =
    (overrides.body ?? "").trim() ||
    (note
      ? `Aperçu « ${teaser.title} » — ${note}`.slice(0, 400)
      : `Aperçu « ${teaser.title} » — bientôt en boutique. Like et commente.`);
  return { title, body };
}

const createSchema = z.object({
  title: z.string().max(120).optional(),
  body: z.string().max(400).optional(),
  category: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  hours: z.number().int().min(1).max(168).optional(),
  productFocus: z.enum(["none", "catalog", "teaser"]).optional(),
  productId: z.string().optional().nullable(),
  productTeaser: challengeTeaserSchema.optional().nullable(),
  spotlight: challengeSpotlightSchema.optional().nullable(),
  sponsorCampaignId: z.string().optional().nullable(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(120).optional(),
  body: z.string().min(4).max(400).optional(),
  category: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  productFocus: z.enum(["none", "catalog", "teaser"]).optional(),
  productId: z.string().optional().nullable(),
  productTeaser: challengeTeaserSchema.optional().nullable(),
  spotlight: challengeSpotlightSchema.optional().nullable(),
  endNow: z.boolean().optional(),
  reactivate: z.boolean().optional(),
  hours: z.number().int().min(1).max(168).optional(),
});

async function resolveFocusPayload(input: {
  productFocus?: ChallengeProductFocus;
  productId?: string | null;
  productTeaser?: z.infer<typeof challengeTeaserSchema> | null;
  title?: string;
  body?: string;
  category?: string | null;
  fillCopy?: boolean;
}) {
  let focus: ChallengeProductFocus =
    input.productFocus ??
    (input.productId
      ? "catalog"
      : input.productTeaser
        ? "teaser"
        : "none");

  if (!isChallengeProductFocus(focus)) focus = "none";

  if (focus === "catalog") {
    const product = await resolveProduct(input.productId);
    if (!product) {
      return {
        error: "Produit catalogue requis (publié / ACTIVE)" as const,
      };
    }
    const copy = input.fillCopy
      ? fillFromProduct(product, {
          title: input.title,
          body: input.body,
          category: input.category,
        })
      : null;
    return {
      focus: "catalog" as const,
      productId: product.id,
      productTeaser: null,
      product,
      copy,
    };
  }

  if (focus === "teaser") {
    const teaserParsed = challengeTeaserSchema.safeParse(input.productTeaser);
    if (!teaserParsed.success) {
      return {
        error:
          "Teaser invalide — nom du produit non enregistré requis" as const,
      };
    }
    const copy = input.fillCopy
      ? fillFromTeaser(teaserParsed.data, {
          title: input.title,
          body: input.body,
        })
      : null;
    return {
      focus: "teaser" as const,
      productId: null,
      productTeaser: teaserParsed.data,
      product: null,
      copy,
    };
  }

  return {
    focus: "none" as const,
    productId: null,
    productTeaser: null,
    product: null,
    copy: null,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const now = new Date();
  const [active, recent] = await Promise.all([
    withDbRetry(() =>
      prisma.dailyChallenge.findMany({
        where: { startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        take: 40,
        include: productInclude,
      }),
    ),
    withDbRetry(() =>
      prisma.dailyChallenge.findMany({
        where: { endsAt: { lte: now } },
        orderBy: { endsAt: "desc" },
        take: 20,
        include: productInclude,
      }),
    ),
  ]);

  return NextResponse.json({
    active,
    recent,
    catalog: CHALLENGE_CATALOG,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (json.action === "seed_catalog") {
    const challenges = await ensureActiveChallenges();
    return NextResponse.json({ challenges, ok: true });
  }

  const parsed = createSchema.parse(json);
  const resolved = await resolveFocusPayload({
    productFocus: parsed.productFocus,
    productId: parsed.productId,
    productTeaser: parsed.productTeaser,
    title: parsed.title,
    body: parsed.body,
    category: parsed.category,
    fillCopy: true,
  });
  if ("error" in resolved && resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  let title = (parsed.title ?? "").trim();
  let body = (parsed.body ?? "").trim();
  let category =
    parsed.category !== undefined ? parsed.category?.trim() || null : null;

  if (resolved.copy) {
    title = resolved.copy.title;
    body = resolved.copy.body;
    if ("category" in resolved.copy && resolved.copy.category !== undefined) {
      category = resolved.copy.category;
    }
  }

  if (title.length < 2 || body.length < 4) {
    return NextResponse.json(
      {
        error:
          "Titre et texte requis — ou choisissez un produit catalogue / teaser",
      },
      { status: 400 },
    );
  }

  const hours = parsed.hours ?? 24;
  const challenge = await withDbRetry(() =>
    prisma.dailyChallenge.create({
      data: {
        title,
        body,
        category,
        city: parsed.city?.trim() || "Kinshasa",
        startsAt: new Date(),
        endsAt: endsInHours(hours),
        productFocus: resolved.focus,
        productId: resolved.productId,
        productTeaser:
          resolved.productTeaser === null
            ? Prisma.DbNull
            : resolved.productTeaser,
        spotlight:
          parsed.spotlight === null
            ? Prisma.DbNull
            : parsed.spotlight === undefined
              ? undefined
              : parsed.spotlight,
        sponsorCampaignId: parsed.sponsorCampaignId || null,
      },
      include: productInclude,
    }),
  );
  return NextResponse.json({ challenge });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = patchSchema.parse(await req.json());
  const hours = body.hours ?? 24;
  const data: {
    title?: string;
    body?: string;
    category?: string | null;
    city?: string | null;
    productFocus?: string;
    productId?: string | null;
    productTeaser?: Prisma.InputJsonValue | typeof Prisma.DbNull;
    spotlight?: Prisma.InputJsonValue | typeof Prisma.DbNull;
    startsAt?: Date;
    endsAt?: Date;
  } = {};

  if (body.spotlight !== undefined) {
    data.spotlight =
      body.spotlight === null ? Prisma.DbNull : body.spotlight;
  }

  const touchFocus =
    body.productFocus !== undefined ||
    body.productId !== undefined ||
    body.productTeaser !== undefined;

  if (touchFocus) {
    const existing = await withDbRetry(() =>
      prisma.dailyChallenge.findUnique({
        where: { id: body.id },
        select: {
          productFocus: true,
          productId: true,
          productTeaser: true,
        },
      }),
    );
    const resolved = await resolveFocusPayload({
      productFocus:
        body.productFocus ??
        (isChallengeProductFocus(existing?.productFocus)
          ? existing.productFocus
          : undefined),
      productId:
        body.productId !== undefined
          ? body.productId
          : (existing?.productId ?? null),
      productTeaser:
        body.productTeaser !== undefined
          ? body.productTeaser
          : ((existing?.productTeaser as z.infer<
              typeof challengeTeaserSchema
            > | null) ?? null),
      title: body.title,
      body: body.body,
      category: body.category,
      fillCopy: body.title === undefined && body.body === undefined,
    });
    if ("error" in resolved && resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    data.productFocus = resolved.focus;
    data.productId = resolved.productId;
    data.productTeaser =
      resolved.productTeaser === null
        ? Prisma.DbNull
        : resolved.productTeaser;
    if (resolved.copy) {
      data.title = resolved.copy.title;
      data.body = resolved.copy.body;
      if ("category" in resolved.copy && resolved.copy.category !== undefined) {
        data.category = resolved.copy.category;
      }
    }
  }

  if (body.title !== undefined) data.title = body.title.trim();
  if (body.body !== undefined) data.body = body.body.trim();
  if (body.category !== undefined) {
    data.category = body.category?.trim() || null;
  }
  if (body.city !== undefined) data.city = body.city?.trim() || null;

  if (body.endNow) {
    data.endsAt = new Date();
  } else if (body.reactivate) {
    data.startsAt = new Date();
    data.endsAt = endsInHours(hours);
  } else if (body.hours != null) {
    data.startsAt = new Date();
    data.endsAt = endsInHours(body.hours);
  }

  const challenge = await withDbRetry(() =>
    prisma.dailyChallenge.update({
      where: { id: body.id },
      data,
      include: productInclude,
    }),
  );
  return NextResponse.json({ challenge });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id =
    searchParams.get("id") ||
    ((await req.json().catch(() => ({}))) as { id?: string }).id;
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  await withDbRetry(() => prisma.dailyChallenge.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
