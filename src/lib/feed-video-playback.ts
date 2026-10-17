/**
 * Lecture feed type TikTok :
 * - mobile (< md) : 1 card la plus visible
 * - tablette / desktop (md+) : jusqu’à 2 cards côte à côte
 * - clic : force la lecture de cette card (pin jusqu’à sortie d’écran)
 */

const MD_MIN_PX = 768;
const PLAY_RATIO = 0.45;

type Listener = (activeIds: ReadonlySet<string>) => void;

const scores = new Map<string, number>();
const pinned = new Set<string>();
const listeners = new Set<Listener>();
let activeIds = new Set<string>();
let resizeBound = false;

function maxSlots() {
  if (typeof window === "undefined") return 1;
  return window.matchMedia(`(min-width: ${MD_MIN_PX}px)`).matches ? 2 : 1;
}

function ensureResizeListener() {
  if (resizeBound || typeof window === "undefined") return;
  resizeBound = true;
  window.addEventListener("resize", () => {
    pickWinners();
  });
}

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function notify() {
  for (const listener of listeners) listener(activeIds);
}

function pickWinners() {
  ensureResizeListener();
  const slots = maxSlots();
  const next = new Set<string>();

  // Pins d’abord (clic utilisateur), tant qu’encore un peu visibles
  const pinnedRanked = [...pinned]
    .map((id) => [id, scores.get(id) ?? 0] as const)
    .filter(([, ratio]) => ratio >= 0.2)
    .sort((a, b) => b[1] - a[1]);

  for (const [id] of pinnedRanked) {
    if (next.size >= slots) break;
    next.add(id);
  }

  const ranked = [...scores.entries()]
    .filter(([id, ratio]) => ratio >= PLAY_RATIO && !next.has(id))
    .sort((a, b) => b[1] - a[1]);

  for (const [id] of ranked) {
    if (next.size >= slots) break;
    next.add(id);
  }

  if (!sameSet(activeIds, next)) {
    activeIds = next;
    notify();
  }
}

export function setFeedVideoScore(id: string, ratio: number) {
  if (ratio < 0.2) {
    scores.delete(id);
    pinned.delete(id);
  } else {
    scores.set(id, ratio);
  }
  pickWinners();
}

export function clearFeedVideoScore(id: string) {
  scores.delete(id);
  pinned.delete(id);
  pickWinners();
}

/** Clic sur une vidéo → priorise cette card dans les slots de lecture. */
export function requestFeedVideoPlay(id: string) {
  pinned.add(id);
  const current = scores.get(id) ?? 0;
  scores.set(id, Math.max(current, 0.99));
  pickWinners();
}

export function subscribeFeedVideoActive(listener: Listener) {
  listeners.add(listener);
  listener(activeIds);
  return () => {
    listeners.delete(listener);
  };
}

export function isFeedVideoActive(
  id: string,
  active: ReadonlySet<string> | string | null,
) {
  if (active instanceof Set) return active.has(id);
  return active === id;
}
