"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";
import { PUBLIC_PAGE_SIZE } from "@/lib/list-cursor";
import { readFeedListCache, writeFeedListCache } from "@/lib/feed-list-cache";
import {
  NEW_LISTING_EVENT,
  NEW_LISTING_STORAGE_KEY,
} from "@/lib/new-listing-events";

type ExtractPage<T> = {
  items: T[];
  nextCursor: string | null;
};

type LoadOptions = {
  /** Keep current items visible; no full-page loading flash. */
  soft?: boolean;
};

export function usePaginatedList<T extends { id: string }>(options: {
  enabled?: boolean;
  cacheKey?: string;
  /**
   * When this changes (ex. foryou → following), wipe and hard-load.
   * Other dep changes (geo, session) soft-refresh in the background.
   */
  resetGroup?: string;
  prefetchRemaining?: number;
  deps: DependencyList;
  buildUrl: (cursor: string | null) => string;
  extract: (json: unknown) => ExtractPage<T>;
}) {
  const {
    enabled = true,
    cacheKey,
    resetGroup = "default",
    prefetchRemaining = 4,
    deps,
    buildUrl,
    extract,
  } = options;
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const pagesLoadedRef = useRef(0);
  const userScrolledRef = useRef(false);
  const itemsRef = useRef<T[]>([]);
  const resetGroupRef = useRef(resetGroup);
  const bootstrappedKeyRef = useRef<string | null>(null);
  const buildUrlRef = useRef(buildUrl);
  const extractRef = useRef(extract);
  const cacheKeyRef = useRef(cacheKey);
  buildUrlRef.current = buildUrl;
  extractRef.current = extract;
  cacheKeyRef.current = cacheKey;
  nextCursorRef.current = nextCursor;
  itemsRef.current = items;

  const load = useCallback(
    async (cursor: string | null, append: boolean, opts?: LoadOptions) => {
      if (!append) {
        abortRef.current?.abort();
      } else if (loadingMoreRef.current || !cursor) {
        return;
      }
      const ac = new AbortController();
      abortRef.current = ac;
      if (append) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        const keepVisible = Boolean(opts?.soft && itemsRef.current.length > 0);
        if (keepVisible) {
          // Clear spinner left by an aborted hard load.
          setLoading(false);
        } else {
          setLoading(true);
        }
      }
      try {
        const res = await fetch(buildUrlRef.current(cursor), {
          signal: ac.signal,
        });
        const json: unknown = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        const page = extractRef.current(json);
        setNextCursor(page.nextCursor);
        nextCursorRef.current = page.nextCursor;
        pagesLoadedRef.current += 1;
        setItems((prev) => {
          const next = append
            ? (() => {
                const seen = new Set(prev.map((row) => row.id));
                return [
                  ...prev,
                  ...page.items.filter((row) => !seen.has(row.id)),
                ];
              })()
            : page.items;
          const key = cacheKeyRef.current;
          if (key) {
            writeFeedListCache(key, {
              items: next,
              nextCursor: page.nextCursor,
              pagesLoaded: pagesLoadedRef.current,
            });
          }
          return next;
        });
      } catch (error) {
        if (ac.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!append && !opts?.soft) setItems([]);
        console.error("[paginated-list]", error);
      } finally {
        // Only the active request may clear flags (aborted hard loads used to
        // leave loading=true forever when followed by a soft refresh).
        if (abortRef.current === ac) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
      pagesLoadedRef.current = 0;
      userScrolledRef.current = false;
      bootstrappedKeyRef.current = null;
      return;
    }

    const groupChanged = resetGroupRef.current !== resetGroup;
    resetGroupRef.current = resetGroup;
    const key = cacheKey ?? `anon:${resetGroup}`;
    const sameKeyBootstrapped = bootstrappedKeyRef.current === key;

    if (cacheKey) {
      const hit = readFeedListCache<T>(cacheKey);
      if (hit) {
        setItems(hit.items);
        setNextCursor(hit.nextCursor);
        nextCursorRef.current = hit.nextCursor;
        pagesLoadedRef.current = hit.pagesLoaded;
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
        bootstrappedKeyRef.current = key;
        // Do NOT auto soft-refresh on every cache hit — that aborted/restarted
        // fetches in a loop during HMR / dep churn.
        return () => {
          abortRef.current?.abort();
        };
      }
    }

    pagesLoadedRef.current = 0;
    userScrolledRef.current = false;

    if (groupChanged) {
      setItems([]);
      setNextCursor(null);
      nextCursorRef.current = null;
      bootstrappedKeyRef.current = key;
      void load(null, false);
    } else if (sameKeyBootstrapped && itemsRef.current.length > 0) {
      // Same feed already on screen (geo/session tweak): refresh quietly.
      void load(null, false, { soft: true });
    } else {
      bootstrappedKeyRef.current = key;
      void load(null, false, { soft: itemsRef.current.length > 0 });
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies reset deps
  }, [enabled, load, cacheKey, resetGroup, ...deps]);

  useEffect(() => {
    if (!enabled) return;
    function refresh() {
      pagesLoadedRef.current = 0;
      userScrolledRef.current = false;
      void load(null, false, { soft: itemsRef.current.length > 0 });
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== NEW_LISTING_STORAGE_KEY || !event.newValue) return;
      refresh();
    }
    window.addEventListener(NEW_LISTING_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NEW_LISTING_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, load]);

  const loadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    void load(cursor, true);
  }, [load]);

  const noteUserScroll = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  const hasMore = Boolean(nextCursor);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    noteUserScroll,
    prefetchRemaining,
    pageSize: PUBLIC_PAGE_SIZE,
  };
}
