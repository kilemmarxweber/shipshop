import { prisma, withDbRetry } from "@/lib/prisma";

const STOP = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "ou",
  "à",
  "a",
  "je",
  "tu",
  "il",
  "elle",
  "nous",
  "vous",
  "me",
  "mon",
  "ma",
  "mes",
  "pour",
  "avec",
  "sur",
  "dans",
  "qui",
  "que",
  "quoi",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "meilleurs",
  "meilleur",
  "montre",
  "moi",
  "aide",
  "aider",
  "trouver",
  "produit",
  "produits",
  "cherche",
  "rechercher",
  "voir",
  "donner",
  "donne",
  "details",
  "detail",
  "est",
  "sont",
  "suis",
  "es",
  "sommes",
  "etes",
  "etre",
  "ce",
  "cet",
  "cette",
  "ces",
  "au",
  "aux",
  "en",
  "y",
  "pas",
  "plus",
  "tout",
  "tous",
  "toute",
  "toutes",
]);

/** Synonymes / racines pour coller au catalogue réel (robe ≠ robes, iPhone ≠ smartphone). */
const SYNONYMS: Record<string, string[]> = {
  robes: ["robe", "robes", "dress", "jupe", "mode", "habit", "tenue"],
  robe: ["robe", "robes", "dress", "mode"],
  elegantes: ["elegante", "élégant", "soirée", "soiree", "chic", "mode"],
  smartphone: [
    "smartphone",
    "smartphones",
    "telephone",
    "téléphone",
    "phone",
    "iphone",
    "samsung",
    "android",
    "mobile",
    "tech",
  ],
  telephone: ["telephone", "téléphone", "smartphone", "phone", "mobile"],
  phone: ["phone", "smartphone", "iphone", "mobile"],
  iphone: ["iphone", "apple", "smartphone", "phone"],
  boutique: ["boutique", "shop", "magasin", "vendeur", "seller"],
  vendeur: ["vendeur", "vendeuse", "boutique", "shop", "seller"],
  live: ["live", "direct", "livestream"],
  challenge: ["challenge", "defi", "défi", "mission"],
  concert: ["concert", "event", "evenement", "événement", "billet", "ticket"],
  commande: ["commande", "commandes", "order", "achat"],
  acheteur: ["acheteur", "client", "buyer"],
};

export type AssistLink = {
  id: string;
  kind:
    | "product"
    | "shop"
    | "live"
    | "event"
    | "challenge"
    | "order"
    | "wanted"
    | "route";
  title: string;
  subtitle?: string | null;
  href: string;
  imageUrl?: string | null;
};

export type AssistProduct = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  quantity: number;
  category: string;
  images?: string[];
};

export function extractSearchTerms(message: string) {
  const raw = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w));

  const expanded = new Set<string>();
  for (const term of raw) {
    expanded.add(term);
    const extras = SYNONYMS[term];
    if (extras) for (const extra of extras) expanded.add(extra);
    // racine simple pluriel FR
    if (term.endsWith("s") && term.length > 3) expanded.add(term.slice(0, -1));
    else expanded.add(`${term}s`);
  }
  return [...expanded].slice(0, 14);
}

function detectIntent(message: string) {
  const lower = message.toLowerCase();
  return {
    shop: /boutique|vendeur|vendeuse|magasin|shop|seller|slug/i.test(lower),
    live: /live|direct|livestream/i.test(lower),
    challenge: /challenge|d[eé]fi|mission/i.test(lower),
    event: /concert|billet|ticket|[eé]v[eé]nement|event|spectacle/i.test(lower),
    order: /commande|order|achat|livraison|panier/i.test(lower),
    buyer: /acheteur|client|buyer/i.test(lower),
    wanted: /je cherche|wanted|demande/i.test(lower),
    product:
      /produit|article|robe|smartphone|phone|acheter|catalogue|prix/i.test(
        lower,
      ) || true,
  };
}

function containsOr(
  terms: string[],
  fields: (
    | "title"
    | "category"
    | "description"
    | "name"
    | "slug"
    | "body"
    | "venue"
    | "city"
    | "organizerName"
  )[],
) {
  if (!terms.length) return undefined;
  return {
    OR: terms.flatMap((term) =>
      fields.map((field) => ({
        [field]: { contains: term, mode: "insensitive" as const },
      })),
    ),
  };
}

export async function searchCatalogProducts(message: string, take = 6) {
  const terms = extractSearchTerms(message);
  const q = terms[0] ?? message.trim().slice(0, 80);

  const productSelect = {
    id: true,
    title: true,
    priceCents: true,
    currency: true,
    images: true,
    category: true,
    quantity: true,
    shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
  } as const;

  let products = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        quantity: { gt: 0 },
        OR: terms.length
          ? terms.flatMap((term) => [
              { title: { contains: term, mode: "insensitive" as const } },
              { category: { contains: term, mode: "insensitive" as const } },
              {
                description: { contains: term, mode: "insensitive" as const },
              },
              {
                shop: {
                  name: { contains: term, mode: "insensitive" as const },
                },
              },
            ])
          : [
              { title: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
            ],
      },
      orderBy: { createdAt: "desc" },
      take,
      select: productSelect,
    }),
  );

  let usedFallback = false;
  // Fallback : suggestions vitrine si aucun match (évite le message mort).
  if (!products.length) {
    usedFallback = true;
    products = await withDbRetry(() =>
      prisma.product.findMany({
        where: { status: "ACTIVE", quantity: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take,
        select: productSelect,
      }),
    );
  }

  return { terms, products, usedFallback };
}

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

  // Dédupliquer liens (shop répété via produits)
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

/** @deprecated — utilitaire tests / rétrocompat */
export function buildCatalogReply(message: string, products: AssistProduct[]) {
  const lower = message.toLowerCase();
  if (/rembours|annul|payer|virement|cinetpay|wallet/i.test(lower)) {
    return {
      reply:
        "Je ne peux pas effectuer de paiement, remboursement ou annulation. Ouvrez Commandes ou le support humain depuis Aide.",
      products: [] as AssistProduct[],
    };
  }
  if (!products.length) {
    return {
      reply:
        "Je n’ai pas trouvé d’articles actifs correspondant. Essayez Découvrir, ou créez une demande dans Je cherche.",
      products: [],
    };
  }
  const lines = products
    .slice(0, 3)
    .map((p) => `• ${p.title} (${p.category})`)
    .join("\n");
  return {
    reply: `Voici des articles actifs du catalogue ShipShop :\n${lines}\n\nLes prix affichés viennent de la base — ouvrez une fiche pour le détail et le stock.`,
    products,
  };
}
