"use client";

import { Check, Languages } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_OPTIONS,
  type UserLocale,
} from "@/lib/user-locale";
import { cn } from "@/lib/utils";

const LOCALE_UPDATED_TOAST: Record<UserLocale, string> = {
  fr: "Langue : français",
  en: "Language: English",
  pt: "Idioma: português",
};

/** Sélecteur de langue compact pour la navbar (à côté du thème). */
export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  function select(next: UserLocale) {
    if (next === locale) return;
    setLocale(next);
    toast.success(LOCALE_UPDATED_TOAST[next]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-muted/40 text-foreground transition hover:bg-muted"
        aria-label={t("settings.language")}
      >
        <Languages className="size-4" />
        <span className="absolute -bottom-0.5 -right-0.5 rounded bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground">
          {locale.toUpperCase()}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LOCALE_OPTIONS.map((opt) => {
          const selected = locale === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => select(opt.value)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3",
                selected && "bg-accent",
              )}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{opt.nativeLabel}</span>
                <span className="text-[10px] text-muted-foreground">
                  {opt.value.toUpperCase()}
                </span>
              </span>
              {selected ? (
                <Check className="size-4 text-primary" />
              ) : (
                <span className="size-4" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
