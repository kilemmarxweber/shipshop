const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "les",
  "des",
  "une",
  "pour",
  "avec",
  "dans",
  "sur",
  "par",
  "plus",
  "que",
  "qui",
  "dont",
  "cet",
  "cette",
  "ces",
  "son",
  "ses",
  "aux",
  "du",
  "de",
  "la",
  "le",
  "un",
  "et",
  "ou",
  "au",
  "new",
  "neuf",
  "pro",
  "max",
]);

export function tasteTokens(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

export type BuyerTaste = {
  categories: Map<string, number>;
  shopIds: Map<string, number>;
  tokens: Map<string, number>;
};

export function emptyTaste(): BuyerTaste {
  return {
    categories: new Map(),
    shopIds: new Map(),
    tokens: new Map(),
  };
}

export function addTasteWeight(
  map: Map<string, number>,
  key: string | null | undefined,
  weight: number,
) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + weight);
}

export function tasteMatchScore(
  product: { title: string; category: string; shopId: string },
  taste: BuyerTaste | null | undefined,
) {
  if (!taste) return 0;
  let score = 0;
  score += (taste.categories.get(product.category) ?? 0) * 2.4;
  score += (taste.shopIds.get(product.shopId) ?? 0) * 1.8;
  let tokenHits = 0;
  for (const token of tasteTokens(product.title)) {
    const w = taste.tokens.get(token);
    if (w) tokenHits += w;
  }
  score += Math.min(4, tokenHits) * 1.4;
  return score;
}
