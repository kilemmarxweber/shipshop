"use client";

import { useRef, useState } from "react";
import { Plus, X, Film, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  mediaUploadToastMessage,
  uploadCompressedMedia,
} from "@/lib/compress-media";
import { useI18n } from "@/components/i18n-provider";
import { isVideoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
};

export function MediaUploader({ urls, onChange, max = 12 }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = max - urls.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} médias`);
      return;
    }

    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    const next = [...urls];

    for (const file of list) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        toast.error(`${file.name} : image ou vidéo uniquement`);
        continue;
      }

      try {
        const uploaded = await uploadCompressedMedia(file, "product");
        if (uploaded.url && !next.includes(uploaded.url)) next.push(uploaded.url);
      } catch (error) {
        toast.error(mediaUploadToastMessage(error, t));
      }
    }

    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
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
        disabled={uploading || urls.length >= max}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-surface-2 text-sm font-semibold",
          (uploading || urls.length >= max) && "opacity-50",
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
        {urls.length}/{max}
      </p>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {urls.map((src) => (
            <div
              key={src}
              className="relative aspect-square overflow-hidden rounded-xl bg-surface-2"
            >
              {isVideoUrl(src) ? (
                <div className="relative size-full bg-black">
                  <video
                    src={src}
                    className="size-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Film className="pointer-events-none absolute top-1.5 left-1.5 size-4 text-white/90 drop-shadow" />
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
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== src))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
