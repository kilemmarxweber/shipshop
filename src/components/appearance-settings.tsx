"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { LocalePreferenceButtons } from "@/components/locale-preference-buttons";
import { useI18n } from "@/components/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { isUserTheme } from "@/lib/user-theme";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { t } = useI18n();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const current =
      theme === "light" || theme === "dark" ? theme : resolvedTheme;
    if (current === "light" || current === "dark") {
      setSelected(current);
    }
  }, [mounted, theme, resolvedTheme]);

  function applyTheme(value: "light" | "dark") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(value);
    root.style.colorScheme = value;
    setTheme(value);
    setSelected(value);
    toast.success(t("settings.themeUpdated"));
    if (session?.user?.id && isUserTheme(value)) {
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      }).catch(() => {});
    }
  }

  return (
    <section className="mt-8 mb-6 space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          {t("settings.appearance")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.appearanceHint")}
        </p>
      </div>

      <LocalePreferenceButtons />

      <div className="space-y-2">
        <p className="text-sm font-medium leading-none">{t("settings.theme")}</p>
        <p className="text-sm text-muted-foreground">{t("settings.themeHint")}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={cn(
              "w-full rounded-md border-2 p-2 text-left transition-colors hover:border-accent",
              selected === "light" ? "border-primary" : "border-muted",
            )}
          >
            <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
              <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                <div className="h-2 w-[80px] rounded bg-[#ecedef]" />
                <div className="h-2 w-[100px] rounded bg-[#ecedef]" />
              </div>
            </div>
            <span className="mt-2 block text-center text-sm">
              {t("settings.themeLight")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={cn(
              "w-full rounded-md border-2 p-2 text-left transition-colors hover:border-accent",
              selected === "dark" ? "border-primary" : "border-muted",
            )}
          >
            <div className="space-y-2 rounded-sm bg-slate-950 p-2">
              <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                <div className="h-2 w-[80px] rounded bg-slate-400" />
                <div className="h-2 w-[100px] rounded bg-slate-400" />
              </div>
            </div>
            <span className="mt-2 block text-center text-sm">
              {t("settings.themeDark")}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
