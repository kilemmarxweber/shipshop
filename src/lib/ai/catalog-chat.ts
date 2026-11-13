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
  "meilleurs",
  "meilleur",
  "montre",
  "moi",
  "aide",
  "trouver",
  "produit",
  "produits",
  "cherche",
]);

export function extractSearchTerms(message: string) {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .slice(0, 6);
}

export async function searchCatalogProducts(message: string, take = 6) {
  const terms = extractSearchTerms(message);
  const q = terms.join(" ").trim() || message.trim().slice(0, 80);

  const products = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: terms.length
          ? terms.flatMap((term) => [
              { title: { contains: term, mode: "insensitive" as const } },
              { category: { contains: term, mode: "insensitive" as const } },
              { description: { contains: term, mode: "insensitive" as const } },
            ])
          : [
              { title: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
            ],
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        priceCents: true,
        currency: true,
        images: true,
        category: true,
        quantity: true,
      },
    }),
  );

  return { terms, products };
}

export function buildCatalogReply(
  message: string,
  products: Array<{
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    quantity: number;
    category: string;
  }>,
) {
  const lower = message.toLowerCase();
  if (
    /rembours|annul|payer|virement|cinetpay|wallet/i.test(lower)
  ) {
    return {
      reply:
        "Je ne peux pas effectuer de paiement, remboursement ou annulation. Ouvrez Commandes ou le support humain depuis Aide.",
      products: [] as typeof products,
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
