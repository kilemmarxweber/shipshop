"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBackNav } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  fallbackHref?: string;
  className?: string;
  onBack?: () => void;
  /** Sur la même ligne qu’un titre (pas pleine largeur) */
  inline?: boolean;
};

/**
 * Retour in-app.
 * Ne pas utiliser `history.length > 1` : en prod (PWA, deep link, onglet)
 * c’est souvent vrai et `router.back()` sort de l’app → reload / page externe.
 */
export function BackButton({
  fallbackHref,
  className,
  onBack,
  inline = false,
}: Props) {
  const router = useRouter();
  const nav = useBackNav();
  const { t } = useI18n();

  function goBack() {
    const custom = onBack ?? nav?.onBack ?? null;
    if (custom) {
      custom();
      return;
    }

    const fallback = fallbackHref ?? nav?.fallbackHref ?? "/";

    if (nav?.canGoBack) {
      router.back();
      return;
    }

    router.push(fallback);
  }

  return (
    <div
      className={cn(
        "flex shrink-0 justify-start",
        inline ? "w-auto" : "w-full",
        className,
      )}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label={t("common.back")}
        className="group grid size-8 cursor-pointer place-items-center rounded-full border border-border bg-muted/40 transition-all duration-200 ease-out hover:-translate-x-1.5 hover:border-white/20 hover:bg-muted active:-translate-x-2.5 active:scale-95"
      >
        <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5 group-active:-translate-x-1" />
      </button>
    </div>
  );
}
