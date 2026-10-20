/**
 * On tente le son tout de suite (comme Android), y compris iOS.
 * Si Safari/Chrome iOS refuse (pas de geste Apple), lecture muette
 * puis démute au premier tap / scroll.
 */

export const SOUND_UNLOCK_EVENT = "ss:sound-unlocked";

const waitingSound = new Set<HTMLMediaElement>();
let soundUnlocked = false;
let unlockArmed = false;
/** iPhone : le tap son allume le fil ; mute bouton l’éteint. Android : toujours on. */
let userEnabledSound = false;

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

/** Android : son auto. iPhone : seulement après le tap son. */
export function isFeedSoundLive() {
  return !isIosDevice() || (soundUnlocked && userEnabledSound);
}

function notifySound() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SOUND_UNLOCK_EVENT));
}

/** 1re card vraiment à l’écran. Sinon on attend (rien à jouer). */
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
      return { el, overlap, top: r.top };
    })
    .filter((row) => row.overlap > 48)
    .sort((a, b) => b.overlap - a.overlap || a.top - b.top);

  const winner = ranked[0]?.el ?? null;

  document.querySelectorAll("audio, video").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    if (node.dataset.scrollAd === "1") return;
    const inWinner = Boolean(winner && winner.contains(node));
    if (!inWinner) {
      node.muted = true;
      node.dataset.wantSound = "0";
      return;
    }
    node.dataset.wantSound = "1";
    node.muted = false;
    void node.play().catch(() => undefined);
  });

  return (
    winner?.getAttribute("data-audio-key") ??
    winner?.querySelector("[data-audio-key]")?.getAttribute("data-audio-key") ??
    null
  );
}

export function enableFeedSound() {
  userEnabledSound = true;
  markUnlocked();
  playFirstVisibleFeedSound();
}

export function disableFeedSound() {
  userEnabledSound = false;
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio, video").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    if (node.dataset.scrollAd === "1") return;
    node.muted = true;
    node.dataset.wantSound = "0";
  });
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

function flushWaiting() {
  const queued = [...waitingSound];
  waitingSound.clear();
  for (const el of queued) {
    if (!el.isConnected || !stillWantsSound(el)) continue;
    el.muted = false;
    void el.play().catch(() => undefined);
  }
}

function markUnlocked() {
  const first = !soundUnlocked;
  soundUnlocked = true;
  if (first) resumeWebAudio();
  flushWaiting();
  notifySound();
}

export function armFeedSoundUnlock() {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const onFeedTab = (e: Event) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest("[data-feed-sound]")) return;
    enableFeedSound();
  };
  window.addEventListener("pointerdown", onFeedTab, opts);
  window.addEventListener("touchstart", onFeedTab, opts);
}

export async function tryPlayMedia(
  el: HTMLMediaElement,
  wantSound: boolean,
) {
  el.dataset.wantSound = wantSound ? "1" : "0";
  if (!wantSound || (isIosDevice() && !userEnabledSound)) {
    waitingSound.delete(el);
    el.muted = true;
    el.dataset.wantSound = "0";
    try {
      await el.play();
      return !wantSound;
    } catch {
      return false;
    }
  }

  el.muted = false;
  try {
    await el.play();
    markUnlocked();
    waitingSound.delete(el);
    return true;
  } catch {
    /* iOS : pas de geste → play() avec son refusé */
  }

  el.muted = true;
  try {
    await el.play();
  } catch {
    waitingSound.add(el);
    armFeedSoundUnlock();
    return false;
  }

  if (soundUnlocked) {
    el.muted = false;
    try {
      await el.play();
      waitingSound.delete(el);
      return true;
    } catch {
      waitingSound.add(el);
      armFeedSoundUnlock();
      return true;
    }
  }

  waitingSound.add(el);
  armFeedSoundUnlock();
  return true;
}
