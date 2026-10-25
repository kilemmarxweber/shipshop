import {
  LIVE_ENGAGEMENT_GRACE_MS,
  LIVE_ENGAGEMENT_MIN_CHATS,
  LIVE_ENGAGEMENT_MIN_LIKES,
} from "@/lib/growth/live-session";

export type LiveEngagementSnapshot = {
  /** true = assez d’interactions (likes / chat / cadeaux / invités) */
  ok: boolean;
  /** true = alerter le host (après période de grâce) */
  warn: boolean;
  likes: number;
  chats: number;
  giftCents: number;
  guestsOnStage: number;
  elapsedMs: number;
  graceMs: number;
  message: string | null;
};

/**
 * Mesure l’engagement d’un live pour prévenir le host
 * si trop peu de réactions (j’aime, chat, cadeaux, scènes).
 */
export function computeLiveEngagement(input: {
  startedAt: Date | string;
  status: string;
  likeCount?: number | null;
  chatCount?: number | null;
  giftCents?: number | null;
  guestsOnStage?: number | null;
  now?: number;
}): LiveEngagementSnapshot {
  const now = input.now ?? Date.now();
  const started = new Date(input.startedAt).getTime();
  const elapsedMs = Math.max(0, now - started);
  const likes = Math.max(0, input.likeCount ?? 0);
  const chats = Math.max(0, input.chatCount ?? 0);
  const giftCents = Math.max(0, input.giftCents ?? 0);
  const guestsOnStage = Math.max(0, input.guestsOnStage ?? 0);

  const ok =
    likes >= LIVE_ENGAGEMENT_MIN_LIKES ||
    chats >= LIVE_ENGAGEMENT_MIN_CHATS ||
    giftCents > 0 ||
    guestsOnStage > 0;

  const pastGrace =
    input.status === "LIVE" && elapsedMs >= LIVE_ENGAGEMENT_GRACE_MS;
  const warn = pastGrace && !ok;

  return {
    ok,
    warn,
    likes,
    chats,
    giftCents,
    guestsOnStage,
    elapsedMs,
    graceMs: LIVE_ENGAGEMENT_GRACE_MS,
    message: warn
      ? "Peu d’interactions (j’aime, chat, cadeaux). Animez le live — un direct trop silencieux risque d’être interrompu."
      : null,
  };
}
