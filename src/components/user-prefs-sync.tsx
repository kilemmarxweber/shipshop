"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { isUserLocale } from "@/lib/user-locale";
import { isUserTheme } from "@/lib/user-theme";

export function UserPrefsSync() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const { setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || appliedFor.current === userId) return;
    appliedFor.current = userId;
    void fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { user?: { locale?: string | null; theme?: string | null } } | null) => {
        const remoteLocale = json?.user?.locale;
        const remoteTheme = json?.user?.theme;
        if (isUserLocale(remoteLocale) && remoteLocale !== locale) {
          setLocale(remoteLocale, false);
        }
        if (isUserTheme(remoteTheme)) {
          setTheme(remoteTheme);
        }
      })
      .catch(() => {});
  }, [userId, locale, setLocale, setTheme]);

  useEffect(() => {
    if (!userId) appliedFor.current = null;
  }, [userId]);

  return null;
}
