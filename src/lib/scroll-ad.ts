export const SCROLL_AD_MAX_VIDEOS = 8;
export const SCROLL_AD_DEFAULT_VIDEO = "/renard.mp4";
export const SCROLL_AD_DEFAULT_DELAY = 120;
export const SCROLL_AD_CLOCK_COOLDOWN_MS = 8 * 60 * 1000;
/** Durée d’un flash image (jpeg, png, webp, gif…). */
export const SCROLL_AD_IMAGE_SECONDS = 8;
export const SCROLL_AD_DAY_STORAGE_KEY = "chipshop.scrollAd.day.v1";

export type ScrollAdClip = {
  url: string;
  enabled: boolean;
  /** 1 = passe en premier. */
  priority: number;
};

export type ScrollAdCampaign = {
  enabled: boolean;
  delaySeconds: number;
  startsAt: string | null;
  endsAt: string | null;
  videos: ScrollAdClip[];
};

export function clampScrollAdPriority(value: unknown, fallback = 1) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(99, Math.max(1, Math.round(n)));
}

export function clampScrollAdDelay(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return SCROLL_AD_DEFAULT_DELAY;
  return Math.min(3600, Math.max(0, Math.round(n)));
}

export function isAllowedAdVideoUrl(url: string) {
  const u = url.trim();
  if (u.length < 2 || u.length > 500) return false;
  if (u.includes("://") && !/^https?:\/\//i.test(u)) return false;
  if (u.startsWith("//")) return false;
  if (u.startsWith("/")) return true;
  return /^https?:\/\//i.test(u);
}

export function parseScrollAdVideos(raw: unknown, fallbackDefault = true): ScrollAdClip[] {
  if (!Array.isArray(raw)) {
    return fallbackDefault
      ? [{ url: SCROLL_AD_DEFAULT_VIDEO, enabled: true, priority: 1 }]
      : [];
  }
  const clips: ScrollAdClip[] = [];
  for (const [index, item] of raw.entries()) {
    if (clips.length >= SCROLL_AD_MAX_VIDEOS) break;
    if (typeof item === "string") {
      const url = item.trim();
      if (!isAllowedAdVideoUrl(url)) continue;
      clips.push({ url, enabled: true, priority: index + 1 });
      continue;
    }
    if (!item || typeof item !== "object" || !("url" in item)) continue;
    const url = String((item as { url: unknown }).url).trim();
    if (!isAllowedAdVideoUrl(url)) continue;
    const rec = item as { enabled?: unknown; priority?: unknown };
    clips.push({
      url,
      enabled: rec.enabled !== false,
      priority: clampScrollAdPriority(rec.priority, clips.length + 1),
    });
  }
  return clips;
}

export function scrollAdPeriodActive(startsAt: string | null, endsAt: string | null) {
  const now = Date.now();
  if (startsAt) {
    const start = Date.parse(startsAt);
    if (Number.isFinite(start) && now < start) return false;
  }
  if (endsAt) {
    const end = Date.parse(endsAt);
    if (Number.isFinite(end) && now > end) return false;
  }
  return true;
}

export function scrollAdLiveVideos(campaign: ScrollAdCampaign) {
  if (
    !campaign.enabled ||
    campaign.delaySeconds <= 0 ||
    !scrollAdPeriodActive(campaign.startsAt, campaign.endsAt)
  ) {
    return [];
  }
  return [...campaign.videos]
    .filter((clip) => clip.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((clip) => clip.url);
}

export function localDayKey(now = Date.now()) {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Après n vues aujourd’hui : first, 2first, 3first… */
export function nextEngagedGapMs(firstMs: number, seenCount: number) {
  const first = Math.max(0, firstMs);
  const n = Math.max(0, Math.floor(seenCount));
  return first * (1 + n);
}

export function nextUnseenVideo(videos: string[], seen: string[]) {
  const done = new Set(seen);
  return videos.find((url) => !done.has(url)) ?? null;
}

export type ScrollAdDayState = {
  day: string;
  seen: string[];
  shownAt: number;
  engagedMs: number;
};

function emptyDayState(): ScrollAdDayState {
  return { day: localDayKey(), seen: [], shownAt: 0, engagedMs: 0 };
}

export function loadScrollAdDay(): ScrollAdDayState {
  const fresh = emptyDayState();
  if (typeof window === "undefined") return fresh;
  try {
    const raw = localStorage.getItem(SCROLL_AD_DAY_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<ScrollAdDayState>;
    if (parsed.day !== fresh.day) return fresh;
    return {
      day: fresh.day,
      seen: Array.isArray(parsed.seen)
        ? parsed.seen.filter((item): item is string => typeof item === "string")
        : [],
      shownAt: Number(parsed.shownAt) > 0 ? Number(parsed.shownAt) : 0,
      engagedMs: Number(parsed.engagedMs) > 0 ? Number(parsed.engagedMs) : 0,
    };
  } catch {
    return fresh;
  }
}

export function saveScrollAdDay(state: ScrollAdDayState) {
  if (typeof window === "undefined") return;
  try {
    const day = localDayKey();
    const next =
      state.day === day
        ? { ...state, day }
        : { day, seen: [], shownAt: 0, engagedMs: 0 };
    localStorage.setItem(SCROLL_AD_DAY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function clockCooldownElapsed(shownAt: number, now = Date.now()) {
  if (!shownAt) return true;
  return now - shownAt >= SCROLL_AD_CLOCK_COOLDOWN_MS;
}
