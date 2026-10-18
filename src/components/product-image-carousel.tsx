"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Heart } from "lucide-react";
import {
  clearFeedAudioScore,
  requestFeedAudioFocus,
  setFeedAudioScore,
} from "@/lib/feed-audio-focus";
import {
  clearFeedVideoScore,
  requestFeedVideoPlay,
  setFeedVideoScore,
  subscribeFeedVideoActive,
} from "@/lib/feed-video-playback";
import { isVideoUrl } from "@/lib/media";
import {
  defaultSlideMotion,
  slideshowSlotMs,
  type SlideMotion,
} from "@/lib/montage";
import {
  useFrozenPageKey,
  usePageMediaLive,
} from "@/lib/page-media-session";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  className?: string;
  intervalMs?: number;
  showDots?: boolean;
  overlay?: boolean;
  /** cover = remplit la card ; contain = image entière visible */
  fit?: "cover" | "contain";
  /** Charge tout de suite (fiche produit). Sinon, seulement hors écran proche. */
  eager?: boolean;
  /** Sons vidéo — volume 100 % par défaut. */
  muted?: boolean;
  /** Volume 0–1 quand unmuted (défaut 1). */
  volume?: number;
  /** Montage : le son importé passe en premier, la vidéo d’origine reste muette. */
  hasSoundtrack?: boolean;
  onDoubleLike?: () => void;
  onAutoplayBlocked?: () => void;
  /** Id produit : un seul son (vidéo / musique) à la fois dans le feed. */
  audioKey?: string;
  onActivateSound?: () => void;
  /** false = la vidéo s’arrête en fin de clip (file Découvrir). */
  loop?: boolean;
  onPlaybackEnded?: () => void;
  /** Styles Ken Burns (même ordre que images). */
  motions?: string[];
  /** Minute de son : le diaporama couvre toute la fenêtre (lent s’il y a peu d’images). */
  clipMs?: number;
};

function HeartBurst() {
  return (
    <span className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <Heart className="size-20 fill-white text-white drop-shadow-lg animate-in zoom-in-50 fade-in duration-200" />
    </span>
  );
}

const SWIPE_MIN_PX = 42;
const TAP_MAX_PX = 12;
const IN_VIEW_RATIO = 0.5;
const LEFT_VIEW_RATIO = 0.35;

function mediaClass(fit: "cover" | "contain") {
  return cn(
    "pointer-events-none",
    fit === "cover"
      ? "absolute inset-0 size-full object-cover object-center"
      : "max-h-full max-w-full object-contain object-center",
  );
}

