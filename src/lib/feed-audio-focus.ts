"use client";

import { useEffect, useState } from "react";
import {
  getPageMediaRoute,
  isPageMediaDocumentVisible,
  subscribePageMedia,
  usePageMediaLive,
} from "@/lib/page-media-session";
import {
  FEED_ROW_PX,
  SOUND_UNLOCK_EVENT,
  isFeedSoundLive,
  pickFrontRowLeft,
} from "@/lib/try-play-media";

/**
 * Un seul son dans le feed : vidéo ou soundtrack.
 * 1) Sans tap : card visible la plus à gauche.
 * 2) Tap sur une card muette qui a du son : elle reste seule jusqu’à un tap sur une autre, ou sortie d’écran.
 */
const VISIBLE_RATIO = 0.4;
const KEEP_PIN_RATIO = 0.22;

type Score = { ratio: number; left: number; top: number; page: string };
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
    pinnedId = null;
    return null;
  }
  const front = pickFrontRowLeft(
    visible.map(([id, s]) => ({
      id,
      top: s.top,
      left: s.left,
      score: s.ratio,
    })),
  );
  const frontLeft = front?.id ?? null;
  const pin = pinnedId ? scores.get(pinnedId) : undefined;
  if (
    pin &&
    pinnedId &&
    pin.page === page &&
    pin.ratio >= KEEP_PIN_RATIO &&
    front &&
    Math.abs(pin.top - front.top) < FEED_ROW_PX
  ) {
    return pinnedId;
  }
  if (pinnedId) pinnedId = null;
  return frontLeft;
}

function applyDomMute() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio, video").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    if (node.dataset.scrollAd === "1") return;
    const key = node
      .closest("[data-audio-key]")
      ?.getAttribute("data-audio-key");
    const iconOn = Boolean(node.closest("[data-feed-sound-on]"));
    const live = Boolean(
      !audioHeld && isFeedSoundLive() && iconOn && activeId && key === activeId,
    );
    if (live) return;
    node.muted = true;
    node.dataset.wantSound = "0";
    if (node instanceof HTMLAudioElement) node.pause();
  });
}

function commit() {
  const next = audioHeld ? null : pickWinner();
  const changed = next !== activeId;
  activeId = next;
  applyDomMute();
  if (!changed) return;
  for (const listener of listeners) listener(activeId);
}

/** Mute le fil (popup ouvert). Relâche pour redémarrer le son. */
export function holdFeedAudio(held: boolean) {
  ensurePageMediaBinding();
  if (audioHeld === held) return;
  audioHeld = held;
  if (held && typeof document !== "undefined") {
    document.querySelectorAll("audio, video").forEach((node) => {
      if (!(node instanceof HTMLMediaElement)) return;
      if (node.dataset.scrollAd === "1") return;
      node.muted = true;
    });
  }
  commit();
}

export function setFeedAudioScore(
  id: string,
  score: { ratio: number; left: number; top?: number },
  page = getPageMediaRoute(),
) {
  ensurePageMediaBinding();
  if (score.ratio < 0.12) {
    scores.delete(id);
    if (pinnedId === id) pinnedId = null;
  } else {
    scores.set(id, {
      ratio: score.ratio,
      left: score.left,
      top: score.top ?? scores.get(id)?.top ?? 0,
      page,
    });
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
    ratio: Math.max(prev?.ratio ?? 0, 0.5),
    left: prev?.left ?? 0,
    top: prev?.top ?? 0,
    page: prev?.page ?? getPageMediaRoute(),
  });
  commit();
}

/** Relâche le pin (2e tap) : le premier plan visible reprend. */
export function unpinFeedAudio() {
  pinnedId = null;
  commit();
}

export function getPinnedFeedAudioId() {
  return pinnedId;
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
      if (listeners.size === 0) resetFeedAudioFocus();
    };
  }, []);
  return live ? id : null;
}

/** Android/desktop : on d’emblée. iOS : après le clic fil. Mute volume : off. */
export function useFeedSoundLive() {
  const [on, setOn] = useState(false);
  const [kick, setKick] = useState(0);
  useEffect(() => {
    const sync = () => {
      setOn(isFeedSoundLive());
      setKick((n) => n + 1);
    };
    sync();
    window.addEventListener(SOUND_UNLOCK_EVENT, sync);
    return () => window.removeEventListener(SOUND_UNLOCK_EVENT, sync);
  }, []);
  return { live: on, kick };
}
