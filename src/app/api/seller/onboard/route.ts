import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertUniqueShopName } from "@/lib/shop-name";
import { ensureSellerMembership } from "@/lib/system-org";
import { APP_CURRENCIES, DEFAULT_FX, parseFxRate } from "@/lib/money";
import { isPublicUploadPath } from "@/lib/upload-url";
import { slugify } from "@/lib/utils";

const schema = z.object({
  shopName: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  logoUrl: z.string().min(1).max(500).optional().nullable(),
  currency: z.enum(APP_CURRENCIES).default("USD"),
  fxCdfPerUsd: z.number().int().min(1).max(100_000).optional(),
  fxKwPerUsd: z.number().int().min(1).max(100_000).optional(),
  fxConfirmed: z.boolean().optional(),
});

/** Devenir vendeur : le compte est déjà member Chip Shop ; crée la boutique. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const { org } = await ensureSellerMembership(session.user.id);
    if (body.fxConfirmed !== true) {
      return NextResponse.json(
        { error: "Validez le taux de change du jour avant de créer la boutique" },
        { status: 400 },
      );
    }
    const fxCdfPerUsd = parseFxRate(body.fxCdfPerUsd, DEFAULT_FX.cdfPerUsd);
    const fxKwPerUsd = parseFxRate(body.fxKwPerUsd, DEFAULT_FX.kwPerUsd);
    const name = await assertUniqueShopName(body.shopName);
    const logoUrl = body.logoUrl?.trim() || null;
    if (logoUrl && !isPublicUploadPath(logoUrl)) {
      return NextResponse.json({ error: "Logo invalide" }, { status: 400 });
    }

    let slug = slugify(name);
    const existing = await withDbRetry(() =>
      prisma.shop.findUnique({
        where: {
          organizationId_slug: { organizationId: org.id, slug },
        },
      }),
    );
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const shop = await withDbRetry(() =>
      prisma.shop.create({
        data: {
          organizationId: org.id,
          ownerUserId: session.user.id,
          name,
          slug,
          description: body.description,
          logoUrl,
          currency: body.currency,
          fxCdfPerUsd,
          fxKwPerUsd,
          fxRateUpdatedAt: new Date(),
        },
      }),
    );

    return NextResponse.json(
      { organization: org, shop },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onboarding impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { org, member } = await ensureSellerMembership(session.user.id);
  const shops = await withDbRetry(() =>
    prisma.shop.findMany({
      where: {
        organizationId: org.id,
        isActive: true,
        ...(member.role === "owner" || member.role === "admin"
          ? {}
          : { ownerUserId: session.user.id }),
      },
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({
    organization: org,
    member,
    shops,
  });
}
