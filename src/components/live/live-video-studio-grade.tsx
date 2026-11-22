"use client";

import {
    defaultFacePose,
    eyeDistance,
    midEyesPoint,
    propSizeCqw,
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
  opacity: number,
  opts?: {
    tx?: string;
    ty?: string;
    scaleX?: number;
    scaleY?: number;
  },
): CSSProperties {
  const rot = (pose.roll * 180) / Math.PI;
  const tx = opts?.tx ?? "-50%";
  const ty = opts?.ty ?? "-50%";
  const sx = opts?.scaleX ?? 1;
  const sy = opts?.scaleY ?? 1;
  return {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    opacity,
    transform: `translate(${tx}, ${ty}) rotate(${rot}deg) scale(${sx}, ${sy})`,
  };
}

/** Grade couleur + stickers / blush ancrés aux landmarks (MediaPipe ou idle). */
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
  const midEyes = midEyesPoint(face);
  const eyeSpan = eyeDistance(face);
  const glassesScaleX = clamp(eyeSpan / 0.22, 1.08, 1.55);

  const sparklePts = [
    { x: face.headTop.x - 0.12, y: face.headTop.y + 0.04 },
    { x: face.headTop.x + 0.1, y: face.headTop.y + 0.02 },
    { x: face.leftEye.x - 0.08, y: face.leftEye.y - 0.06 },
    { x: face.rightEye.x + 0.08, y: face.rightEye.y - 0.06 },
    { x: face.nose.x, y: face.nose.y + 0.12 },
  ];

  const headSize = propSizeCqw(face, "head", 1.15);
  const glassesSize = propSizeCqw(face, "eyes", 1.25);
  const earSize = propSizeCqw(face, "earLeft");
  const faceSize = propSizeCqw(face, "face");
  const blushW = clamp(face.width * 42, 14, 28);
  const blushH = clamp(face.height * 18, 7, 14);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[2] [container-type:size]",
        className,
      )}
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
            className="absolute rounded-full bg-[rgba(255,110,130,0.34)] mix-blend-multiply blur-[1px]"
            style={{
              ...stickerStyle(face, face.leftCheek, opacity * 0.95, {
                tx: "-50%",
                ty: "-50%",
              }),
              width: `${blushW}cqw`,
              height: `${blushH}cqw`,
            }}
          />
          <span
            className="absolute rounded-full bg-[rgba(255,110,130,0.34)] mix-blend-multiply blur-[1px]"
            style={{
              ...stickerStyle(face, face.rightCheek, opacity * 0.95, {
                tx: "-50%",
                ty: "-50%",
              }),
              width: `${blushW}cqw`,
              height: `${blushH}cqw`,
            }}
          />
          <div
            className="absolute inset-0 mix-blend-soft-light"
            style={{
              background: `radial-gradient(ellipse at ${face.center.x * 100}% ${face.center.y * 100}%, rgba(255,200,190,${0.16 * opacity}) 0%, transparent 42%)`,
            }}
          />
        </>
      ) : null}

      {row.kind === "overlay" && row.emoji && row.anchor === "head" ? (
        <div
          className="absolute drop-shadow-lg leading-none"
          style={{
            ...stickerStyle(face, face.headTop, opacity, {
              tx: "-50%",
              ty: "-88%",
              scaleX: 1.08,
              scaleY: 1.02,
            }),
            fontSize: `${headSize}cqw`,
          }}
        >
          {row.emoji}
        </div>
      ) : null}

      {row.kind === "overlay" && row.emoji && row.anchor === "eyes" ? (
        <div
          className="absolute drop-shadow-lg leading-none"
          style={{
            ...stickerStyle(face, midEyes, opacity, {
              tx: "-50%",
              ty: "-42%",
              scaleX: glassesScaleX,
              scaleY: 0.92,
            }),
            fontSize: `${glassesSize}cqw`,
          }}
        >
          {row.emoji}
        </div>
      ) : null}

      {row.kind === "overlay" &&
      row.emoji &&
      row.anchor !== "ears" &&
      row.anchor !== "head" &&
      row.anchor !== "eyes" ? (
        <div
          className="absolute drop-shadow-lg leading-none"
          style={{
            ...stickerStyle(face, face.center, opacity),
            fontSize: `${faceSize}cqw`,
          }}
        >
          {row.emoji}
        </div>
      ) : null}

      {(row.anchor === "ears" || row.id === "earrings") && row.emoji ? (
        <>
          {face.leftEarVisible ? (
            <div
              className="absolute drop-shadow-lg leading-none"
              style={{
                ...stickerStyle(face, face.leftEar, opacity),
                fontSize: `${earSize}cqw`,
              }}
            >
              {row.emoji}
            </div>
          ) : null}
          {face.rightEarVisible ? (
            <div
              className="absolute drop-shadow-lg leading-none"
              style={{
                ...stickerStyle(face, face.rightEar, opacity),
                fontSize: `${earSize}cqw`,
              }}
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
              className="absolute animate-pulse leading-none"
              style={{
                ...stickerStyle(face, face.leftEar, opacity),
                fontSize: `${earSize * 1.1}cqw`,
              }}
            >
              {row.emoji}
            </div>
          ) : null}
          {face.rightEarVisible ? (
            <div
              className="absolute animate-pulse leading-none"
              style={{
                ...stickerStyle(face, face.rightEar, opacity),
                fontSize: `${earSize * 1.1}cqw`,
              }}
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
                ...stickerStyle(face, pt, opacity),
                fontSize: `${headSize * 0.28 + (i % 3) * 4}cqw`,
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
