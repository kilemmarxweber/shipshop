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

export function detectIntent(message: string) {
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

export function containsOr(
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
