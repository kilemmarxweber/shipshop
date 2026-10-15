import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ensureSellerMembership } from "@/lib/system-org";
import { slugify } from "@/lib/utils";

const schema = z.object({
  shopName: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

/** Devenir vendeur : rattache à l'org système Chip Shop + crée la boutique. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const { org } = await ensureSellerMembership(session.user.id);

    let slug = slugify(body.shopName);
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
          name: body.shopName,
          slug,
          description: body.description,
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
