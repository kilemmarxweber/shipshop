"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBackNav } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { defaultBackFallback } from "@/lib/back-fallback";

type Props = {
  fallbackHref?: string;
  className?: string;
  onBack?: () => void;
  /** Sur la même ligne qu’un titre (pas pleine largeur) */
  inline?: boolean;
};

/**
 * Retour in-app partout.
 * - Pas de `history.length` / `router.back()` bruts (prod: sortie d’app → reload).
 * - Utilise la pile session + `router.push` via BackNavProvider.
 */
export function BackButton({
  fallbackHref,
  className,
  onBack,
  inline = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const nav = useBackNav();
  const { t } = useI18n();

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (nav?.goBack) {
      nav.goBack(fallbackHref);
      return;
    }
    // Hors provider (edge) : fallback route, jamais history.back()
    router.push(fallbackHref ?? defaultBackFallback(pathname || "/"));
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
