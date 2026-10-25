/** Filtres couleur vidéo — choix host, sync viewers. `natural` = aucun filtre. */
export const LIVE_VIDEO_FILTERS = [
  {
    id: "natural",
    label: "Naturel",
    hint: "Sans filtre",
    filter: "none",
    grade: null as string | null,
    swatch: "linear-gradient(135deg, #c4b5a5 0%, #8a7a6a 100%)",
  },
  {
    id: "hd",
    label: "HD",
    hint: "Net · clair",
    filter: "brightness(1.08) contrast(1.14) saturate(1.08)",
    grade: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
    swatch: "linear-gradient(135deg, #e8eef5 0%, #6a8ab0 100%)",
  },
  {
    id: "studio",
    label: "Studio",
    hint: "Teint chaud",
    filter:
      "brightness(1.06) contrast(1.08) saturate(1.12) sepia(0.12) hue-rotate(-6deg)",
    grade:
      "linear-gradient(180deg, rgba(255,210,185,0.16) 0%, transparent 42%, rgba(255,150,120,0.08) 100%)",
    swatch: "linear-gradient(135deg, #ffd4b8 0%, #c4785a 100%)",
  },
  {
    id: "soft",
    label: "Soft",
    hint: "Peau douce",
    filter: "brightness(1.05) contrast(0.96) saturate(1.05) blur(0.15px)",
    grade:
      "linear-gradient(180deg, rgba(255,220,210,0.14) 0%, transparent 50%)",
    swatch: "linear-gradient(135deg, #ffe4dc 0%, #e0a090 100%)",
  },
  {
    id: "warm",
    label: "Chaud",
    hint: "Golden hour",
    filter: "brightness(1.04) contrast(1.06) saturate(1.2) sepia(0.18) hue-rotate(-12deg)",
    grade:
      "linear-gradient(180deg, rgba(255,190,120,0.18) 0%, transparent 45%)",
    swatch: "linear-gradient(135deg, #ffc078 0%, #c45c2a 100%)",
  },
  {
    id: "cool",
    label: "Froid",
    hint: "Ciné bleu",
    filter: "brightness(1.02) contrast(1.1) saturate(0.95) hue-rotate(12deg)",
    grade:
      "linear-gradient(180deg, rgba(140,180,255,0.12) 0%, transparent 45%)",
    swatch: "linear-gradient(135deg, #a8c8f0 0%, #3a5a8a 100%)",
  },
  {
    id: "cinema",
    label: "Ciné",
    hint: "Contraste film",
    filter: "brightness(0.98) contrast(1.22) saturate(0.92) sepia(0.08)",
    grade:
      "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 30%, rgba(40,20,10,0.2) 100%)",
    swatch: "linear-gradient(135deg, #2a2418 0%, #8a6a40 55%, #1a1210 100%)",
  },
  {
    id: "vivid",
    label: "Vif",
    hint: "Couleurs pop",
    filter: "brightness(1.05) contrast(1.16) saturate(1.35)",
    grade:
      "linear-gradient(180deg, rgba(255,120,180,0.08) 0%, transparent 40%, rgba(80,200,255,0.08) 100%)",
    swatch: "linear-gradient(135deg, #ff6b9d 0%, #4ecdc4 50%, #ffe66d 100%)",
  },
] as const;

export type LiveVideoFilterId = (typeof LIVE_VIDEO_FILTERS)[number]["id"];

const FILTER_IDS = new Set<string>(LIVE_VIDEO_FILTERS.map((f) => f.id));

export function isLiveVideoFilterId(
  value: unknown,
): value is LiveVideoFilterId {
  return typeof value === "string" && FILTER_IDS.has(value);
}

export function resolveLiveVideoFilter(id: string | null | undefined) {
  if (!id || id === "natural") {
    return LIVE_VIDEO_FILTERS[0];
  }
  return LIVE_VIDEO_FILTERS.find((f) => f.id === id) ?? LIVE_VIDEO_FILTERS[0];
}

export function liveVideoFilterCss(
  id: string | null | undefined,
): string | undefined {
  const row = resolveLiveVideoFilter(id);
  return row.filter === "none" ? undefined : row.filter;
}
