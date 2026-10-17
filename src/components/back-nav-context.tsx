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
import { usePathname } from "next/navigation";

const STACK_KEY = "chipshop.navStack";

type BackNavContextValue = {
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
  fallbackHref: string;
  setFallbackHref: (href: string) => void;
  /** true seulement s’il y a une page précédente *dans* l’app (pas l’historique navigateur externe) */
  canGoBack: boolean;
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
  const [onBack, setOnBackState] = useState<(() => void) | null>(null);
  const [fallbackHref, setFallbackHrefState] = useState("/");
  const [canGoBack, setCanGoBack] = useState(false);
  const bootstrapped = useRef(false);
  const lastPath = useRef<string | null>(null);

  const setOnBack = useCallback((fn: (() => void) | null) => {
    setOnBackState(() => fn);
  }, []);

  const setFallbackHref = useCallback((href: string) => {
    setFallbackHrefState(href);
  }, []);

  // Historique in-app : ignore history.length (souvent > 1 même à l’entrée prod / PWA)
  useEffect(() => {
    if (!pathname) return;

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const type = navigationType();
      let stack = readStack();

      if (type === "reload" || type === "navigate") {
        // Chargement document (lien direct, refresh, deep link) → pas de retour SPA fiable
        stack = [pathname];
      } else {
        // back_forward / prerender : resync sur le chemin courant
        const idx = stack.lastIndexOf(pathname);
        stack = idx >= 0 ? stack.slice(0, idx + 1) : [pathname];
      }

      writeStack(stack);
      lastPath.current = pathname;
      setCanGoBack(stack.length > 1);
      return;
    }

    if (lastPath.current === pathname) return;

    let stack = readStack();
    const prev = stack[stack.length - 2];

    if (prev === pathname) {
      // Retour navigateur / bouton retour
      stack = stack.slice(0, -1);
    } else if (stack[stack.length - 1] !== pathname) {
      stack = [...stack, pathname];
    }

    writeStack(stack);
    lastPath.current = pathname;
    setCanGoBack(stack.length > 1);
  }, [pathname]);

  const value = useMemo(
    () => ({ onBack, setOnBack, fallbackHref, setFallbackHref, canGoBack }),
    [onBack, setOnBack, fallbackHref, setFallbackHref, canGoBack],
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
  const fallbackHref = options?.fallbackHref ?? "/";
  const hasCustomBack = Boolean(onBack);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!setOnBack || !setFallbackHref) return;
    setOnBack(hasCustomBack ? () => onBackRef.current?.() : null);
    setFallbackHref(fallbackHref);
    return () => {
      setOnBack(null);
      setFallbackHref("/");
    };
  }, [setOnBack, setFallbackHref, hasCustomBack, fallbackHref]);
}
