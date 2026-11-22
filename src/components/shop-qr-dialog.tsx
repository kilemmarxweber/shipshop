"use client";

import { QrCode, Share2 } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { shopQrImageUrl } from "@/lib/shop-qr";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function absoluteUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}

async function shareQrFile(imageUrl: string, name: string, pageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("qr");
  const blob = await response.blob();
  const file = new File([blob], "boutique-qr.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name, text: pageUrl });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: name, text: pageUrl, url: pageUrl });
    return;
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "boutique-qr.png";
  link.click();
  URL.revokeObjectURL(href);
}

export function ShopQrButton({
  url,
  name,
  className,
}: {
  url: string;
  name: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pageUrl = absoluteUrl(url);
  const imageUrl = shopQrImageUrl(pageUrl, 720);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      await shareQrFile(imageUrl, name, pageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/abort|cancel|dismiss/i.test(message)) return;
      toast.error(t("common.copyImpossible"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("size-9 shrink-0 cursor-pointer", className)}
        aria-label={t("shop.qr")}
        title={t("shop.qr")}
        onClick={() => setOpen(true)}
      >
        <QrCode className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center pr-8 text-center">
            <DialogTitle className="text-center text-lg font-bold">
              {name}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("shop.qrHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto rounded-2xl border border-border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={t("shop.qr")}
              width={240}
              height={240}
              className="size-60"
            />
          </div>
          <Button
            type="button"
            className="h-12 w-full cursor-pointer font-bold"
            disabled={sharing}
            onClick={() => void onShare()}
          >
            <Share2 className="size-4" />
            {t("shop.shareQr")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
