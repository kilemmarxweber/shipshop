"use client";

import { useRef, useState } from "react";
import { Plus, X, Film, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("video");
}

export function MediaUploader({ urls, onChange, max = 12 }: Props) {
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
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} dépasse 10 Mo`);
        continue;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        toast.error(`${file.name} : image ou vidéo uniquement`);
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? `Échec ${file.name}`);
          continue;
        }
        if (json.url && !next.includes(json.url)) next.push(json.url);
      } catch {
        toast.error(`Échec upload ${file.name}`);
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
        {uploading ? "Upload…" : "Ajouter images / vidéos"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        Images ou vidéos · max 10 Mo · {urls.length}/{max}
      </p>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {urls.map((src) => (
            <div
              key={src}
              className="relative aspect-square overflow-hidden rounded-xl bg-surface-2"
            >
              {isVideoUrl(src) ? (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Film className="size-6" />
                  <video
                    src={src}
                    className="absolute inset-0 size-full object-cover opacity-60"
                    muted
                    playsInline
                  />
                </div>
              ) : (
                <div
                  className="size-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${src})` }}
                >
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
