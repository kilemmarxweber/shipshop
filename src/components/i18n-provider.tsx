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
import { dictionaries, type Messages } from "@/lib/i18n/dictionaries";
import { authClient } from "@/lib/auth-client";
import {
  intlLocaleFromUserLocale,
  readUserLocalePreference,
  writeUserLocalePreference,
  type UserLocale,
} from "@/lib/user-locale";

export type MessagePath =
  | `nav.${keyof Messages["nav"]}`
  | `auth.${keyof Messages["auth"]}`
  | `media.${keyof Messages["media"]}`
  | `settings.${keyof Messages["settings"]}`
  | `common.${keyof Messages["common"]}`
  | `feed.${keyof Messages["feed"]}`
  | `discover.${keyof Messages["discover"]}`
  | `shop.${keyof Messages["shop"]}`
  | `product.${keyof Messages["product"]}`
  | `buy.${keyof Messages["buy"]}`
  | `cart.${keyof Messages["cart"]}`
  | `share.${keyof Messages["share"]}`
  | `follow.${keyof Messages["follow"]}`
  | `categories.${keyof Messages["categories"]}`
  | `messages.${keyof Messages["messages"]}`
  | `notifications.${keyof Messages["notifications"]}`
  | `wallet.${keyof Messages["wallet"]}`
  | `shopExtra.${keyof Messages["shopExtra"]}`
  | `wanted.${keyof Messages["wanted"]}`
  | `montage.${keyof Messages["montage"]}`
  | `publish.${keyof Messages["publish"]}`;

type I18nContextValue = {
  locale: UserLocale;
  setLocale: (next: UserLocale, persistRemote?: boolean) => void;
  t: (path: MessagePath) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(messages: Messages, path: MessagePath): string {
  const [group, key] = path.split(".") as [keyof Messages, string];
  const section = messages[group] as Record<string, string>;
  return section[key] ?? path;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: UserLocale;
}) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [locale, setLocaleState] = useState<UserLocale>(initialLocale);

  useEffect(() => {
    if (!userId) {
      document.documentElement.lang = intlLocaleFromUserLocale(initialLocale);
      return;
    }
    const next = readUserLocalePreference(userId);
    setLocaleState(next);
    document.documentElement.lang = intlLocaleFromUserLocale(next);
  }, [userId, initialLocale]);

  const setLocale = useCallback(
    (next: UserLocale, persistRemote = true) => {
      setLocaleState(next);
      writeUserLocalePreference(next, userId);
      document.documentElement.lang = intlLocaleFromUserLocale(next);
      if (persistRemote && userId) {
        void fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        }).catch(() => {});
      }
    },
    [userId],
  );

  const t = useCallback(
    (path: MessagePath) => lookup(dictionaries[locale], path),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
