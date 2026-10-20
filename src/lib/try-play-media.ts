/**
 * Autoplay dès qu’une card est visible (Android / desktop).
 * iOS reste muet tant qu’Apple n’a pas un geste.
 * Clic Accueil / Découvrir / Pour toi / Abonnements : démute la card visible.
 */

export const SOUND_UNLOCK_EVENT = "ss:sound-unlocked";

const waitingSound = new Set<HTMLMediaElement>();
/** iOS : un play() en vol survit au démontage de la card. */
const trackedMedia = new Set<HTMLMediaElement>();
let mediaEpoch = 0;
let soundUnlocked = false;
let unlockArmed = false;
/** Clic fil / volume on. */
let userEnabledSound = false;
/** Bouton volume off : coupe l’autoplay aussi. */
let userMutedSound = false;
/** Un play() unmuted a vraiment réussi. */
let unmutedPlayOk = false;
let lastNotifiedLive: boolean | null = null;
let notifyQueued = false;

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isFeedSoundUnlocked() {
  return soundUnlocked;
}

/** Card dont le média joue vraiment avec le son (pas seulement l’icône). */
export function getLiveUnmutedFeedKey(): string | null {
  if (typeof document === "undefined") return null;
  for (const node of document.querySelectorAll("audio, video")) {
    if (!(node instanceof HTMLMediaElement)) continue;
    if (node.dataset.scrollAd === "1") continue;
    if (node.muted || node.paused) continue;
    const key =
      node.closest("[data-audio-key]")?.getAttribute("data-audio-key") ??
      node.getAttribute("data-audio-key");
    if (key) return key;
  }
  return null;
}

function isFeedMedia(node: Element): node is HTMLMediaElement {
  return (
    node instanceof HTMLMediaElement && node.dataset.scrollAd !== "1"
  );
}

function cardRootFor(el: Element | null): Element | null {
  return (
    el?.closest("[data-audio-key], .feed-snap-item, [data-feed-card]") ?? el
  );
}

/** Soundtrack prioritaire ; sinon la vidéo en lecture. Un seul élément par card. */
export function pickCardSoundSource(root: Element | null): HTMLMediaElement | null {
  if (!root) return null;
  const nodes = [...root.querySelectorAll("audio, video")].filter(isFeedMedia);
  const audio = nodes.find(
    (n) => n instanceof HTMLAudioElement && Boolean(n.getAttribute("src") || n.src),
  );
  if (audio) return audio;
  const videos = nodes.filter((n) => n instanceof HTMLVideoElement);
  return (
    videos.find((n) => !n.paused && Boolean(n.src)) ??
    videos.find((n) => Boolean(n.src)) ??
    videos[0] ??
    null
  );
}

function isPlayingUnmuted(el: HTMLMediaElement) {
  return !el.muted && !el.paused;
}

function rewindMedia(node: HTMLMediaElement) {
  try {
    if (node.currentTime > 0.04) node.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function haltMediaNode(node: HTMLMediaElement) {
  node.dataset.wantSound = "0";
  waitingSound.delete(node);
  if (!node.muted) node.muted = true;
  if (!node.paused) node.pause();
}

function trackFeedMedia(el: HTMLMediaElement) {
  trackedMedia.add(el);
}

/** iPhone : coupe aussi les médias déjà retirés du DOM (l’audio continue sinon). */
export function haltTrackedFeedMedia() {
  mediaEpoch += 1;
  waitingSound.clear();
  for (const node of trackedMedia) {
    try {
      haltMediaNode(node);
    } catch {
      /* ignore */
    }
  }
  trackedMedia.clear();
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio, video").forEach((node) => {
    if (!(node instanceof HTMLMediaElement) || node.dataset.scrollAd === "1") {
      return;
    }
    haltMediaNode(node);
  });
}

/** Un seul son : mute (et pause audio) tout sauf `keep`. Ne touche pas `keep`. */
export function silenceFeedMediaExcept(keep: HTMLMediaElement | null) {
  if (typeof document === "undefined") return;
  const ios = isIosDevice();
  document.querySelectorAll("audio, video").forEach((node) => {
    if (!isFeedMedia(node) || node === keep) return;
    const alreadyOff =
      node.muted &&
      node.dataset.wantSound === "0" &&
      (node instanceof HTMLAudioElement ? node.paused : true) &&
      (!ios || node.paused);
    if (!alreadyOff) {
      node.muted = true;
      node.dataset.wantSound = "0";
      waitingSound.delete(node);
      if (node instanceof HTMLAudioElement && !node.paused) node.pause();
      if (ios && node instanceof HTMLVideoElement && !node.paused) node.pause();
    }
    rewindMedia(node);
  });
}

