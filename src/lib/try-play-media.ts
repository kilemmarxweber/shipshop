/**
 * Après un scroll, play() avec son est souvent refusé.
 * On lance muet (toujours autorisé), puis on démute si la card le veut.
 * Au premier tap / touche, on relance les lecteurs encore bloqués.
 */

const waitingSound = new Set<HTMLMediaElement>();
let soundUnlocked = false;
let unlockArmed = false;

function armSoundUnlock() {
  if (soundUnlocked || unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const unlock = () => {
    soundUnlocked = true;
    const queued = [...waitingSound];
    waitingSound.clear();
    for (const el of queued) {
      if (!el.isConnected) continue;
      el.muted = false;
      void el.play().catch(() => undefined);
    }
  };
  const opts: AddEventListenerOptions = { capture: true, once: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
}

export async function tryPlayMedia(
  el: HTMLMediaElement,
  wantSound: boolean,
) {
  if (wantSound) {
    el.muted = false;
    try {
      await el.play();
      soundUnlocked = true;
      waitingSound.delete(el);
      return true;
    } catch {
      /* retry muted → unmute */
    }
  }
  el.muted = true;
  try {
    await el.play();
  } catch {
    if (wantSound) {
      waitingSound.add(el);
      armSoundUnlock();
    }
    return false;
  }
  if (!wantSound) return true;
  el.muted = false;
  waitingSound.add(el);
  armSoundUnlock();
  return true;
}
