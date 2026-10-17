"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { defaultBackFallback } from "@/lib/back-fallback";

const STACK_KEY = "chipshop.navStack";

type BackNavContextValue = {
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
  fallbackHref: string | null;
  setFallbackHref: (href: string | null) => void;
  /** true seulement s’il y a une page précédente *dans* l’app */
  canGoBack: boolean;
  /** Retour sûr : push in-app (évite reload / sortie d’app de router.back) */
  goBack: (overrideFallback?: string) => void;
};

const BackNavContext = createContext<BackNavContextValue | null>(null);

function readStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-40)));
  } catch {
    /* private mode / quota */
  }
}

function navigationType(): PerformanceNavigationTiming["type"] | "navigate" {
  if (typeof performance === "undefined") return "navigate";
  const entry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  return entry?.type ?? "navigate";
}

export function BackNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [onBack, setOnBackState] = useState<(() => void) | null>(null);
  const [fallbackHref, setFallbackHrefState] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const bootstrapped = useRef(false);
  const lastPath = useRef<string | null>(null);
  const popStatePending = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const fallbackRef = useRef(fallbackHref);
  fallbackRef.current = fallbackHref;

  const setOnBack = useCallback((fn: (() => void) | null) => {
    setOnBackState(() => fn);
  }, []);

  const setFallbackHref = useCallback((href: string | null) => {
    setFallbackHrefState(href);
  }, []);

  // Browser back/forward (y compris multi-étapes) — avant le sync pathname
  useEffect(() => {
    const onPopState = () => {
      popStatePending.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Historique in-app (session) — ne pas faire confiance à history.length
  useEffect(() => {
    if (!pathname) return;

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const type = navigationType();
      let stack = readStack();

      if (type === "reload" || type === "navigate") {
        stack = [pathname];
      } else {
        const idx = stack.lastIndexOf(pathname);
        stack = idx >= 0 ? stack.slice(0, idx + 1) : [pathname];
      }

      writeStack(stack);
      lastPath.current = pathname;
      popStatePending.current = false;
      setCanGoBack(stack.length > 1);
      return;
    }

    if (lastPath.current === pathname) return;

    let stack = readStack();

    // Déjà synchronisé (ex. goBack a pop + push)
    if (stack[stack.length - 1] === pathname) {
      lastPath.current = pathname;
      popStatePending.current = false;
      setCanGoBack(stack.length > 1);
      return;
    }

    const earlierIdx = stack.lastIndexOf(pathname);
    const fromPopState = popStatePending.current;
    popStatePending.current = false;

    if (fromPopState) {
      // Retour/avance navigateur : recaler la pile (1 ou N étapes)
      stack =
        earlierIdx >= 0 ? stack.slice(0, earlierIdx + 1) : [pathname];
    } else if (stack[stack.length - 2] === pathname) {
      // Un seul cran en arrière
      stack = stack.slice(0, -1);
    } else if (earlierIdx >= 0 && earlierIdx < stack.length - 2) {
      // Multi-étapes sans popstate (ex. sync Next) — pas un simple re-visit
      // (re-visit A→B→A serait earlierIdx === length-2 et tombe dans le push)
      stack = stack.slice(0, earlierIdx + 1);
    } else {
      // Navigation avant
      stack = [...stack, pathname];
    }

    writeStack(stack);
    lastPath.current = pathname;
    setCanGoBack(stack.length > 1);
  }, [pathname]);

  const goBack = useCallback(
    (overrideFallback?: string) => {
      const custom = onBackRef.current;
      if (custom) {
        custom();
        return;
      }

      const stack = readStack();
      if (stack.length > 1) {
        const prev = stack[stack.length - 2]!;
        const nextStack = stack.slice(0, -1);
        writeStack(nextStack);
        setCanGoBack(nextStack.length > 1);
        lastPath.current = prev;
        // push in-app : pas de sortie d’app / reload comme router.back()
        router.push(prev);
        return;
      }

      const fallback =
        overrideFallback ??
        fallbackRef.current ??
        defaultBackFallback(pathname || "/");
      router.push(fallback);
    },
    [router, pathname],
  );

  const value = useMemo(
    () => ({
      onBack,
      setOnBack,
      fallbackHref,
      setFallbackHref,
      canGoBack,
      goBack,
    }),
    [onBack, setOnBack, fallbackHref, setFallbackHref, canGoBack, goBack],
  );

  return (
    <BackNavContext.Provider value={value}>{children}</BackNavContext.Provider>
  );
}

export function useBackNav() {
  return useContext(BackNavContext);
}

/** Enregistre un retour custom + fallback pour la page courante. */
export function usePageBack(options?: {
  onBack?: () => void;
  fallbackHref?: string;
}) {
  const ctx = useBackNav();
  const setOnBack = ctx?.setOnBack;
  const setFallbackHref = ctx?.setFallbackHref;
  const onBack = options?.onBack;
  const fallbackHref = options?.fallbackHref ?? null;
  const hasCustomBack = Boolean(onBack);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!setOnBack || !setFallbackHref) return;
    setOnBack(hasCustomBack ? () => onBackRef.current?.() : null);
    setFallbackHref(fallbackHref);
    return () => {
      setOnBack(null);
      setFallbackHref(null);
    };
  }, [setOnBack, setFallbackHref, hasCustomBack, fallbackHref]);
}