function SlideMedia({
  src,
  playing,
  shouldLoad,
  fit,
  muted,
  volume,
  loop,
  onAutoplayBlocked,
  onPlaybackEnded,
  motion,
  motionMs,
  animate,
}: {
  src: string;
  playing: boolean;
  shouldLoad: boolean;
  fit: "cover" | "contain";
  muted: boolean;
  volume: number;
  loop: boolean;
  onAutoplayBlocked?: () => void;
  onPlaybackEnded?: () => void;
  motion?: SlideMotion;
  motionMs?: number;
  animate?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = isVideoUrl(src);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;

    if (!shouldLoad) {
      el.pause();
      // Hors écran seulement : on libère. Pause user → shouldLoad reste true
      // pour reprendre au même currentTime.
      el.removeAttribute("src");
      el.load();
      return;
    }

    if (el.getAttribute("src") !== src) {
      el.src = src;
      el.load();
    }

    // pause() / play() sans reset → reprend exactement où on s’était arrêté
    if (playing && !document.hidden) {
      el.play().catch(() => {
        onAutoplayBlocked?.();
      });
    } else {
      el.pause();
    }
    return () => {
      el.pause();
    };
  }, [playing, shouldLoad, src, video, onAutoplayBlocked]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    el.muted = muted;
    el.volume = Math.min(1, Math.max(0, volume));
  }, [muted, volume, video]);

  useEffect(() => {
    if (!video) return;
    const onVis = () => {
      const el = videoRef.current;
      if (!el) return;
      if (document.hidden) {
        el.pause();
      } else if (playing && shouldLoad) {
        el.play().catch(() => {
          onAutoplayBlocked?.();
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing, shouldLoad, video]);

  const ken = Boolean(motion && animate);
  const kenStyle = {
    objectPosition: "center center",
    ["--ss-ms" as string]: `${Math.max(800, motionMs ?? 3200)}ms`,
  };

  if (video) {
    return (
      <video
        ref={videoRef}
        muted={muted}
        loop={loop}
        playsInline
        preload="none"
        disablePictureInPicture
        onEnded={() => {
          if (!loop) onPlaybackEnded?.();
        }}
        className={cn(mediaClass(fit), ken && "ss-ken")}
        data-motion={ken ? motion : undefined}
        style={kenStyle}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      loading={playing ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={playing ? "high" : "low"}
      className={cn(mediaClass(fit), ken && "ss-ken")}
      data-motion={ken ? motion : undefined}
      style={kenStyle}
    />
  );
}

function scrollRootFor(el: HTMLElement): Element | null {
  const snap = el.closest(".feed-snap");
  if (snap instanceof HTMLElement) {
    const overflowY = getComputedStyle(snap).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return snap;
  }
  const main = el.closest(".app-main");
  return main instanceof HTMLElement ? main : null;
}

export function ProductImageCarousel({
  images,
  className,
  intervalMs = 3200,
  showDots = true,
  overlay = false,
  fit = "cover",
  eager = false,
  muted = false,
  volume = 1,
  hasSoundtrack = false,
  onDoubleLike,
  onAutoplayBlocked,
  audioKey,
  onActivateSound,
  loop = true,
  onPlaybackEnded,
  motions,
  clipMs,
}: Props) {
  const videoMuted = hasSoundtrack || muted;
  const list =
    images.length > 0
      ? images
      : ["https://picsum.photos/seed/chipshop/800/1000"];
  const feedId = useId();
  const pageKey = useFrozenPageKey();
  const pageLive = usePageMediaLive();
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(eager);
  const [nearView, setNearView] = useState(eager);
  const [feedActiveIds, setFeedActiveIds] = useState<ReadonlySet<string>>(
    () => new Set(eager ? [feedId] : []),
  );
  const [manualHold, setManualHold] = useState(false);
  /** Clic 1 = pause, clic 2 = lecture */
  const [userPaused, setUserPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const lockedAxis = useRef<"x" | "y" | null>(null);
  const lastTapRef = useRef(0);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [likeBurst, setLikeBurst] = useState(false);

  const hasVideo = list.some((url) => isVideoUrl(url));
  const currentIsVideo = isVideoUrl(list[index] ?? "");
  const coverSrc = list[0];

  useEffect(() => {
    if (!nearView || !coverSrc) return;
    if (isVideoUrl(coverSrc)) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = coverSrc;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
    const img = new Image();
    img.src = coverSrc;
  }, [nearView, coverSrc]);

  useEffect(() => {
    if (eager || !hasVideo) return;
    return subscribeFeedVideoActive(setFeedActiveIds);
  }, [eager, hasVideo]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const target =
      el.closest(".feed-snap-item") instanceof HTMLElement
        ? (el.closest(".feed-snap-item") as HTMLElement)
        : el;
    const root = scrollRootFor(el);

    const loadIo = eager
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            if (!entry) return;
            setNearView(entry.isIntersecting);
          },
          { root, rootMargin: "120% 0px", threshold: 0.01 },
        );

    const playIo = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const ratio = entry.intersectionRatio;

        if (hasVideo && !eager) {
          setFeedVideoScore(feedId, ratio, pageKey);
        }
        if (audioKey) {
          setFeedAudioScore(
            audioKey,
            {
              ratio,
              left: entry.boundingClientRect.left,
            },
            pageKey,
          );
        }

        if (ratio < LEFT_VIEW_RATIO) {
          setInView(false);
          setManualHold(false);
          setUserPaused(false);
          return;
        }
        if (ratio >= IN_VIEW_RATIO) {
          setInView(true);
        }
      },
      {
        root,
        threshold: [0, 0.2, LEFT_VIEW_RATIO, IN_VIEW_RATIO, 0.65, 0.85, 1],
      },
    );

    loadIo?.observe(target);
    playIo.observe(target);
    return () => {
      loadIo?.disconnect();
      playIo.disconnect();
      if (hasVideo && !eager) clearFeedVideoScore(feedId);
      if (audioKey) clearFeedAudioScore(audioKey);
    };
  }, [audioKey, eager, feedId, hasVideo, pageKey]);

  const slotMs = clipMs
    ? slideshowSlotMs(list.length, clipMs)
    : intervalMs;

  useEffect(() => {
    if (list.length <= 1 || manualHold || !inView) return;
    if (!clipMs && hasVideo && currentIsVideo) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, slotMs);
    return () => clearInterval(t);
  }, [
    list.length,
    slotMs,
    clipMs,
    manualHold,
    inView,
    hasVideo,
    currentIsVideo,
  ]);

  function goManual(next: number) {
    setIndex(((next % list.length) + list.length) % list.length);
    setManualHold(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    lockedAxis.current = null;
    try {
      rootRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!lockedAxis.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (lockedAxis.current === "x") {
      e.preventDefault();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const axis = lockedAxis.current;
    startRef.current = null;
    lockedAxis.current = null;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const isTap = Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX;
    if (isTap) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (pendingTapRef.current) {
          clearTimeout(pendingTapRef.current);
          pendingTapRef.current = null;
        }
        lastTapRef.current = 0;
        onDoubleLike?.();
        setLikeBurst(true);
        window.setTimeout(() => setLikeBurst(false), 700);
        return;
      }
      lastTapRef.current = now;
      pendingTapRef.current = setTimeout(() => {
        pendingTapRef.current = null;
        if (onActivateSound) {
          onActivateSound();
        } else if (audioKey) {
          requestFeedAudioFocus(audioKey);
        }
        if (!currentIsVideo) return;
        const slotActive = eager ? inView : feedActiveIds.has(feedId);
        const isPlayingNow = slotActive && !userPaused;
        if (isPlayingNow && audioKey) {
          return;
        }
        if (isPlayingNow) {
          setUserPaused(true);
        } else {
          setUserPaused(false);
          if (!eager) requestFeedVideoPlay(feedId);
        }
      }, 280);
      return;
    }

    if (list.length <= 1) return;
    if (axis !== "x" || Math.abs(dx) < SWIPE_MIN_PX) return;
    if (dx < 0) goManual(index + 1);
    else goManual(index - 1);
  }

  function onPointerCancel() {
    startRef.current = null;
    lockedAxis.current = null;
  }

  const slotActive = eager
    ? inView
    : hasVideo
      ? feedActiveIds.has(feedId)
      : inView;
  const cardMayPlay = pageLive && slotActive && !userPaused;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative touch-pan-y overflow-hidden bg-surface-2 select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="group"
      aria-roledescription="carousel"
      aria-label="Images produit"
    >
      {list.map((src, i) => {
        const active = i === index;
        const isVid = isVideoUrl(src);
        const neighbor =
          list.length > 1 &&
          (i === (index + 1) % list.length ||
            i === (index - 1 + list.length) % list.length);

        const mount = (() => {
          if (eager) return active || neighbor;
          if (!nearView) return false;
          if (isVid) return active;
          return active || neighbor;
        })();

        const playing = active && cardMayPlay;
        // Garder le média chargé pendant une pause user (sinon currentTime = 0)
        const shouldLoad = isVid
          ? Boolean(
              mount &&
                (slotActive || userPaused || (eager && (nearView || inView))),
            )
          : Boolean(mount);

        return (
          <div
            key={`${src}-${i}`}
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-500",
              active ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            aria-hidden={!active}
          >
            {mount ? (
              <SlideMedia
                key={`${src}-${i}-${active ? "on" : "off"}`}
                src={src}
                playing={playing}
                shouldLoad={shouldLoad}
                fit={fit}
                muted={videoMuted}
                volume={volume}
                loop={loop}
                onAutoplayBlocked={onAutoplayBlocked}
                onPlaybackEnded={active ? onPlaybackEnded : undefined}
                motion={
                  (motions?.[i] as SlideMotion | undefined) ??
                  defaultSlideMotion(i)
                }
                motionMs={slotMs}
                animate={active && (Boolean(clipMs) || list.length > 1)}
              />
            ) : null}
            {overlay && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/95 via-[#0a0a0f]/25 to-transparent" />
            )}
          </div>
        );
      })}
      {likeBurst && (
        <HeartBurst />
      )}
      {showDots && list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Image ${i + 1}`}
              aria-current={i === index}
              onClick={(e) => {
                e.stopPropagation();
                goManual(i);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
