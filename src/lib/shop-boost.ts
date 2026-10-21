export const BOOST_PACKS = [
  { days: 1, usdCents: 300 },
  { days: 3, usdCents: 900 },
  { days: 7, usdCents: 2500 },
] as const;

export function boostPack(days: number) {
  return BOOST_PACKS.find((p) => p.days === days) ?? null;
}
