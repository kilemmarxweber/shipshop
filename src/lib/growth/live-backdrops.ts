/** Fonds décoratifs CSS — teintes soft / beauty (pas de fichier à supprimer). */
export const LIVE_BACKDROP_PRESETS = [
  {
    id: "teint",
    label: "Teint",
    css: "radial-gradient(ellipse 95% 70% at 50% 18%, rgba(255,214,186,0.55) 0%, transparent 58%), radial-gradient(ellipse 70% 55% at 78% 72%, rgba(255,168,150,0.28) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 18% 65%, rgba(255,196,170,0.22) 0%, transparent 50%), linear-gradient(168deg, #1a1412 0%, #120e0d 48%, #0a0808 100%)",
  },
  {
    id: "peach",
    label: "Pêche",
    css: "radial-gradient(ellipse 110% 75% at 50% 0%, rgba(255,186,148,0.5) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 85% 55%, rgba(255,140,120,0.3) 0%, transparent 50%), linear-gradient(180deg, #221610 0%, #120c0a 100%)",
  },
  {
    id: "rose",
    label: "Rose",
    css: "radial-gradient(ellipse 100% 70% at 40% 10%, rgba(255,190,205,0.42) 0%, transparent 55%), radial-gradient(ellipse 65% 50% at 90% 60%, rgba(232,140,170,0.28) 0%, transparent 50%), linear-gradient(165deg, #1a1016 0%, #0e0a0e 100%)",
  },
  {
    id: "aurora",
    label: "Aurore",
    css: "radial-gradient(ellipse 120% 80% at 20% 10%, rgba(120,170,255,0.45) 0%, transparent 55%), radial-gradient(ellipse 90% 70% at 85% 30%, rgba(255,140,200,0.35) 0%, transparent 50%), linear-gradient(165deg, #0b1020 0%, #12182e 45%, #1a0f24 100%)",
  },
  {
    id: "sunset",
    label: "Coucher",
    css: "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(255,190,120,0.55) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 80% 40%, rgba(255,110,100,0.35) 0%, transparent 50%), linear-gradient(180deg, #2a1520 0%, #120a12 100%)",
  },
  {
    id: "studio",
    label: "Studio",
    css: "radial-gradient(ellipse 75% 55% at 50% 28%, rgba(255,230,210,0.22) 0%, transparent 58%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(80,70,90,0.35) 0%, transparent 55%), linear-gradient(180deg, #1c1a20 0%, #08080c 100%)",
  },
  {
    id: "neon",
    label: "Néon",
    css: "radial-gradient(ellipse 60% 40% at 15% 80%, rgba(0,255,180,0.35) 0%, transparent 50%), radial-gradient(ellipse 50% 45% at 90% 20%, rgba(140,120,255,0.4) 0%, transparent 45%), linear-gradient(160deg, #050510 0%, #0d0a1a 100%)",
  },
  {
    id: "kin",
    label: "Kin",
    css: "radial-gradient(ellipse 100% 70% at 50% 0%, rgba(255,190,120,0.45) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 10% 90%, rgba(230,120,80,0.3) 0%, transparent 45%), linear-gradient(165deg, #1a1208 0%, #0d0906 100%)",
  },
] as const;

export type LiveBackdropPresetId =
  (typeof LIVE_BACKDROP_PRESETS)[number]["id"];

const PRESET_IDS = new Set<string>(
  LIVE_BACKDROP_PRESETS.map((p) => p.id),
);

export function isLiveBackdropPresetId(
  value: unknown,
): value is LiveBackdropPresetId {
  return typeof value === "string" && PRESET_IDS.has(value);
}

export function liveBackdropCss(
  preset: string | null | undefined,
): string | null {
  if (!preset) return null;
  const row = LIVE_BACKDROP_PRESETS.find((p) => p.id === preset);
  return row?.css ?? null;
}

/** URL d’upload locale uniquement (pas d’URL externe arbitraire). */
export function isLiveBackdropUploadUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.length > 512) return false;
  if (u.startsWith("/uploads/") || u.startsWith("/api/uploads/")) return true;
  try {
    const parsed = new URL(u);
    return (
      parsed.pathname.startsWith("/uploads/") ||
      parsed.pathname.startsWith("/api/uploads/")
    );
  } catch {
    return false;
  }
}
