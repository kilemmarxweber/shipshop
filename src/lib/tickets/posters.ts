/** Affiches événement — stock concert / festival (fallback si pas d’image upload). */
export const EVENT_POSTERS = [
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&w=900&q=80",
] as const;

export const EVENT_POSTER_TONES = [
  ["#FF4D8D", "#FF8A3D"],
  ["#FF5722", "#7C5CFF"],
  ["#00D68F", "#0A84FF"],
  ["#BF5AF2", "#FF375F"],
  ["#0A84FF", "#5E5CE6"],
  ["#FF9F0A", "#FF453A"],
] as const;

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function eventPosterUrl(
  imageUrl: string | null | undefined,
  seed: string,
) {
  const custom = imageUrl?.trim();
  if (custom) return custom;
  return EVENT_POSTERS[hashSeed(seed) % EVENT_POSTERS.length];
}

export function eventPosterTone(seed: string) {
  return EVENT_POSTER_TONES[hashSeed(seed) % EVENT_POSTER_TONES.length];
}
