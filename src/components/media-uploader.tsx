"use client";

import { useRef, useState } from "react";
import { Plus, X, Film, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exceedsRecommendedVideoSize,
  mediaUploadToastMessage,
  uploadCompressedMedia,
} from "@/lib/compress-media";
import { useI18n } from "@/components/i18n-provider";
import {
  isVideoUrl,
  looksLikeImageFile,
  looksLikeVideoFile,
  PRODUCT_VIDEO_MAX_SECONDS,
} from "@/lib/media";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import { cn } from "@/lib/utils";
import { useAppConfig } from "@/lib/use-app-config";

const ACCEPT = "image/*,video/*";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  onBusyChange?: (busy: boolean) => void;
};

export function MediaUploader({ urls, onChange, max, onBusyChange }: Props) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const cap = max ?? cfg.maxImages;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function removeAt(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = cap - urls.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${cap} médias`);
      return;
    }

    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    onBusyChange?.(true);
    const next = [...urls];
    let addedCount = 0;
    let warnedRecommendedSize = false;

    try {
      for (const file of list) {
        if (!looksLikeImageFile(file) && !looksLikeVideoFile(file)) {
          toast.error(`${file.name} : image ou vidéo uniquement`);
          continue;
        }

        if (
          !warnedRecommendedSize &&
          exceedsRecommendedVideoSize(file)
        ) {
          warnedRecommendedSize = true;
          toast.warning(
            `Vidéo > 10 Mo : recommandé pour la fluidité. Import autorisé, découpe max ${PRODUCT_VIDEO_MAX_SECONDS}s.`,
          );
        }

        try {
          const uploaded = await uploadCompressedMedia(file, "product");
          if (uploaded.posterUrl && !next.includes(uploaded.posterUrl)) {
            next.push(uploaded.posterUrl);
            addedCount += 1;
          }
          if (uploaded.url && !next.includes(uploaded.url)) {
            next.push(uploaded.url);
            addedCount += 1;
          }
        } catch (error) {
          toast.error(mediaUploadToastMessage(error, t));
        }
      }
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }

    if (list.length > 1 && addedCount < list.length) {
      toast.message(`${addedCount}/${list.length} fichier(s) ajouté(s)`);
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />

      <button
        type="button"
        disabled={uploading || urls.length >= cap}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted/40",
          (uploading || urls.length >= cap) && "opacity-50",
        )}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {uploading ? "Compression…" : "Ajouter images / vidéos"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        {urls.length}/{cap}
        {urls.length > 0
          ? " — touchez × pour retirer. La 1re image est la couverture."
          : " — au moins une image pour publier."}
      </p>

      {urls.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 pt-1">
          {urls.map((src, index) => {
            const video = isVideoUrl(src);
            return (
              <li
                key={`${src}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border"
              >
                {video ? (
                  <div className="relative size-full bg-black">
                    <video
                      src={src}
                      className="pointer-events-none size-full object-cover"
                      muted
                      {...iosInlineVideo}
                      preload="metadata"
                    />
                    <Film className="pointer-events-none absolute bottom-1.5 left-1.5 size-4 text-white drop-shadow" />
                  </div>
                ) : (
                  <div className="size-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                    <ImageIcon className="sr-only" />
                  </div>
                )}
                {index === 0 ? (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Couverture
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeAt(index);
                  }}
                  className="absolute top-0 right-0 z-20 grid size-11 place-items-center text-white"
                  aria-label={`Retirer le média ${index + 1}`}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-black/80 shadow-md ring-1 ring-white/25 transition hover:bg-destructive">
                    <X className="size-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Aucun média. Ajoutez une photo ou une vidéo.
        </p>
      )}
    </div>
  );
}