function confirmUnmutedPlay(el: HTMLMediaElement) {
  if (!isPlayingUnmuted(el)) return false;
  unmutedPlayOk = true;
  notifySound();
  return true;
}

/** Son live seulement si un média n’est pas muet et joue. */
export function isFeedSoundLive() {
  if (userMutedSound) return false;
  if (isIosDevice() && !(soundUnlocked && userEnabledSound)) return false;
  return getLiveUnmutedFeedKey() !== null;
}

function hasStickyMediaActivation() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userActivation;
  return Boolean(ua?.isActive || ua?.hasBeenActive);
}

export function canAttemptUnmute() {
  if (userMutedSound) return false;
  if (isIosDevice() && !userEnabledSound && !hasStickyMediaActivation()) {
    return false;
  }
  return true;
}

export function noteUnmutedPlayOk() {
  if (userMutedSound) return;
  if (typeof document !== "undefined") {
    for (const node of document.querySelectorAll("audio, video")) {
      if (!(node instanceof HTMLMediaElement)) continue;
      if (node.dataset.scrollAd === "1") continue;
      if (!node.muted && !node.paused) {
        unmutedPlayOk = true;
        notifySound();
        return;
      }
    }
  }
}

function notifySound() {
  if (typeof window === "undefined" || notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    const live = isFeedSoundLive();
    if (live === lastNotifiedLive) return;
    lastNotifiedLive = live;
    window.dispatchEvent(new Event(SOUND_UNLOCK_EVENT));
  });
}

/** Deux cards côte à côte : même rangée si le top est proche. */
export const FEED_ROW_PX = 96;

/** Rangée la plus visible, puis card de gauche. */
export function pickFrontRowLeft<T extends { top: number; left: number; score: number }>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  const rows: T[][] = [];
  for (const item of [...items].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(r[0]!.top - item.top) < FEED_ROW_PX);
    if (row) row.push(item);
    else rows.push([item]);
  }
  let best = rows[0]!;
  let bestScore = -1;
  for (const row of rows) {
    const score = Math.max(...row.map((c) => c.score));
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  best.sort((a, b) => a.left - b.left);
  return best[0] ?? null;
}

/** 1re card vraiment à l’écran (gauche de la rangée). Sinon on attend. */
export function playFirstVisibleFeedSound(): string | null {
  if (typeof document === "undefined") return null;
  const vh = window.innerHeight;
  const cards = [
    ...document.querySelectorAll<HTMLElement>(
      ".feed-snap-item, [data-feed-card]",
    ),
  ];
  const ranked = cards
    .map((el) => {
      const r = el.getBoundingClientRect();
      const overlap = Math.max(
        0,
        Math.min(r.bottom, vh) - Math.max(r.top, 0),
      );
      return { el, overlap, top: r.top, left: r.left, score: overlap };
    })
    .filter((row) => row.overlap > 48);

  const winner = pickFrontRowLeft(ranked)?.el ?? null;

  const keep = pickCardSoundSource(winner);
  if (!keep) {
    notifySound();
    return (
      winner?.getAttribute("data-audio-key") ??
      winner?.querySelector("[data-audio-key]")?.getAttribute("data-audio-key") ??
      null
    );
  }
  if (canAttemptUnmute()) {
    void ensureExclusivePlay(keep);
  } else {
    keep.muted = true;
    keep.dataset.wantSound = "1";
    waitingSound.add(keep);
    void keep.play().catch(() => undefined);
    armFeedSoundUnlock();
  }

  return (
    winner?.getAttribute("data-audio-key") ??
    winner?.querySelector("[data-audio-key]")?.getAttribute("data-audio-key") ??
    null
  );
}

/** `playVisible` : autoplay card de gauche. false = clic sur une card précise. */
export function enableFeedSound(playVisible = true) {
  const before = isFeedSoundLive();
  userMutedSound = false;
  userEnabledSound = true;
  markUnlocked();
  if (isFeedSoundLive() !== before) notifySound();
  if (playVisible) playFirstVisibleFeedSound();
}

export function disableFeedSound() {
  userMutedSound = true;
  userEnabledSound = false;
  unmutedPlayOk = false;
  silenceFeedMediaExcept(null);
  notifySound();
}

