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
    parseLiveVideoFilterCombo,
    type LiveVideoFilter,
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
    scale?: number;
  },
): CSSProperties {
  const rot = (pose.roll * 180) / Math.PI;
  const tx = opts?.tx ?? "-50%";
  const ty = opts?.ty ?? "-50%";
  const sx = opts?.scaleX ?? opts?.scale ?? 1;
  const sy = opts?.scaleY ?? opts?.scale ?? 1;
  return {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    opacity,
    transform: `translate(${tx}, ${ty}) rotate(${rot}deg) scale(${sx}, ${sy})`,
  };
}

function PropStickers({
  prop,
  face,
  opacity,
}: {
  prop: LiveVideoFilter;
  face: FacePose;
  opacity: number;
}) {
  if (!prop.emoji) return null;
  const midEyes = midEyesPoint(face);
  const eyeSpan = eyeDistance(face);
  const glassesScaleX = clamp(eyeSpan / 0.22, 1.08, 1.55);

  if (prop.id === "sparkle") {
    const spark = propSizeCqw(face, "head") * 0.28;
    const sparklePts = [
      { x: face.headTop.x - 0.12, y: face.headTop.y + 0.02 },
      { x: face.headTop.x + 0.1, y: face.headTop.y },
      { x: face.leftEye.x - 0.08, y: face.leftEye.y - 0.06 },
      { x: face.rightEye.x + 0.08, y: face.rightEye.y - 0.06 },
      { x: face.nose.x, y: face.nose.y + 0.12 },
    ];
    return (
      <>
        {sparklePts.map((pt, i) => (
          <span
            key={`${pt.x}-${i}`}
            className="absolute animate-pulse text-amber-200"
            style={{
              ...stickerStyle(face, pt, opacity),
              fontSize: `${spark + (i % 3) * 4}cqw`,
            }}
          >
            ✦
          </span>
        ))}
      </>
    );
  }

  if (prop.anchor === "ears" || prop.id === "earrings") {
    const earSize = propSizeCqw(face, "earLeft");
    return (
      <>
        {face.leftEarVisible ? (
          <div
            className="absolute drop-shadow-lg leading-none"
            style={{
              ...stickerStyle(face, face.leftEar, opacity),
              fontSize: `${earSize}cqw`,
            }}
          >
            {prop.emoji}
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
            {prop.emoji}
          </div>
        ) : null}
      </>
    );
  }

  if (prop.kind === "animation" && prop.id !== "sparkle") {
    const earSize = propSizeCqw(face, "earLeft", 1.1);
    return (
      <>
        {face.leftEarVisible ? (
          <div
            className="absolute animate-pulse leading-none"
            style={{
              ...stickerStyle(face, face.leftEar, opacity),
              fontSize: `${earSize}cqw`,
            }}
          >
            {prop.emoji}
          </div>
        ) : null}
        {face.rightEarVisible ? (
          <div
            className="absolute animate-pulse leading-none"
            style={{
              ...stickerStyle(face, face.rightEar, opacity),
              fontSize: `${earSize}cqw`,
            }}
          >
            {prop.emoji}
          </div>
        ) : null}
      </>
    );
  }

  if (prop.kind !== "overlay") return null;

  // Chapeau / couronne : sommet du crâne, largeur ≈ visage.
  if (prop.anchor === "head") {
    const headSize = propSizeCqw(face, "head", 1.15);
    return (
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
        {prop.emoji}
      </div>
    );
  }

  // Lunettes : milieu des yeux, largeur calée sur l’écart oculaire.
  if (prop.anchor === "eyes") {
    const glassesSize = propSizeCqw(face, "eyes", 1.2);
    return (
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
        {prop.emoji}
      </div>
    );
  }

  const faceSize = propSizeCqw(face, "face");
  return (
    <div
      className="absolute drop-shadow-lg leading-none"
      style={{
        ...stickerStyle(face, face.center, opacity),
        fontSize: `${faceSize}cqw`,
      }}
    >
      {prop.emoji}
    </div>
  );
}

/** Grade couleur + stickers ancrés — teint et accessoire simultanés (`studio+glasses`). */
export function LiveVideoStudioGrade({
  filterId,
  pose,
  className,
}: {
  filterId?: string | null;
  pose?: FacePose | null;
  className?: string;
}) {
  const combo = parseLiveVideoFilterCombo(filterId);
  if (!combo.tone && !combo.prop) return null;

  const face = pose ?? defaultFacePose();
  const opacity = face.confidence >= 0.35 ? face.confidence : 0;
  const tone = combo.tone;
  const prop = combo.prop;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[2] [container-type:size]",
        className,
      )}
      aria-hidden
    >
      {tone?.grade ? (
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{ backgroundImage: tone.grade }}
        />
      ) : null}
      {tone &&
      (tone.id === "studio" || tone.id === "soft" || tone.id === "warm") ? (
        <div className="absolute inset-0 bg-[rgba(255,175,145,0.05)] mix-blend-overlay" />
      ) : null}
      {tone?.id === "blush" || prop?.id === "blush" ? (
        <>
          <span
            className="absolute h-7 w-14 rounded-full bg-[rgba(255,120,140,0.22)]"
            style={stickerStyle(
              face,
              {
                x: face.center.x - face.width * 0.28,
                y: face.center.y + 0.04,
              },
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
              opacity,
            )}
          />
        </>
      ) : null}
      {prop ? <PropStickers prop={prop} face={face} opacity={opacity} /> : null}
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
