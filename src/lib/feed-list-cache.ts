/**
 * Lots déjà vus (Accueil / Découvrir) : mémoire + sessionStorage.
 * Pas de cookies (trop petits, envoyés à chaque requête).
 * Le plan pagination (8 + curseur) reste la source ; ce cache évite
 * de rejouer le 1er GET en quittant puis revenant dans l’onglet.
 */
import { PUBLIC_PAGE_SIZE } from "@/lib/list-cursor";

const PREFIX = "chipshop.feed.v1.";
const MAX_ITEMS = PUBLIC_PAGE_SIZE * 3;
const MAX_BYTES = 180_000;
const TTL_MS = 5 * 60 * 1000;

export type FeedListCache<T> = {
  items: T[];
  nextCursor: string | null;
  pagesLoaded: number;
  savedAt: number;
};

const memory = new Map<string, FeedListCache<unknown>>();

function storageKey(feedKey: string) {
  return PREFIX + feedKey;
}

function isFresh<T>(row: FeedListCache<T> | null | undefined) {
  if (!row?.items?.length) return false;
  return Date.now() - row.savedAt < TTL_MS;
}

function readSession(feedKey: string): FeedListCache<unknown> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(feedKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedListCache<unknown>;
    if (!isFresh(parsed)) {
      sessionStorage.removeItem(storageKey(feedKey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function pruneSession() {
  if (typeof sessionStorage === "undefined") return;
  const now = Date.now();
  const rows: { key: string; savedAt: number; bytes: number }[] = [];
  let total = 0;
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as FeedListCache<unknown>;
      if (now - parsed.savedAt >= TTL_MS) {
        sessionStorage.removeItem(key);
        continue;
      }
      rows.push({ key, savedAt: parsed.savedAt, bytes: raw.length });
      total += raw.length;
    } catch {
      sessionStorage.removeItem(key);
    }
  }
  rows.sort((a, b) => a.savedAt - b.savedAt);
  while (total > MAX_BYTES && rows.length) {
    const drop = rows.shift();
    if (!drop) break;
    sessionStorage.removeItem(drop.key);
    total -= drop.bytes;
    const feedKey = drop.key.slice(PREFIX.length);
    memory.delete(feedKey);
  }
}

export function readFeedListCache<T>(feedKey: string): FeedListCache<T> | null {
  const mem = memory.get(feedKey);
  if (isFresh(mem)) return mem as FeedListCache<T>;
  if (mem) memory.delete(feedKey);
  const stored = readSession(feedKey);
  if (!stored) return null;
  memory.set(feedKey, stored);
  return stored as FeedListCache<T>;
}

export function writeFeedListCache<T>(
  feedKey: string,
  input: { items: T[]; nextCursor: string | null; pagesLoaded: number },
) {
  if (input.items.length > MAX_ITEMS) return;
  const payload: FeedListCache<T> = {
    items: input.items,
    nextCursor: input.nextCursor,
    pagesLoaded: input.pagesLoaded,
    savedAt: Date.now(),
  };
  memory.set(feedKey, payload as FeedListCache<unknown>);
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = JSON.stringify(payload);
    if (raw.length > MAX_BYTES) {
      payload.items = payload.items.slice(0, PUBLIC_PAGE_SIZE);
      const smaller = JSON.stringify(payload);
      if (smaller.length > MAX_BYTES) return;
      sessionStorage.setItem(storageKey(feedKey), smaller);
    } else {
      sessionStorage.setItem(storageKey(feedKey), raw);
    }
    pruneSession();
  } catch {
    try {
      sessionStorage.removeItem(storageKey(feedKey));
    } catch {
      /* quota */
    }
  }
}
