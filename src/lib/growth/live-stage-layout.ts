/** Cases scène (hôte hors quota) — côté client + serveur. */
export const LIVE_GUEST_MAX_ON_STAGE = 8;

/** Dispositions multi-invités (adoptées, pas une copie TikTok). */
export const LIVE_STAGE_LAYOUTS = [
  {
    id: "rail",
    label: "Rail",
    hint: "Hôte plein écran · invités à droite",
  },
  {
    id: "split",
    label: "Duo",
    hint: "Hôte à gauche · grille invités à droite",
  },
  {
    id: "board",
    label: "Grille",
    hint: "Hôte + cases invités en plateau",
  },
] as const;

export type LiveStageLayoutId = (typeof LIVE_STAGE_LAYOUTS)[number]["id"];

export function isLiveStageLayoutId(v: unknown): v is LiveStageLayoutId {
  return (
    typeof v === "string" &&
    LIVE_STAGE_LAYOUTS.some((l) => l.id === v)
  );
}

export function normalizeStageLayout(v: unknown): LiveStageLayoutId {
  return isLiveStageLayoutId(v) ? v : "rail";
}
