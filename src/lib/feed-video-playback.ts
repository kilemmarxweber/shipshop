/**
 * Lecture feed type TikTok :
 * - mobile (< md) : 1 card la plus visible
 * - tablette / desktop (md+) : jusqu’à 2 cards côte à côte
 * - clic : force la lecture de cette card (pin jusqu’à sortie d’écran)
 */

import {
  getPageMediaRoute,
  isPageMediaDocumentVisible,
  subscribePageMedia,
} from "@/lib/page-media-session";

const MD_MIN_PX = 768;
const PLAY_RATIO = 0.45;

type Listener = (activeIds: ReadonlySet<string>) => void;
type Score = { ratio: number; page: string };

const scores = new Map<string, Score>();
const pinned = new Set<string>();
const listeners = new Set<Listener>();
let activeIds = new Set<string>();
let resizeBound = false;
let pageMediaBound = false;

function ensurePageMediaBinding() {
  if (pageMediaBound) return;
  pageMediaBound = true;
  subscribePageMedia(() => pickWinners());
}

function maxSlots() {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia(`(min-width: ${MD_MIN_PX}px)`).matches) return 2;
  if (
    window.matchMedia("(orientation: landscape) and (min-width: 640px)")
      .matches
  ) {
    return 2;
  }
  return 1;
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
  ensurePageMediaBinding();
  const next = new Set<string>();
  if (!isPageMediaDocumentVisible()) {
    if (!sameSet(activeIds, next)) {
      activeIds = next;
      notify();
    }
    return;
  }

  const page = getPageMediaRoute();
  const slots = maxSlots();

  // Pins d’abord (clic utilisateur), tant qu’encore un peu visibles
  const pinnedRanked = [...pinned]
    .map((id) => [id, scores.get(id)] as const)
    .filter((row): row is readonly [string, Score] => {
      const s = row[1];
      return Boolean(s && s.page === page && s.ratio >= 0.2);
    })
    .sort((a, b) => b[1].ratio - a[1].ratio);

  for (const [id] of pinnedRanked) {
    if (next.size >= slots) break;
    next.add(id);
  }

  const ranked = [...scores.entries()]
    .filter(
      ([id, s]) => s.page === page && s.ratio >= PLAY_RATIO && !next.has(id),
    )
    .sort((a, b) => b[1].ratio - a[1].ratio);

  for (const [id] of ranked) {
    if (next.size >= slots) break;
    next.add(id);
  }

  if (!sameSet(activeIds, next)) {
    activeIds = next;
    notify();
  }
}

export function setFeedVideoScore(
  id: string,
  ratio: number,
  page = getPageMediaRoute(),
) {
  ensurePageMediaBinding();
  if (ratio < 0.2) {
    scores.delete(id);
    pinned.delete(id);
  } else {
    scores.set(id, {
      ratio,
      page: scores.get(id)?.page ?? page,
    });
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
  ensurePageMediaBinding();
  pinned.add(id);
  const current = scores.get(id);
  scores.set(id, {
    ratio: Math.max(current?.ratio ?? 0, 0.99),
    page: current?.page ?? getPageMediaRoute(),
  });
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
