/** Filtres Live — couleurs + stickers AR (sync host → viewers). `natural` / `none` = aucun. */

export type LiveVideoFilterKind = "color" | "beauty" | "overlay" | "animation";

export type LiveVideoFilter = {
  id: string;
  label: string;
  hint: string;
  kind: LiveVideoFilterKind;
  filter: string;
  grade: string | null;
  swatch: string;
  emoji?: string;
  anchor?: "head" | "eyes" | "face";
};

export const LIVE_VIDEO_FILTERS: readonly LiveVideoFilter[] = [
  {
    id: "natural",
    label: "Aucun",
    hint: "Sans filtre",
    kind: "color",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #c4b5a5 0%, #8a7a6a 100%)",
    emoji: "🚫",
  },
  {
    id: "hd",
    label: "HD",
    hint: "Net · clair",
    kind: "color",
    filter: "brightness(1.08) contrast(1.14) saturate(1.08)",
    grade:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
    swatch: "linear-gradient(135deg, #e8eef5 0%, #6a8ab0 100%)",
    emoji: "✨",
  },
  {
    id: "studio",
    label: "Studio",
    hint: "Teint chaud",
    kind: "beauty",
    filter:
      "brightness(1.06) contrast(1.08) saturate(1.12) sepia(0.12) hue-rotate(-6deg)",
    grade:
      "linear-gradient(180deg, rgba(255,210,185,0.16) 0%, transparent 42%, rgba(255,150,120,0.08) 100%)",
    swatch: "linear-gradient(135deg, #ffd4b8 0%, #c4785a 100%)",
    emoji: "🤍",
  },
  {
    id: "soft",
    label: "Doux",
    hint: "Peau douce",
    kind: "beauty",
    filter: "brightness(1.05) contrast(0.96) saturate(1.05) blur(0.15px)",
    grade:
      "linear-gradient(180deg, rgba(255,220,210,0.14) 0%, transparent 50%)",
    swatch: "linear-gradient(135deg, #ffe4dc 0%, #e0a090 100%)",
    emoji: "🌸",
  },
  {
    id: "warm",
    label: "Chaud",
    hint: "Golden hour",
    kind: "color",
    filter:
      "brightness(1.04) contrast(1.06) saturate(1.2) sepia(0.18) hue-rotate(-12deg)",
    grade:
      "linear-gradient(180deg, rgba(255,190,120,0.18) 0%, transparent 45%)",
    swatch: "linear-gradient(135deg, #ffc078 0%, #c45c2a 100%)",
    emoji: "🌅",
  },
  {
    id: "cool",
    label: "Froid",
    hint: "Ciné bleu",
    kind: "color",
    filter: "brightness(1.02) contrast(1.1) saturate(0.95) hue-rotate(12deg)",
    grade:
      "linear-gradient(180deg, rgba(140,180,255,0.12) 0%, transparent 45%)",
    swatch: "linear-gradient(135deg, #a8c8f0 0%, #3a5a8a 100%)",
    emoji: "🧊",
  },
  {
    id: "cinema",
    label: "Ciné",
    hint: "Contraste film",
    kind: "color",
    filter: "brightness(0.98) contrast(1.22) saturate(0.92) sepia(0.08)",
    grade:
      "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 30%, rgba(40,20,10,0.2) 100%)",
    swatch: "linear-gradient(135deg, #2a2418 0%, #8a6a40 55%, #1a1210 100%)",
    emoji: "🎬",
  },
  {
    id: "vivid",
    label: "Vif",
    hint: "Couleurs pop",
    kind: "color",
    filter: "brightness(1.05) contrast(1.16) saturate(1.35)",
    grade:
      "linear-gradient(180deg, rgba(255,120,180,0.08) 0%, transparent 40%, rgba(80,200,255,0.08) 100%)",
    swatch: "linear-gradient(135deg, #ff6b9d 0%, #4ecdc4 50%, #ffe66d 100%)",
    emoji: "🌈",
  },
  {
    id: "crown",
    label: "Couronne",
    hint: "Chapeau AR",
    kind: "overlay",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #f6e27a 0%, #c9a227 100%)",
    emoji: "👑",
    anchor: "head",
  },
  {
    id: "cap",
    label: "Casquette",
    hint: "Chapeau AR",
    kind: "overlay",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
    emoji: "🧢",
    anchor: "head",
  },
  {
    id: "glasses",
    label: "Lunettes",
    hint: "Accessoire",
    kind: "overlay",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #111 0%, #666 100%)",
    emoji: "🕶️",
    anchor: "eyes",
  },
  {
    id: "cat",
    label: "Chat",
    hint: "Animaux",
    kind: "overlay",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
    emoji: "🐱",
    anchor: "head",
  },
  {
    id: "heart",
    label: "Cœurs",
    hint: "Emoji animé",
    kind: "animation",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
    emoji: "💕",
    anchor: "eyes",
  },
  {
    id: "star",
    label: "Étoiles",
    hint: "Emoji animé",
    kind: "animation",
    filter: "none",
    grade: null,
    swatch: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
    emoji: "⭐",
    anchor: "head",
  },
  {
    id: "sparkle",
    label: "Sparkle",
    hint: "Particules",
    kind: "animation",
    filter: "brightness(1.04) saturate(1.08)",
    grade:
      "radial-gradient(circle at 30% 20%, rgba(255,232,163,0.25), transparent 40%)",
    swatch: "linear-gradient(135deg, #fff7c2 0%, #fbbf24 100%)",
    emoji: "✨",
    anchor: "face",
  },
  {
    id: "blush",
    label: "Blush",
    hint: "Beauté légère",
    kind: "beauty",
    filter: "brightness(1.03) saturate(1.06)",
    grade:
      "radial-gradient(circle at 28% 52%, rgba(255,120,140,0.22), transparent 28%), radial-gradient(circle at 72% 52%, rgba(255,120,140,0.22), transparent 28%)",
    swatch: "linear-gradient(135deg, #fecdd3 0%, #fb7185 100%)",
    emoji: "😊",
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
  if (!id || id === "natural" || id === "none" || id === "naturel") {
    return LIVE_VIDEO_FILTERS[0];
  }
  // Compat IDs mobile ShipShop
  const aliases: Record<string, string> = {
    doux: "soft",
    noir: "cinema",
    naturel: "natural",
    none: "natural",
  };
  const mapped = aliases[id] ?? id;
  return (
    LIVE_VIDEO_FILTERS.find((f) => f.id === mapped) ?? LIVE_VIDEO_FILTERS[0]
  );
}

export function liveVideoFilterCss(
  id: string | null | undefined,
): string | undefined {
  const row = resolveLiveVideoFilter(id);
  return row.filter === "none" ? undefined : row.filter;
}
