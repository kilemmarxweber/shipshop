"use client";

import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UserPrefsSync } from "@/components/user-prefs-sync";
import { Toaster } from "@/components/ui/sonner";
import type { UserLocale } from "@/lib/user-locale";

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: UserLocale;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <I18nProvider initialLocale={initialLocale}>
        <UserPrefsSync />
        {children}
        <Toaster position="top-center" richColors />
      </I18nProvider>
    </ThemeProvider>
  );
}
