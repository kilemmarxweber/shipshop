"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import {
  isVideoUrl,
  mediaCoverUrl,
  videoPosterUrl,
} from "@/lib/media";
import { cn } from "@/lib/utils";

type Props = {
  /** Liste médias produit (préfère une image, sinon poster vidéo). */
  images?: string[];
  /** URL unique (image ou vidéo). */
  src?: string | null;
  className?: string;
  /** Affiche une petite icône film sur les vignettes vidéo. */
  showFilmIcon?: boolean;
};

/**
 * Miniature toujours remplie : image, poster .jpg de la vidéo, ou 1ère frame.
 */
export function MediaThumb({
  images,
  src,
  className,
  showFilmIcon = true,
}: Props) {
  const raw = src ?? images?.[0] ?? null;
  const cover =
    (images?.length ? mediaCoverUrl(images) : null) ??
    (raw && isVideoUrl(raw) ? videoPosterUrl(raw) : raw);

  const videoSrc = raw && isVideoUrl(raw) ? raw : images?.find(isVideoUrl);
  const [posterFailed, setPosterFailed] = useState(false);
  const useVideoFrame = Boolean(videoSrc) && (posterFailed || !cover || isVideoUrl(cover ?? ""));

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-black bg-cover bg-center [filter:brightness(1.06)_contrast(1.05)_saturate(1.04)]",
        className,
      )}
      style={
        !useVideoFrame && cover && !isVideoUrl(cover)
          ? { backgroundImage: `url(${cover})` }
          : undefined
      }
    >
      {useVideoFrame && videoSrc ? (
        <video
          src={`${videoSrc}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none absolute inset-0 size-full object-cover [filter:brightness(1.06)_contrast(1.05)]"
        />
      ) : null}
      {!useVideoFrame && cover && !isVideoUrl(cover) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-0"
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      {showFilmIcon && videoSrc ? (
        <Film className="pointer-events-none absolute right-1 bottom-1 size-3.5 text-white/90 drop-shadow" />
      ) : null}
    </div>
  );
}
