import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type ContactRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kind: "buyer" | "follower" | "invitee" | "self";
  shopName?: string | null;
  productTitles?: string[];
  ordersCount?: number;
  totalSpentCents?: number;
  followedAt?: string | null;
  inviteStatus?: string | null;
  invitedAt?: string | null;
};

/**
 * Contacts du vendeur :
 * - acheteurs de ses produits
 * - abonnés (followers) de ses boutiques
 * - personnes qu'il a invitées (+ lui-même)
 * Owner plateforme : peut passer shopId pour filtrer, sinon toutes ses boutiques.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const shopIdParam = new URL(req.url).searchParams.get("shopId");
    const { isOwner, org } = await assertChipShopOwner(session.user.id);

    const shops = await withDbRetry(() =>
      prisma.shop.findMany({
        where: isOwner
          ? {
              organizationId: org.id,
              ...(shopIdParam ? { id: shopIdParam } : {}),
            }
          : {
              ownerUserId: session.user.id,
              ...(shopIdParam ? { id: shopIdParam } : {}),
            },
        select: { id: true, name: true, slug: true, ownerUserId: true },
        orderBy: { name: "asc" },
      }),
    );

    if (!isOwner) {
      if (shopIdParam && shops.length === 0) {
        return NextResponse.json(
          { error: "Boutique hors de votre périmètre" },
          { status: 403 },
        );
      }
    }

    if (shops.length === 0) {
      return NextResponse.json({
        shops: [],
        buyers: [],
        followers: [],
        invitees: [],
        self: null,
      });
    }

    const shopIds = shops.map((s) => s.id);
    const shopNameById = new Map(shops.map((s) => [s.id, s.name]));

    const me = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, phone: true },
      }),
    );

    const [orders, follows, invitations] = await Promise.all([
      withDbRetry(() =>
        prisma.order.findMany({
          where: { shopId: { in: shopIds } },
          select: {
            buyerId: true,
            productCents: true,
            amountCents: true,
            totalCents: true,
            shopId: true,
            product: { select: { title: true } },
            buyer: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 2000,
        }),
      ),
      withDbRetry(() =>
        prisma.shopFollow.findMany({
          where: { shopId: { in: shopIds } },
          select: {
            createdAt: true,
            shopId: true,
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ),
      withDbRetry(() =>
        prisma.invitation.findMany({
          where: { inviterId: session.user.id },
          select: {
            id: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ),
    ]);

    const buyerMap = new Map<
      string,
      ContactRow & { productSet: Set<string> }
    >();
    for (const o of orders) {
      const existing = buyerMap.get(o.buyer.id);
      const spent = o.productCents || o.amountCents || o.totalCents || 0;
      if (existing) {
        existing.ordersCount = (existing.ordersCount ?? 0) + 1;
        existing.totalSpentCents = (existing.totalSpentCents ?? 0) + spent;
        existing.productSet.add(o.product.title);
        if (!existing.shopName && shopNameById.get(o.shopId)) {
          existing.shopName = shopNameById.get(o.shopId) ?? null;
        }
      } else {
        buyerMap.set(o.buyer.id, {
          id: o.buyer.id,
          name: o.buyer.name,
          email: o.buyer.email,
          phone: o.buyer.phone,
          kind: "buyer",
          shopName: shopNameById.get(o.shopId) ?? null,
          ordersCount: 1,
          totalSpentCents: spent,
          productSet: new Set([o.product.title]),
        });
      }
    }

    const buyers: ContactRow[] = [...buyerMap.values()]
      .map(({ productSet, ...rest }) => ({
        ...rest,
        productTitles: [...productSet].slice(0, 8),
      }))
      .sort((a, b) => (b.ordersCount ?? 0) - (a.ordersCount ?? 0));

    const followerMap = new Map<string, ContactRow>();
    for (const f of follows) {
      if (followerMap.has(f.user.id)) continue;
      followerMap.set(f.user.id, {
        id: f.user.id,
        name: f.user.name,
        email: f.user.email,
        phone: f.user.phone,
        kind: "follower",
        shopName: shopNameById.get(f.shopId) ?? null,
        followedAt: f.createdAt.toISOString(),
      });
    }
    const followers = [...followerMap.values()];

    const inviteEmails = [
      ...new Set(invitations.map((i) => i.email.toLowerCase())),
    ];
    const inviteUsers =
      inviteEmails.length === 0
        ? []
        : await withDbRetry(() =>
            prisma.user.findMany({
              where: {
                email: {
                  in: inviteEmails,
                  mode: "insensitive",
                },
              },
              select: { id: true, name: true, email: true, phone: true },
            }),
          );
    const userByEmail = new Map(
      inviteUsers.map((u) => [u.email.toLowerCase(), u]),
    );

    const invitees: ContactRow[] = invitations.map((inv) => {
      const u = userByEmail.get(inv.email.toLowerCase());
      return {
        id: u?.id ?? inv.id,
        name: u?.name ?? inv.email.split("@")[0] ?? inv.email,
        email: inv.email,
        phone: u?.phone ?? null,
        kind: "invitee",
        inviteStatus: inv.status,
        invitedAt: inv.createdAt.toISOString(),
      };
    });

    const self: ContactRow | null = me
      ? {
          id: me.id,
          name: me.name,
          email: me.email,
          phone: me.phone,
          kind: "self",
        }
      : null;

    return NextResponse.json({
      shops: shops.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      self,
      buyers,
      followers,
      invitees,
      counts: {
        buyers: buyers.length,
        followers: followers.length,
        invitees: invitees.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
