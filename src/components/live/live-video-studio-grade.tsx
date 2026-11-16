"use client";

import {
    defaultFacePose,
    eyeDistance,
    type FacePose,
    type Vec2,
} from "@/lib/growth/live-face-tracking";
import {
    liveVideoFilterCss,
    resolveLiveVideoFilter,
} from "@/lib/growth/live-video-filters";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function stickerStyle(
  pose: FacePose,
  point: Vec2,
  scale: number,
  opacity: number,
): CSSProperties {
  const rot = (pose.roll * 180) / Math.PI;
  const sizeScale = clamp(pose.width / 0.42, 0.75, 1.45) * scale;
  return {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    opacity,
    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${sizeScale})`,
  };
}

/** Grade couleur + stickers ancrés au visage (uniquement si filtre ≠ naturel). */
export function LiveVideoStudioGrade({
  filterId,
  pose,
  className,
}: {
  filterId?: string | null;
  pose?: FacePose | null;
  className?: string;
}) {
  const row = resolveLiveVideoFilter(filterId);
  if (row.id === "natural") return null;

  const face = pose ?? defaultFacePose();
  const opacity = face.confidence >= 0.35 ? face.confidence : 0;
  const eyeScale = clamp(eyeDistance(face) / 0.24, 0.8, 1.5);
  const midEyes = {
    x: (face.leftEye.x + face.rightEye.x) / 2,
    y: (face.leftEye.y + face.rightEye.y) / 2,
  };
  const anchorPoint =
    row.anchor === "head"
      ? face.headTop
      : row.anchor === "eyes"
        ? midEyes
        : row.anchor === "nose"
          ? face.nose
          : face.center;

  const sparklePts = [
    { x: face.headTop.x - 0.12, y: face.headTop.y + 0.04 },
    { x: face.headTop.x + 0.1, y: face.headTop.y + 0.02 },
    { x: face.leftEye.x - 0.08, y: face.leftEye.y - 0.06 },
    { x: face.rightEye.x + 0.08, y: face.rightEye.y - 0.06 },
    { x: face.nose.x, y: face.nose.y + 0.12 },
  ];

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[2]", className)}
      aria-hidden
    >
      {row.grade ? (
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{ backgroundImage: row.grade }}
        />
      ) : null}
      {row.id === "studio" || row.id === "soft" || row.id === "warm" ? (
        <div className="absolute inset-0 bg-[rgba(255,175,145,0.05)] mix-blend-overlay" />
      ) : null}
      {row.id === "blush" ? (
        <>
          <span
            className="absolute h-7 w-14 rounded-full bg-[rgba(255,120,140,0.22)]"
            style={stickerStyle(
              face,
              {
                x: face.center.x - face.width * 0.28,
                y: face.center.y + 0.04,
              },
              1,
              opacity,
            )}
          />
          <span
            className="absolute h-7 w-14 rounded-full bg-[rgba(255,120,140,0.22)]"
            style={stickerStyle(
              face,
              {
                x: face.center.x + face.width * 0.28,
                y: face.center.y + 0.04,
              },
              1,
              opacity,
            )}
          />
        </>
      ) : null}
      {row.kind === "overlay" && row.emoji && row.anchor !== "ears" ? (
        <div
          className="absolute text-[clamp(2.5rem,8vw,3.75rem)] drop-shadow-lg"
          style={stickerStyle(
            face,
            anchorPoint,
            row.anchor === "eyes" ? eyeScale : 1,
            opacity,
          )}
        >
          {row.emoji}
        </div>
      ) : null}
      {(row.anchor === "ears" || row.id === "earrings") && row.emoji ? (
        <>
          {face.leftEarVisible ? (
            <div
              className="absolute text-[clamp(1.5rem,4vw,2.25rem)] drop-shadow-lg"
              style={stickerStyle(face, face.leftEar, 0.85, opacity)}
            >
              {row.emoji}
            </div>
          ) : null}
          {face.rightEarVisible ? (
            <div
              className="absolute text-[clamp(1.5rem,4vw,2.25rem)] drop-shadow-lg"
              style={stickerStyle(face, face.rightEar, 0.85, opacity)}
            >
              {row.emoji}
            </div>
          ) : null}
        </>
      ) : null}
      {row.kind === "animation" && row.emoji && row.id !== "sparkle" ? (
        <>
          {face.leftEarVisible ? (
            <div
              className="absolute animate-pulse text-[clamp(1.75rem,5vw,2.5rem)]"
              style={stickerStyle(face, face.leftEar, 1, opacity)}
            >
              {row.emoji}
            </div>
          ) : null}
          {face.rightEarVisible ? (
            <div
              className="absolute animate-pulse text-[clamp(1.75rem,5vw,2.5rem)]"
              style={stickerStyle(face, face.rightEar, 1, opacity)}
            >
              {row.emoji}
            </div>
          ) : null}
        </>
      ) : null}
      {row.id === "sparkle"
        ? sparklePts.map((pt, i) => (
            <span
              key={`${pt.x}-${i}`}
              className="absolute animate-pulse text-amber-200"
              style={{
                ...stickerStyle(face, pt, 1, opacity),
                fontSize: `${14 + (i % 3) * 6}px`,
              }}
            >
              ✦
            </span>
          ))
        : null}
    </div>
  );
}

const QUALITY_LABEL: Record<string, string> = {
  excellent: "HD",
  good: "Bon",
  poor: "Réseau faible",
  lost: "Connexion perdue",
};

/** Indicateur réseau du présentateur. */
export function LiveConnectionBadge({ quality }: { quality: string }) {
  const key = quality.toLowerCase();
  const label = QUALITY_LABEL[key];
  if (!label) return null;
  const warn = key === "poor" || key === "lost";
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-[6] flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white",
        warn ? "bg-[rgba(120,40,10,0.72)]" : "bg-black/45",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          warn ? "bg-amber-300" : "bg-[#00D68F]",
        )}
      />
      {label}
    </div>
  );
}

/** Style CSS `filter` pour les `<video>` — undefined si naturel. */
export function liveVideoFilterStyle(
  filterId?: string | null,
): CSSProperties | undefined {
  const css = liveVideoFilterCss(filterId);
  if (!css) return undefined;
  return { filter: css };
}
