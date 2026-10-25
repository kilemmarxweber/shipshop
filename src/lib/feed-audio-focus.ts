"use client";

import { useEffect, useState } from "react";
import {
  getPageMediaRoute,
  isPageMediaDocumentVisible,
  subscribePageMedia,
  usePageMediaLive,
} from "@/lib/page-media-session";
import {
  SOUND_UNLOCK_EVENT,
  bumpFeedPlayGeneration,
  canAttemptUnmute,
  isFeedSoundLive,
  noteUnmutedPlayOk,
  pickCardSoundSource,
  pickFrontRowLeft,
  playFirstVisibleFeedSound,
  silenceFeedMediaExcept,
  haltTrackedFeedMedia,
  isIosDevice,
  tryPlayMedia,
} from "@/lib/try-play-media";

/**
 * Un seul son dans le feed : vidéo ou soundtrack.
 * 1) Snap Pour toi : la card active (index) gagne — ferme la précédente au scroll.
 * 2) Sinon IO : card la plus visible / à gauche (Découvrir, grilles).
 * 3) Tap : pin jusqu’au prochain scroll / sortie d’écran.
 */
const VISIBLE_RATIO = 0.4;
const KEEP_PIN_RATIO = 0.22;

type Score = { ratio: number; left: number; top: number; page: string };
type Listener = (activeId: string | null) => void;

const scores = new Map<string, Score>();
const listeners = new Set<Listener>();
let pinnedId: string | null = null;
/** Priorité TikTok (Pour toi / Abonnements) — une card = un son. */
let snapPreferredId: string | null = null;
let activeId: string | null = null;
let pageMediaBound = false;
/** Overlay (popup Acheter) : mute le fil sans perdre la card pinnée. */
let audioHeld = false;
let muteRaf = 0;
let pendingMute = false;

function ensurePageMediaBinding() {
  if (pageMediaBound) return;
  pageMediaBound = true;
  subscribePageMedia(() => commit());
}

function pickWinner(): string | null {
  if (!isPageMediaDocumentVisible()) return null;
  const page = getPageMediaRoute();

  // Tap son : prioritaire tant que la card est encore un peu visible
  if (pinnedId) {
    const pin = scores.get(pinnedId);
    if (pin && pin.page === page && pin.ratio >= KEEP_PIN_RATIO) {
      return pinnedId;
    }
    pinnedId = null;
  }

  // Snap feed : index actif = source audio (pas de flicker mid-scroll IO)
  if (snapPreferredId) {
    const snapScore = scores.get(snapPreferredId);
    if (snapScore && snapScore.page === page && snapScore.ratio >= 0.08) {
      return snapPreferredId;
    }
    if (typeof document !== "undefined") {
      const el = document.querySelector(
        `[data-audio-key="${CSS.escape(snapPreferredId)}"]`,
      );
      if (el) return snapPreferredId;
    }
  }

  const visible = [...scores.entries()].filter(
    ([, s]) => s.page === page && s.ratio >= VISIBLE_RATIO,
  );
  if (visible.length === 0) return null;
  const front = pickFrontRowLeft(
    visible.map(([id, s]) => ({
      id,
      top: s.top,
      left: s.left,
      score: s.ratio,
    })),
  );
  return front?.id ?? null;
}

function applyDomMuteNow() {
  if (typeof document === "undefined") return;
  const card =
    !audioHeld && activeId
      ? document.querySelector(`[data-audio-key="${CSS.escape(activeId)}"]`)
      : null;
  const keep = card ? pickCardSoundSource(card) : null;
  silenceFeedMediaExcept(keep);
  if (!keep) return;
  if (!canAttemptUnmute()) {
    keep.dataset.wantSound = "1";
    keep.muted = true;
    void keep.play().catch(() => undefined);
    return;
  }
  if (!keep.paused && !keep.muted) {
    keep.dataset.wantSound = "1";
    noteUnmutedPlayOk();
    return;
  }
  void tryPlayMedia(keep, true).then((ok) => {
    if (ok) noteUnmutedPlayOk();
  });
}

/** Coalesce DOM mute/play — évite play/pause en rafale pendant le scroll. */
function scheduleDomMute() {
  pendingMute = true;
  if (muteRaf) return;
  muteRaf = requestAnimationFrame(() => {
    muteRaf = 0;
    if (!pendingMute) return;
    pendingMute = false;
    applyDomMuteNow();
  });
}

function commit() {
  const next = audioHeld ? null : pickWinner();
  const changed = next !== activeId;
  if (changed) {
    bumpFeedPlayGeneration();
    activeId = next;
    scheduleDomMute();
    for (const listener of listeners) listener(activeId);
    return;
  }
  if (!next || !canAttemptUnmute()) return;
  const card = document.querySelector(
    `[data-audio-key="${CSS.escape(next)}"]`,
  );
  const keep = pickCardSoundSource(card);
  if (keep && (keep.paused || keep.muted)) scheduleDomMute();
}

/**
 * Fil snap (Pour toi) : la card à cet index porte le son.
 * Au changement d’index → coupe la précédente, ouvre la suivante.
 */
export function setFeedSnapAudioFocus(id: string | null) {
  ensurePageMediaBinding();
  if (snapPreferredId === id) {
    if (id) scheduleDomMute();
    return;
  }
  snapPreferredId = id;
  pinnedId = null;
  commit();
}

/** Mute le fil (popup ouvert). Relâche pour redémarrer le son. */
export function holdFeedAudio(held: boolean) {
  ensurePageMediaBinding();
  if (audioHeld === held) return;
  audioHeld = held;
  if (held) silenceFeedMediaExcept(null);
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
  snapPreferredId = null;
  bumpFeedPlayGeneration();
  if (muteRaf) {
    cancelAnimationFrame(muteRaf);
    muteRaf = 0;
  }
  pendingMute = false;
  if (isIosDevice()) haltTrackedFeedMedia();
  silenceFeedMediaExcept(null);
  if (activeId === null) return;
  activeId = null;
  for (const listener of listeners) listener(null);
}

export function useFeedAudioFocus() {
  const live = usePageMediaLive();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    return subscribeFeedAudioFocus(setId);
  }, []);
  return live ? id : null;
}

/** Retour sur le fil : focus son sur la card visible (lecture depuis le début). */
export function useResumeFeedSoundWhenVisible() {
  const live = usePageMediaLive();
  useEffect(() => {
    if (!live) return;
    const timer = window.setTimeout(() => {
      const key = playFirstVisibleFeedSound();
      if (key) requestFeedAudioFocus(key);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [live]);
}

/** Android/desktop : on d’emblée. iOS : après le clic fil. Mute volume : off. */
export function useFeedSoundLive() {
  const [on, setOn] = useState(() =>
    typeof window === "undefined" ? false : isFeedSoundLive(),
  );
  const [kick, setKick] = useState(0);
  useEffect(() => {
    let last = isFeedSoundLive();
    setOn(last);
    const sync = () => {
      const next = isFeedSoundLive();
      if (next === last) return;
      last = next;
      setOn(next);
      setKick((n) => n + 1);
    };
    window.addEventListener(SOUND_UNLOCK_EVENT, sync);
    return () => window.removeEventListener(SOUND_UNLOCK_EVENT, sync);
  }, []);
  return { live: on, kick };
}
