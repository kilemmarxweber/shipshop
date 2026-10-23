import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

import {
  clampPackBudget,
  isCampaignObjective,
  packCatalog,
  packForObjective,
} from "@/lib/growth/campaign-packs";

const schema = z.object({
  title: z.string().min(2).max(120),
  kind: z
    .enum(["FEED", "SEARCH", "CATEGORY", "CREATOR", "STORY", "CHALLENGE"])
    .optional(),
  objective: z.enum(["DISCOVERY", "ENGAGEMENT", "CONVERSION"]).default("DISCOVERY"),
  category: z.string().max(80).optional().nullable(),
  budgetCents: z.number().int().min(0).max(100_000_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
  body: z.string().max(280).optional().nullable(),
  mediaUrl: z.string().max(500).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  productId: z.string().optional().nullable(),
  influencerUserId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const campaigns = await withDbRetry(() =>
    prisma.brandCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  );
  return NextResponse.json({ campaigns, packs: packCatalog() });
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
  const body = schema.parse(await req.json());
  const objective = isCampaignObjective(body.objective)
    ? body.objective
    : "DISCOVERY";
  const pack = packForObjective(objective);
  const budgetCents = clampPackBudget(
    objective,
    body.budgetCents ?? pack.minBudgetCents,
  );

  let productId = body.productId?.trim() || null;
  if (productId) {
    const product = await withDbRetry(() =>
      prisma.product.findFirst({
        where: { id: productId!, status: "ACTIVE" },
        select: { id: true },
      }),
    );
    if (!product) {
      return NextResponse.json(
        {
          error:
            "Produit introuvable ou non publié — laissez l’ID vide ou choisissez un produit ACTIVE",
        },
        { status: 400 },
      );
    }
    productId = product.id;
  }

  const campaign = await withDbRetry(() =>
    prisma.brandCampaign.create({
      data: {
        title: body.title,
        kind: body.kind ?? pack.kind,
        objective,
        category: body.category ?? null,
        budgetCents,
        status: body.status,
        body: body.body ?? null,
        mediaUrl: body.mediaUrl ?? null,
        ctaUrl: body.ctaUrl?.trim() || null,
        productId,
        influencerUserId: body.influencerUserId ?? null,
        ownerUserId: session.user.id,
        startsAt: body.status === "ACTIVE" ? new Date() : null,
      },
    }),
  );
  return NextResponse.json({ campaign, packs: packCatalog() });
}

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(120).optional(),
  kind: z
    .enum(["FEED", "SEARCH", "CATEGORY", "CREATOR", "STORY", "CHALLENGE"])
    .optional(),
  objective: z.enum(["DISCOVERY", "ENGAGEMENT", "CONVERSION"]).optional(),
  category: z.string().max(80).optional().nullable(),
  budgetCents: z.number().int().min(0).max(100_000_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  body: z.string().max(280).optional().nullable(),
  mediaUrl: z.string().max(500).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  productId: z.string().optional().nullable(),
});

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
  const { id, ...rest } = body;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }
  if (rest.productId !== undefined) {
    const raw = rest.productId?.trim() || null;
    if (raw) {
      const product = await withDbRetry(() =>
        prisma.product.findFirst({
          where: { id: raw, status: "ACTIVE" },
          select: { id: true },
        }),
      );
      if (!product) {
        return NextResponse.json(
          {
            error:
              "Produit introuvable ou non publié — laissez l’ID vide ou un produit ACTIVE",
          },
          { status: 400 },
        );
      }
      data.productId = product.id;
    } else {
      data.productId = null;
    }
  }
  if (rest.ctaUrl !== undefined) {
    data.ctaUrl = rest.ctaUrl?.trim() || null;
  }
  if (rest.status === "ACTIVE" && !("startsAt" in data)) {
    data.startsAt = new Date();
  }
  if (rest.objective && rest.budgetCents == null) {
    const objective = isCampaignObjective(rest.objective)
      ? rest.objective
      : "DISCOVERY";
    data.budgetCents = clampPackBudget(
      objective,
      packForObjective(objective).minBudgetCents,
    );
  }
  const campaign = await withDbRetry(() =>
    prisma.brandCampaign.update({
      where: { id },
      data,
    }),
  );
  return NextResponse.json({ campaign });
}
