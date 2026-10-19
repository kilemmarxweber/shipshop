import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { managedShopsWhere } from "@/lib/shop-access";
import { getSession } from "@/lib/session";
import { assertUniqueShopName } from "@/lib/shop-name";
import { ensureSellerMembership } from "@/lib/system-org";
import { isPublicUploadPath } from "@/lib/upload-url";
import { APP_CURRENCIES, DEFAULT_FX, parseFxRate } from "@/lib/money";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  organizationId: z.string().min(1).optional(),
  logoUrl: z.string().min(1).max(500).optional(),
  currency: z.enum(APP_CURRENCIES).default("USD"),
  fxCdfPerUsd: z.number().int().min(1).max(100_000).optional(),
  fxKwPerUsd: z.number().int().min(1).max(100_000).optional(),
  fxConfirmed: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");
  const mine = searchParams.get("mine") === "1";

  if (mine && session) {
    const { where, isPlatform } = await managedShopsWhere(session.user.id);
    const shops = await prisma.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { products: true } },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    return NextResponse.json({ shops, isPlatformOwner: isPlatform });
  }

  if (organizationId) {
    const shops = await prisma.shop.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ shops });
  }

  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ shops });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const { org, member } = await ensureSellerMembership(session.user.id);
    const organizationId = body.organizationId ?? org.id;

    if (organizationId !== org.id && !member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (body.fxConfirmed !== true) {
      return NextResponse.json(
        { error: "Validez le taux de change du jour avant de créer la boutique" },
        { status: 400 },
      );
    }
    const fxCdfPerUsd = parseFxRate(body.fxCdfPerUsd, DEFAULT_FX.cdfPerUsd);
    const fxKwPerUsd = parseFxRate(body.fxKwPerUsd, DEFAULT_FX.kwPerUsd);

    const name = await assertUniqueShopName(body.name);
    const logoUrl = body.logoUrl?.trim() || null;
    if (logoUrl && !isPublicUploadPath(logoUrl)) {
      return NextResponse.json({ error: "Logo invalide" }, { status: 400 });
    }

    let slug = slugify(name);
    const existing = await prisma.shop.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug,
        },
      },
    });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const shop = await prisma.shop.create({
      data: {
        organizationId,
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
    });

    return NextResponse.json({ shop }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur boutique";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
