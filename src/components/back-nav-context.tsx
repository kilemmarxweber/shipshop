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
