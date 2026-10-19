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

type ExtractPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export function usePaginatedList<T extends { id: string }>(options: {
  enabled?: boolean;
  cacheKey?: string;
  prefetchRemaining?: number;
  deps: DependencyList;
  buildUrl: (cursor: string | null) => string;
  extract: (json: unknown) => ExtractPage<T>;
}) {
  const {
    enabled = true,
    cacheKey,
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
  const buildUrlRef = useRef(buildUrl);
  const extractRef = useRef(extract);
  const cacheKeyRef = useRef(cacheKey);
  buildUrlRef.current = buildUrl;
  extractRef.current = extract;
  cacheKeyRef.current = cacheKey;
  nextCursorRef.current = nextCursor;

  const load = useCallback(async (cursor: string | null, append: boolean) => {
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
      setLoading(true);
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
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      if (!append) setItems([]);
      console.error("[paginated-list]", error);
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
      pagesLoadedRef.current = 0;
      userScrolledRef.current = false;
      return;
    }
    pagesLoadedRef.current = 0;
    userScrolledRef.current = false;
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
        return () => abortRef.current?.abort();
      }
    }
    void load(null, false);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies reset deps
  }, [enabled, load, cacheKey, ...deps]);

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
