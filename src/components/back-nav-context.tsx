"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BackNavContextValue = {
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
  fallbackHref: string;
  setFallbackHref: (href: string) => void;
};

const BackNavContext = createContext<BackNavContextValue | null>(null);

export function BackNavProvider({ children }: { children: ReactNode }) {
  const [onBack, setOnBackState] = useState<(() => void) | null>(null);
  const [fallbackHref, setFallbackHrefState] = useState("/");

  const setOnBack = useCallback((fn: (() => void) | null) => {
    setOnBackState(() => fn);
  }, []);

  const setFallbackHref = useCallback((href: string) => {
    setFallbackHrefState(href);
  }, []);

  const value = useMemo(
    () => ({ onBack, setOnBack, fallbackHref, setFallbackHref }),
    [onBack, setOnBack, fallbackHref, setFallbackHref],
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
  const onBack = options?.onBack;
  const fallbackHref = options?.fallbackHref;

  useEffect(() => {
    if (!ctx) return;
    ctx.setOnBack(onBack ?? null);
    ctx.setFallbackHref(fallbackHref ?? "/");
    return () => {
      ctx.setOnBack(null);
      ctx.setFallbackHref("/");
    };
  }, [ctx, onBack, fallbackHref]);
}
