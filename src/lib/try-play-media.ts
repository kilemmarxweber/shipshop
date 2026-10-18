/**
 * Après un scroll, play() avec son est souvent refusé.
 * On lance muet (toujours autorisé), puis on démute si la card le veut.
 */
export async function tryPlayMedia(
  el: HTMLMediaElement,
  wantSound: boolean,
) {
  if (wantSound) {
    el.muted = false;
    try {
      await el.play();
      return true;
    } catch {
      /* retry muted → unmute */
    }
  }
  el.muted = true;
  try {
    await el.play();
  } catch {
    return false;
  }
  if (!wantSound) return true;
  el.muted = false;
  return true;
}