function resumeWebAudio() {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

function stillWantsSound(el: HTMLMediaElement) {
  return el.dataset.wantSound !== "0";
}

async function ensureExclusivePlay(el: HTMLMediaElement) {
  const epoch = mediaEpoch;
  trackFeedMedia(el);
  el.dataset.wantSound = "1";
  if (isPlayingUnmuted(el)) {
    silenceFeedMediaExcept(el);
    unmutedPlayOk = true;
    notifySound();
    return true;
  }
  silenceFeedMediaExcept(el);
  if (el.paused) rewindMedia(el);
  el.muted = false;
  const playNow = el.play();
  try {
    await playNow;
    if (epoch !== mediaEpoch) {
      haltMediaNode(el);
      return false;
    }
    if (confirmUnmutedPlay(el)) return true;
  } catch {
    /* Chrome : autoplay son bloqué tant qu’il n’y a pas de geste */
  }
  if (epoch !== mediaEpoch) {
    haltMediaNode(el);
    return false;
  }
  el.muted = true;
  try {
    if (el.paused) await el.play();
  } catch {
    /* ignore */
  }
  if (epoch !== mediaEpoch) {
    haltMediaNode(el);
    return false;
  }
  waitingSound.add(el);
  armFeedSoundUnlock();
  return false;
}

function flushWaiting() {
  const queued = [...waitingSound].filter(
    (el) =>
      el.isConnected &&
      stillWantsSound(el) &&
      pickCardSoundSource(cardRootFor(el)) === el,
  );
  waitingSound.clear();
  const keep = queued[0] ?? null;
  if (!keep) return;
  void ensureExclusivePlay(keep);
}

function markUnlocked() {
  const first = !soundUnlocked;
  soundUnlocked = true;
  if (first) resumeWebAudio();
  flushWaiting();
  if (first) notifySound();
}

/** Premier geste Chrome/Android : play() dans le même tour (politique autoplay). */
function unlockFeedSoundFromGesture() {
  if (userMutedSound || isFeedSoundLive()) return;
  userEnabledSound = true;
  markUnlocked();
  playFirstVisibleFeedSound();
}

export function armFeedSoundUnlock() {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const onGesture = (event: Event) => {
    if (event instanceof KeyboardEvent && event.repeat) return;
    unlockFeedSoundFromGesture();
  };
  window.addEventListener("pointerdown", onGesture, opts);
  window.addEventListener("touchstart", onGesture, opts);
  window.addEventListener("keydown", onGesture, opts);
  requestAnimationFrame(() => {
    if (userMutedSound || isIosDevice()) return;
    playFirstVisibleFeedSound();
  });
}

export async function tryPlayMedia(
  el: HTMLMediaElement,
  wantSound: boolean,
) {
  const epoch = mediaEpoch;
  trackFeedMedia(el);
  const source = pickCardSoundSource(cardRootFor(el)) ?? el;
  if (wantSound && source !== el) {
    if (!el.muted) el.muted = true;
    el.dataset.wantSound = "0";
    waitingSound.delete(el);
    if (el instanceof HTMLVideoElement && el.paused) {
      try {
        await el.play();
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  el.dataset.wantSound = wantSound ? "1" : "0";
  if (
    !wantSound ||
    userMutedSound ||
    (isIosDevice() && !userEnabledSound)
  ) {
    waitingSound.delete(el);
    if (!el.muted) el.muted = true;
    el.dataset.wantSound = "0";
    if (el.paused) {
      try {
        await el.play();
        return !wantSound;
      } catch {
        return false;
      }
    }
    return !wantSound;
  }

  if (isPlayingUnmuted(el)) {
    silenceFeedMediaExcept(el);
    unmutedPlayOk = true;
    waitingSound.delete(el);
    notifySound();
    return true;
  }

  const ok = await ensureExclusivePlay(el);
  if (epoch !== mediaEpoch) {
    haltMediaNode(el);
    return false;
  }
  if (ok) {
    markUnlocked();
    waitingSound.delete(el);
    return true;
  }

  if (!el.muted) el.muted = true;
  if (el.paused) {
    try {
      await el.play();
    } catch {
      waitingSound.add(el);
      armFeedSoundUnlock();
      return false;
    }
  }
  if (epoch !== mediaEpoch) {
    haltMediaNode(el);
    return false;
  }

  if (soundUnlocked) {
    const retried = await ensureExclusivePlay(el);
    if (retried) {
      waitingSound.delete(el);
      return true;
    }
  }

  waitingSound.add(el);
  armFeedSoundUnlock();
  return false;
}
