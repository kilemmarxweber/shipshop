"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { compactCount } from "@/lib/growth/challenge-look";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import type { UserLocale } from "@/lib/user-locale";

export function Face({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: "sm" | "md";
}) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3a3040] text-[10px] font-bold text-white ring-2 ring-[#0f0f16]",
        size === "sm" ? "size-6" : "size-7",
      )}
    >
      {image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

export function SellerMeta({
  name,
  image,
  views,
  locale,
  viewsLabel,
  likes,
}: {
  name: string;
  image: string | null;
  views: number;
  locale: UserLocale;
  viewsLabel: string;
  likes?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Face name={name} image={image} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-tight text-white">
            {name}
          </p>
          <p className="text-[11px] leading-tight text-white/65">
            {compactCount(views, locale)} {viewsLabel}
          </p>
        </div>
      </div>
      {likes != null ? (
        <p className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-white">
          <Heart className="size-3.5" />
          {compactCount(likes, locale)}
        </p>
      ) : null}
    </div>
  );
}

export function CoverImage({
  candidates,
  className,
}: {
  candidates: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
}

/** Spotlight challenge : image (jpg/png/webp) ou courte vidéo. */
export function ChallengeSpotlightMedia({
  spotlight,
  fallbackCandidates = [],
  className,
}: {
  spotlight?: {
    url: string;
    kind: "image" | "video";
    posterUrl?: string | null;
  } | null;
  fallbackCandidates?: string[];
  className?: string;
}) {
  if (spotlight?.kind === "video" && spotlight.url) {
    // Pas de filter/transform sur le wrapper ni la vidéo (Safari iOS / WebView → noir).
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-[#1a1a22] [contain:paint] ![filter:none]",
          className,
        )}
      >
        <video
          className="challenge-spot-video absolute inset-0 size-full object-cover ![filter:none]"
          src={spotlight.url}
          poster={spotlight.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          {...iosInlineVideo}
          preload="metadata"
          disablePictureInPicture
        />
      </div>
    );
  }
  const candidates = [
    ...(spotlight?.url ? [spotlight.url] : []),
    ...fallbackCandidates,
  ].filter((url, i, all) => Boolean(url) && all.indexOf(url) === i);
  return <CoverImage candidates={candidates} className={className} />;
}
