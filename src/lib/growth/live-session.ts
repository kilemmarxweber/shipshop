/** Règles live : heartbeat, pause connexion, fin auto après 10 min. */

export const LIVE_PAUSE_TIMEOUT_MS = 10 * 60 * 1000;
/** Sans heartbeat host → pause « connexion ». */
export const LIVE_HEARTBEAT_STALE_MS = 25_000;
export const LIVE_DEFAULT_PLANNED_MINUTES = 60;
export const LIVE_PROLONG_MINUTES = 15;
/** Alerte host avant la fin prévue. */
export const LIVE_END_ALERT_BEFORE_MS = 5 * 60 * 1000;

/** Poll room visible — assez frais sans saturer API / DB. */
export const LIVE_POLL_MS = 4_000;
/** Poll quand onglet en arrière-plan (scroll ailleurs / app switch). */
export const LIVE_POLL_HIDDEN_MS = 20_000;
export const LIVE_HEARTBEAT_MS = 8_000;
/** Heartbeat ralenti hors écran — reste sous LIVE_HEARTBEAT_STALE_MS. */
export const LIVE_HEARTBEAT_HIDDEN_MS = 18_000;

export type LiveStatus = "LIVE" | "PAUSED" | "ENDED";
export type LivePauseReason = "connection" | "host" | "system";
export type LiveEndReason =
  | "normal"
  | "pause_timeout"
  | "host"
  | "connection";

export function livePauseMessage(reason: string | null | undefined) {
  if (reason === "connection") {
    return "Live en pause — connexion du diffuseur instable.";
  }
  if (reason === "host") {
    return "Live en pause — le diffuseur a mis le direct en attente.";
  }
  return "Live en pause temporairement.";
}

export function liveEndMessage(reason: string | null | undefined) {
  if (reason === "pause_timeout") {
    return "Live terminé automatiquement : pause trop longue (10 min) — problème côté diffuseur.";
  }
  if (reason === "connection") {
    return "Live terminé — problème de connexion du diffuseur.";
  }
  if (reason === "host") {
    return "Le diffuseur a terminé le live.";
  }
  return "Live terminé.";
}

export function formatLiveClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
