"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import {
  LOCALE_OPTIONS,
  isUserLocale,
  type UserLocale,
} from "@/lib/user-locale";
import { cn } from "@/lib/utils";

const LOCALE_UPDATED_TOAST: Record<UserLocale, string> = {
  fr: "Langue : français",
  en: "Language: English",
  pt: "Idioma: português de Portugal",
};

export function LocalePreferenceButtons({
  className,
  showLabels = true,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  function handleSelect(next: string) {
    if (!isUserLocale(next) || next === locale) return;
    setLocale(next);
    toast.success(LOCALE_UPDATED_TOAST[next]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showLabels ? (
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">{t("settings.language")}</p>
          <p className="text-sm text-muted-foreground">{t("settings.languageHint")}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LOCALE_OPTIONS.map((opt) => {
          const selected = locale === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              className={cn(
                "h-auto flex-col items-start gap-0.5 px-3 py-3 text-left",
                selected && "ring-2 ring-primary/30",
              )}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="text-sm font-semibold">{opt.nativeLabel}</span>
              <span
                className={cn(
                  "text-[11px] font-normal",
                  selected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {opt.value.toUpperCase()}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
