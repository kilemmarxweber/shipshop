"use client";

import { useEffect, useState } from "react";
import {
  getPageMediaRoute,
  isPageMediaDocumentVisible,
  subscribePageMedia,
  usePageMediaLive,
} from "@/lib/page-media-session";

/**
 * Un seul son dans le feed : vidéo ou soundtrack.
 * Visible à gauche par défaut ; un tap pinne cette card jusqu’à sortie d’écran.
 */
const VISIBLE_RATIO = 0.4;
const KEEP_PIN_RATIO = 0.22;

type Score = { ratio: number; left: number; page: string };
type Listener = (activeId: string | null) => void;

const scores = new Map<string, Score>();
const listeners = new Set<Listener>();
let pinnedId: string | null = null;
let activeId: string | null = null;
let pageMediaBound = false;
/** Overlay (popup Acheter) : mute le fil sans perdre la card pinnée. */
let audioHeld = false;

function ensurePageMediaBinding() {
  if (pageMediaBound) return;
  pageMediaBound = true;
  subscribePageMedia(() => commit());
}

function pickWinner(): string | null {
  if (!isPageMediaDocumentVisible()) return null;
  const page = getPageMediaRoute();
  const visible = [...scores.entries()].filter(
    ([, s]) => s.page === page && s.ratio >= VISIBLE_RATIO,
  );
  if (visible.length === 0) {
    const pin = pinnedId ? scores.get(pinnedId) : undefined;
    if (pin && pin.page === page && pin.ratio >= KEEP_PIN_RATIO) {
      return pinnedId;
    }
    pinnedId = null;
    return null;
  }
  visible.sort((a, b) => {
    const dx = a[1].left - b[1].left;
    if (Math.abs(dx) > 8) return dx;
    return b[1].ratio - a[1].ratio;
  });
  const bestId = visible[0]![0];
  const best = visible[0]![1];
  const pin = pinnedId ? scores.get(pinnedId) : undefined;
  // Pin seulement si la card tapée est encore celle au premier plan.
  // En remontant le fil, une autre card plus visible reprend le son.
  if (
    pin &&
    pin.page === page &&
    pin.ratio >= KEEP_PIN_RATIO &&
    pinnedId === bestId
  ) {
    return pinnedId;
  }
  if (
    pin &&
    pin.page === page &&
    pin.ratio >= KEEP_PIN_RATIO &&
    pin.ratio + 0.12 >= best.ratio
  ) {
    return pinnedId;
  }
  pinnedId = null;
  return bestId;
}

function commit() {
  const next = audioHeld ? null : pickWinner();
  if (next === activeId) return;
  activeId = next;
  for (const listener of listeners) listener(activeId);
}

/** Mute le fil (popup ouvert). Relâche pour redémarrer le son. */
export function holdFeedAudio(held: boolean) {
  ensurePageMediaBinding();
  if (audioHeld === held) return;
  audioHeld = held;
  if (held && typeof document !== "undefined") {
    document.querySelectorAll("audio, video").forEach((node) => {
      if (node instanceof HTMLMediaElement) node.muted = true;
    });
  }
  commit();
}

export function setFeedAudioScore(
  id: string,
  score: { ratio: number; left: number },
  page = getPageMediaRoute(),
) {
  ensurePageMediaBinding();
  if (score.ratio < 0.12) {
    scores.delete(id);
    if (pinnedId === id) pinnedId = null;
  } else {
    scores.set(id, { ...score, page });
  }
  commit();
}

export function clearFeedAudioScore(id: string) {
  scores.delete(id);
  if (pinnedId === id) pinnedId = null;
  commit();
}

/** Tap / bouton son : cette card devient la seule source audio. */
export function requestFeedAudioFocus(id: string) {
  ensurePageMediaBinding();
  pinnedId = id;
  const prev = scores.get(id);
  scores.set(id, {
    ratio: Math.max(prev?.ratio ?? 0, 0.99),
    left: prev?.left ?? 0,
    page: prev?.page ?? getPageMediaRoute(),
  });
  commit();
}

/** Relâche le pin (2e tap) : le premier plan visible reprend. */
export function unpinFeedAudio() {
  pinnedId = null;
  commit();
}

export function subscribeFeedAudioFocus(listener: Listener) {
  listeners.add(listener);
  listener(activeId);
  return () => {
    listeners.delete(listener);
  };
}

/** Quitter le feed / changer d’onglet : oublier pin + mute. */
export function resetFeedAudioFocus() {
  scores.clear();
  pinnedId = null;
  if (activeId === null) return;
  activeId = null;
  for (const listener of listeners) listener(null);
}

export function useFeedAudioFocus() {
  const live = usePageMediaLive();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const unsub = subscribeFeedAudioFocus(setId);
    return () => {
      unsub();
      resetFeedAudioFocus();
    };
  }, []);
  return live ? id : null;
}
