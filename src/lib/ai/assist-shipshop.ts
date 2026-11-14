import {
  type AssistLink,
  type AssistProduct,
  containsOr,
  detectIntent,
  extractSearchTerms,
  searchCatalogProducts,
} from "@/lib/ai/catalog-chat";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function assistShipShop(
  message: string,
  opts: { userId?: string | null; take?: number } = {},
) {
  const take = opts.take ?? 6;
  const intent = detectIntent(message);
  const terms = extractSearchTerms(message);
  const lower = message.toLowerCase();

  if (/rembours|annul|payer|virement|cinetpay|wallet/i.test(lower)) {
    return {
      reply:
        "Je ne peux pas effectuer de paiement, remboursement ou annulation. Ouvrez Commandes ou Aide pour le support humain.",
      products: [] as AssistProduct[],
      links: [
        {
          id: "orders",
          kind: "route" as const,
          title: "Mes commandes",
          href: "/orders",
        },
        {
          id: "aide",
          kind: "route" as const,
          title: "Aide / support",
          href: "/legal/aide",
        },
      ] satisfies AssistLink[],
      provider: "catalog",
    };
  }

  const links: AssistLink[] = [];
  let products: AssistProduct[] = [];
  const bits: string[] = [];

  const wantProducts =
    intent.product ||
    (!intent.shop &&
      !intent.live &&
      !intent.challenge &&
      !intent.event &&
      !intent.order &&
      !intent.buyer);

  if (wantProducts || /robe|smartphone|phone|article|produit/i.test(lower)) {
    const found = await searchCatalogProducts(message, take);
    products = found.products.map((p) => ({
      id: p.id,
      title: p.title,
      priceCents: p.priceCents,
      currency: p.currency,
      quantity: p.quantity,
      category: p.category,
      images: p.images,
    }));
    for (const p of found.products) {
      links.push({
        id: p.id,
        kind: "product",
        title: p.title,
        subtitle: `${p.shop.name} · ${p.category}`,
        href: `/product/${p.id}`,
        imageUrl: p.images[0] ?? null,
      });
      if (p.shop?.slug) {
        links.push({
          id: `shop:${p.shop.id}`,
          kind: "shop",
          title: p.shop.name,
          subtitle: "Boutique du vendeur",
          href: `/shop/${p.shop.slug}`,
          imageUrl: p.shop.logoUrl,
        });
      }
    }
    if (products.length) {
      bits.push(
        found.usedFallback
          ? "Pas de match exact — voici des idées :"
          : found.terms.length
            ? `${products.length} résultat${products.length > 1 ? "s" : ""} pour « ${found.terms[0]} »`
            : "Voici ce que j’ai trouvé :",
      );
    }
  }

  if (intent.shop || intent.buyer || /boutique|vendeur/i.test(lower)) {
    const shopWhere = containsOr(terms, ["name", "slug", "description"]);
    const shops = await withDbRetry(() =>
      prisma.shop.findMany({
        where: {
          isActive: true,
          ...(shopWhere ?? {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          owner: { select: { id: true, name: true } },
        },
      }),
    );
    if (shops.length) {
      bits.push(`${shops.length} boutique(s) / vendeur(s) :`);
      for (const shop of shops) {
        links.push({
          id: shop.id,
          kind: "shop",
          title: shop.name,
          subtitle: shop.owner?.name
            ? `Vendeur · ${shop.owner.name}`
            : (shop.description?.slice(0, 80) ?? "Boutique ShipShop"),
          href: `/shop/${shop.slug}`,
          imageUrl: shop.logoUrl,
        });
      }
    } else if (intent.shop) {
      bits.push(
        "Aucune boutique ne correspond exactement — essayez le nom exact du vendeur.",
      );
    }
  }

  if (intent.live || /live|direct/i.test(lower)) {
    const lives = await withDbRetry(() =>
      prisma.creatorLive.findMany({
        where: {
          status: { in: ["LIVE", "PAUSED"] },
          OR: terms.length
            ? terms.flatMap((term) => [
                { title: { contains: term, mode: "insensitive" as const } },
                {
                  user: {
                    name: { contains: term, mode: "insensitive" as const },
                  },
                },
              ])
            : undefined,
        },
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          user: { select: { name: true } },
          product: { select: { images: true } },
        },
      }),
    );
    if (lives.length) {
      bits.push(`${lives.length} live(s) en cours :`);
      for (const live of lives) {
        links.push({
          id: live.id,
          kind: "live",
          title: live.title,
          subtitle: `${live.user.name} · ${live.status}`,
          href: `/live/${live.id}`,
          imageUrl: live.product?.images?.[0] ?? null,
        });
      }
    } else if (intent.live) {
      bits.push("Pas de live ouvert pour l’instant — regardez l’accueil.");
      links.push({
        id: "lives",
        kind: "route",
        title: "Voir les lives",
        href: "/live",
      });
    }
  }

  if (intent.challenge || /challenge|d[eé]fi/i.test(lower)) {
    const now = new Date();
    const challenges = await withDbRetry(() =>
      prisma.dailyChallenge.findMany({
        where: {
          programmed: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          OR: terms.length
            ? terms.flatMap((term) => [
                { title: { contains: term, mode: "insensitive" as const } },
                { body: { contains: term, mode: "insensitive" as const } },
                { category: { contains: term, mode: "insensitive" as const } },
              ])
            : undefined,
        },
        orderBy: { endsAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          eventId: true,
          productId: true,
        },
      }),
    );
    if (challenges.length) {
      bits.push(`${challenges.length} challenge(s) actifs :`);
      for (const row of challenges) {
        const href = row.eventId
          ? `/events/${row.eventId}`
          : row.productId
            ? `/product/${row.productId}`
            : "/(tabs)";
        links.push({
          id: row.id,
          kind: "challenge",
          title: row.title,
          subtitle: row.category ?? "Challenge",
          href,
        });
      }
    } else if (intent.challenge) {
      bits.push("Aucun challenge programmé pour le moment.");
    }
  }

  if (intent.event || /concert|billet|ticket/i.test(lower)) {
    const events = await withDbRetry(() =>
      prisma.event.findMany({
        where: {
          status: "ON_SALE",
          OR: terms.length
            ? terms.flatMap((term) => [
                { title: { contains: term, mode: "insensitive" as const } },
                { city: { contains: term, mode: "insensitive" as const } },
                { venue: { contains: term, mode: "insensitive" as const } },
                {
                  organizerName: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
              ])
            : undefined,
        },
        orderBy: { startsAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          city: true,
          venue: true,
          imageUrl: true,
          organizerName: true,
        },
      }),
    );
    const eventRows = events;

    if (eventRows.length) {
      bits.push(`${eventRows.length} concert(s) / événement(s) :`);
      for (const row of eventRows) {
        links.push({
          id: row.id,
          kind: "event",
          title: row.title,
          subtitle: `${row.organizerName} · ${row.venue}, ${row.city}`,
          href: `/events/${row.id}`,
          imageUrl: row.imageUrl,
        });
      }
    } else if (intent.event) {
      bits.push("Aucun événement trouvé — ouvrez Billets.");
      links.push({
        id: "tickets",
        kind: "route",
        title: "Billets / concerts",
        href: "/tickets",
      });
    }
  }

  if ((intent.order || intent.buyer) && opts.userId) {
    const orders = await withDbRetry(() =>
      prisma.order.findMany({
        where: {
          OR: [
            { buyerId: opts.userId! },
            { shop: { ownerUserId: opts.userId! } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          totalCents: true,
          status: true,
          product: { select: { title: true, images: true } },
          shop: { select: { name: true } },
          buyer: { select: { name: true } },
        },
      }),
    );
    if (orders.length) {
      bits.push(`${orders.length} commande(s) récente(s) :`);
      for (const order of orders) {
        links.push({
          id: order.id,
          kind: "order",
          title: order.product.title,
          subtitle: `${order.shop.name} · ${order.buyer.name} · ${order.status}`,
          href: `/orders/${order.id}`,
          imageUrl: order.product.images[0] ?? null,
        });
      }
    } else if (intent.order) {
      bits.push("Aucune commande liée à votre compte pour l’instant.");
      links.push({
        id: "orders",
        kind: "route",
        title: "Mes commandes",
        href: "/orders",
      });
    }
  } else if (intent.order && !opts.userId) {
    bits.push("Connectez-vous pour voir vos commandes.");
  }

  if (intent.wanted) {
    links.push({
      id: "wanted",
      kind: "route",
      title: "Je cherche",
      subtitle: "Créer ou suivre une demande",
      href: "/(tabs)",
    });
  }

  const seen = new Set<string>();
  const uniqueLinks = links.filter((link) => {
    const key = `${link.kind}:${link.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!products.length && !uniqueLinks.length) {
    return {
      reply:
        "Rien trouvé. Essayez un autre mot-clé, ou ouvrez Découvrir / Je cherche.",
      products: [],
      links: [
        {
          id: "discover",
          kind: "route" as const,
          title: "Découvrir",
          href: "/(tabs)/boutique",
        },
        {
          id: "wanted",
          kind: "route" as const,
          title: "Je cherche",
          href: "/(tabs)",
        },
      ] satisfies AssistLink[],
      provider: "catalog",
    };
  }

  const reply = bits.join("\n") || "Voici ce que j’ai trouvé.";

  return {
    reply,
    products,
    links: uniqueLinks.slice(0, 12),
    provider: "catalog",
  };
}
