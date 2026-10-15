import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertUniqueShopName } from "@/lib/shop-name";
import { ensureSellerMembership } from "@/lib/system-org";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  organizationId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");
  const mine = searchParams.get("mine") === "1";

  if (mine && session) {
    const shops = await prisma.shop.findMany({
      where: { ownerUserId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ shops });
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

    const name = await assertUniqueShopName(body.name);

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
      },
    });

    return NextResponse.json({ shop }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur boutique";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
