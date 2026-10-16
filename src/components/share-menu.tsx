"use client";

import { type ReactNode } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";

function BrandIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS = {
  whatsapp: (
    <BrandIcon className="size-[1.15rem] text-[#25D366]">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.11 3.22 5.12 4.51.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.5 2 2 6.4 2 11.85c0 1.74.46 3.38 1.26 4.82L2 22l5.5-1.44a10.1 10.1 0 0 0 4.54 1.1h.01c5.54 0 10.04-4.4 10.04-9.85C22.09 6.4 17.58 2 12.04 2Zm0 17.97h-.01a8.4 8.4 0 0 1-4.28-1.17l-.31-.18-3.18.83.85-3.1-.2-.32a8.27 8.27 0 0 1-1.27-4.4c0-4.57 3.8-8.29 8.4-8.29 4.48 0 8.4 3.72 8.4 8.29 0 4.57-3.92 8.34-8.4 8.34Z" />
    </BrandIcon>
  ),
  telegram: (
    <BrandIcon className="size-[1.15rem] text-[#2AABEE]">
      <path d="M9.04 16.39 8.8 20.1c.34 0 .49-.15.67-.32l1.6-1.54 3.32 2.44c.61.34 1.04.16 1.2-.56l2.18-10.26c.22-.98-.36-1.36-.98-1.12L4.3 10.7c-.95.37-.93.9-.16 1.14l3.74 1.17 8.7-5.48c.41-.25.78-.11.47.14" />
    </BrandIcon>
  ),
  messenger: (
    <BrandIcon className="size-[1.15rem] text-[#00B2FF]">
      <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.9 1.44 5.49 3.7 7.18V22l3.38-1.86c.93.26 1.91.4 2.92.4 5.52 0 10-4.15 10-9.27S17.52 2 12 2Zm1.05 12.5-2.55-2.72-4.98 2.72 5.47-5.81 2.61 2.72 4.92-2.72-5.47 5.81Z" />
    </BrandIcon>
  ),
  x: (
    <BrandIcon className="size-[1.1rem] text-foreground">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.939ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </BrandIcon>
  ),
  facebook: (
    <BrandIcon className="size-[1.15rem] text-[#1877F2]">
      <path d="M14 8h2.5V5.5H14c-1.93 0-3.5 1.57-3.5 3.5V11H8v2.5h2.5V20H13v-6.5h2.25L16 11h-3V9c0-.55.45-1 1-1Z" />
    </BrandIcon>
  ),
};

const iconBtnClass =
  "size-10 cursor-pointer justify-center rounded-full border-0 bg-transparent p-0 text-foreground transition-colors hover:bg-muted focus:bg-muted data-highlighted:bg-muted";

type Props = {
  title: string;
  text: string;
  url: string;
  productId?: string;
  /** Contenu du bouton trigger (icône, etc.) */
  children: ReactNode;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
};

function recordProductShare(productId?: string, url?: string) {
  const id =
    productId ?? url?.match(/\/product\/([^/?#]+)/)?.[1] ?? undefined;
  if (!id) return;
  void fetch(`/api/products/${id}/share`, { method: "POST" }).catch(() => {});
}

/** Menu dropdown stylisé : réseaux + copier le lien (pas de popup plein écran). */
export function ShareMenu({
  title,
  text,
  url,
  productId,
  children,
  triggerClassName,
  align = "end",
  side = "bottom",
}: Props) {
  const { t } = useI18n();
  const shareUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");
  const fullText = `${text}\n${shareUrl}`;

  const actions = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
      icon: ICONS.whatsapp,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
      icon: ICONS.telegram,
    },
    {
      id: "messenger",
      label: "Messenger",
      href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(shareUrl)}`,
      icon: ICONS.messenger,
    },
    {
      id: "x",
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      icon: ICONS.x,
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      icon: ICONS.facebook,
    },
  ] as const;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      recordProductShare(productId, shareUrl);
      toast.success(t("share.copied"));
    } catch {
      toast.error(t("share.copyFailed"));
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title, text, url: shareUrl });
      recordProductShare(productId, shareUrl);
    } catch {
      /* cancelled */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={t("share.aria")}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center outline-none",
          triggerClassName,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        className="z-[120] w-auto min-w-0 rounded-2xl border border-border bg-popover/95 p-2 text-popover-foreground shadow-lg backdrop-blur-xl"
      >
        <div className="flex items-center gap-1">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              title={action.label}
              aria-label={action.label}
              className={iconBtnClass}
              onClick={() => {
                recordProductShare(productId, shareUrl);
                window.open(action.href, "_blank", "noopener,noreferrer");
              }}
            >
              <span className="grid size-9 place-items-center rounded-full">
                {action.icon}
              </span>
            </DropdownMenuItem>
          ))}
          <span className="mx-0.5 h-6 w-px shrink-0 self-center bg-border" />
          <DropdownMenuItem
            title={t("share.copyLink")}
            aria-label={t("share.copyLink")}
            className={cn(iconBtnClass, "text-primary")}
            onClick={copyLink}
          >
            <span className="grid size-9 place-items-center rounded-full">
              <Copy className="size-4" />
            </span>
          </DropdownMenuItem>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <DropdownMenuItem
              title={t("share.moreApps")}
              aria-label={t("share.moreApps")}
              className={iconBtnClass}
              onClick={nativeShare}
            >
              <span className="grid size-9 place-items-center rounded-full">
                <Share2 className="size-4" />
              </span>
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
