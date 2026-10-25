/** Règles live : heartbeat, pause connexion, fin auto après 10 min. */

export const LIVE_PAUSE_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Sans heartbeat host → pause « connexion ».
 * Large : Chrome throttle les timers d’onglet caché (~1 min) — rester au-dessus.
 */
export const LIVE_HEARTBEAT_STALE_MS = 90_000;
export const LIVE_DEFAULT_PLANNED_MINUTES = 60;
export const LIVE_PROLONG_MINUTES = 15;
/** Alerte host avant la fin prévue. */
export const LIVE_END_ALERT_BEFORE_MS = 5 * 60 * 1000;

/** Après ce délai sans assez d’interactions → alerte host (live peu engageant). */
export const LIVE_ENGAGEMENT_GRACE_MS = 3 * 60 * 1000;
/** Seuils minimums (l’un d’eux suffit pour « ok »). */
export const LIVE_ENGAGEMENT_MIN_LIKES = 8;
export const LIVE_ENGAGEMENT_MIN_CHATS = 4;
/** Max j’aime / viewer / minute (anti-spam serveur). */
export const LIVE_LIKE_RATE_PER_MIN = 40;

/** Poll room visible — assez frais sans saturer API / DB. */
export const LIVE_POLL_MS = 4_000;
/** Poll quand onglet en arrière-plan (scroll ailleurs / app switch). */
export const LIVE_POLL_HIDDEN_MS = 20_000;
export const LIVE_HEARTBEAT_MS = 8_000;
/** Heartbeat hors écran — reste sous LIVE_HEARTBEAT_STALE_MS malgré le throttle Chrome. */
export const LIVE_HEARTBEAT_HIDDEN_MS = 22_000;

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
