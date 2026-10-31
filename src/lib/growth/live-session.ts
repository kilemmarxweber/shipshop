/** Règles live : heartbeat, pause connexion, fin auto. */

/**
 * Après ce délai en pause → fin automatique du live.
 * 30 min : laisse le temps au diffuseur de récupérer (perte réseau, mobile,
 * CPU throttle…) sans couper abruptement un live à millions de viewers.
 */
export const LIVE_PAUSE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Sans heartbeat host → pause « connexion ».
 * 3 min : absorbe les throttles Chrome/Safari (onglet caché ≈ 1 beat/min),
 * les micro-coupures réseau mobile et les CPU bursts sans faux positif.
 * On peut manquer ~4 beats visibles ou ~3 beats cachés avant d'alerter.
 */
export const LIVE_HEARTBEAT_STALE_MS = 3 * 60 * 1000;

export const LIVE_DEFAULT_PLANNED_MINUTES = 60;
export const LIVE_PROLONG_MINUTES = 15;
/** Alerte host avant la fin prévue. */
export const LIVE_END_ALERT_BEFORE_MS = 5 * 60 * 1000;

/** Après ce délai sans assez d'interactions → alerte host (live peu engageant). */
export const LIVE_ENGAGEMENT_GRACE_MS = 3 * 60 * 1000;
/** Seuils minimums (l'un d'eux suffit pour « ok »). */
export const LIVE_ENGAGEMENT_MIN_LIKES = 8;
export const LIVE_ENGAGEMENT_MIN_CHATS = 4;
/** Max j'aime / viewer / minute (anti-spam serveur). */
export const LIVE_LIKE_RATE_PER_MIN = 40;

/** Poll room visible — assez frais sans saturer API / DB. */
export const LIVE_POLL_MS = 4_000;
/** Poll quand onglet en arrière-plan (scroll ailleurs / app switch). */
export const LIVE_POLL_HIDDEN_MS = 20_000;

/**
 * Heartbeat onglet visible.
 * 15 s → 12 beats/min, bien en dessous du seuil stale (3 min).
 * Même 10 beats consécutifs ratés ne déclenchent pas de pause.
 */
export const LIVE_HEARTBEAT_MS = 15_000;

/**
 * Heartbeat onglet caché.
 * Chrome/Safari throttlent à ~1 beat/min sur mobile ; on vise 45 s pour
 * laisser 4 fenêtres avant le seuil stale de 3 min.
 */
export const LIVE_HEARTBEAT_HIDDEN_MS = 45_000;

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
    return "Live terminé automatiquement : pause trop longue (30 min) — problème côté diffuseur.";
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
