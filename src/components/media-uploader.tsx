"use client";

import { useI18n } from "@/components/i18n-provider";
import {
    exceedsRecommendedVideoSize,
    mediaUploadToastMessage,
    uploadCompressedMedia,
} from "@/lib/compress-media";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import {
    isVideoUrl,
    looksLikeImageFile,
    looksLikeVideoFile,
    PRODUCT_VIDEO_MAX_SECONDS,
} from "@/lib/media";
import {
    formatRatio,
    probeImageFile,
    probeImageUrl,
    recommendedRatioLabel,
    type ImageProbe,
} from "@/lib/product-image-intel";
import { useAppConfig } from "@/lib/use-app-config";
import { cn } from "@/lib/utils";
import { Film, ImageIcon, Loader2, Plus, Scan, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ACCEPT = "image/*,video/*";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  onBusyChange?: (busy: boolean) => void;
  /** Catégorie produit pour recommandations de ratio */
  category?: string;
};

export function MediaUploader({
  urls,
  onChange,
  max,
  onBusyChange,
  category = "divers",
}: Props) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const cap = max ?? cfg.maxImages;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [probes, setProbes] = useState<Record<string, ImageProbe>>({});
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next: Record<string, ImageProbe> = { ...probes };
      for (const url of urls) {
        if (isVideoUrl(url) || next[url]) continue;
        try {
          next[url] = await probeImageUrl(url, category);
        } catch {
          /* ignore */
        }
      }
      if (alive) setProbes(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urls/category drive re-probe
  }, [urls.join("|"), category]);

  function removeAt(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  function setPrimary(index: number) {
    if (index <= 0) return;
    const next = [...urls];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
    toast.success("Photo principale définie");
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
    toast.message("Analyse + envoi des médias…");
    const next = [...urls];
    let succeededFiles = 0;
    let warnedRecommendedSize = false;

    try {
      for (const file of list) {
        if (!looksLikeImageFile(file) && !looksLikeVideoFile(file)) {
          toast.error(`${file.name} : image ou vidéo uniquement`);
          continue;
        }

        if (looksLikeImageFile(file)) {
          try {
            const probe = await probeImageFile(file, category);
            if (probe.warning) toast.warning(probe.warning);
            else toast.message(probe.tip);
          } catch {
            /* ignore */
          }
        }

        if (!warnedRecommendedSize && exceedsRecommendedVideoSize(file)) {
          warnedRecommendedSize = true;
          toast.warning(
            `Vidéo > 10 Mo : recommandé pour la fluidité. Import autorisé, découpe max ${PRODUCT_VIDEO_MAX_SECONDS}s.`,
          );
        }

        try {
          const uploaded = await uploadCompressedMedia(file, "product");
          succeededFiles += 1;
          if (uploaded.posterUrl && !next.includes(uploaded.posterUrl)) {
            next.push(uploaded.posterUrl);
          }
          if (uploaded.url && !next.includes(uploaded.url)) {
            next.push(uploaded.url);
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

    if (list.length > 1) {
      toast.message(`${succeededFiles}/${list.length} fichier(s) ajouté(s)`);
    }
    onChange(next);
  }

  const activeProbe = active ? probes[active] : null;

  return (
    <div className="relative space-y-2">
      <div className="flex items-start gap-2 rounded-xl border border-trust/30 bg-trust/10 px-3 py-2.5 text-[12px] leading-snug text-foreground">
        <Scan className="mt-0.5 size-4 shrink-0 text-trust" />
        <p>
          Fiche produit en <strong>contain</strong> — ta photo n’est jamais
          forcée ni coupée. Conseil ratio&nbsp;: ~
          {recommendedRatioLabel(category)}. Recadrage optionnel côté mobile ;
          ici l’app s’adapte à l’image.
        </p>
      </div>

      {uploading ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-trust/40 bg-trust/10 px-3 py-2.5 text-sm font-semibold text-foreground"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-trust" />
          <span>Envoi du média — patiente, ne clique pas encore.</span>
        </div>
      ) : null}
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
        onClick={() => {
          if (inputRef.current) inputRef.current.value = "";
          inputRef.current?.click();
        }}
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
        {uploading ? "Chargement…" : "Ajouter images / vidéos"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        {urls.length}/{cap}
        {urls.length > 0
          ? " — 1re = couverture. Touchez une vignette pour détails · ★ pour principale."
          : " — au moins une image pour publier."}
      </p>

      {urls.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 pt-1">
          {urls.map((src, index) => {
            const video = isVideoUrl(src);
            const probe = probes[src];
            return (
              <li
                key={`${src}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border"
              >
                <button
                  type="button"
                  className="size-full text-left"
                  onClick={() => setActive(src)}
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
                </button>
                {index === 0 ? (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#04281c]">
                    Couverture
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPrimary(index);
                    }}
                    className="absolute bottom-1.5 left-1.5 z-20 grid size-7 place-items-center rounded-full bg-black/75 text-amber-300"
                    aria-label="Définir comme principale"
                  >
                    <Star className="size-3.5" />
                  </button>
                )}
                {probe && !video ? (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {formatRatio(probe.ratio)}
                  </span>
                ) : null}
                {probe?.warning ? (
                  <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-amber-400 px-1.5 text-[9px] font-bold text-black">
                    !
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeAt(index);
                  }}
                  className="absolute top-0 right-0 z-20 grid size-11 place-items-center text-white disabled:opacity-40"
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
      ) : null}

      {active && activeProbe ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Aperçu · contain</p>
              <p className="text-[11px] text-muted-foreground">
                {activeProbe.width}×{activeProbe.height} ·{" "}
                {formatRatio(activeProbe.ratio)}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground"
              onClick={() => setActive(null)}
            >
              Fermer
            </button>
          </div>
          {activeProbe.warning ? (
            <p className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] text-amber-200">
              {activeProbe.warning}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">{activeProbe.tip}</p>
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl bg-black/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
