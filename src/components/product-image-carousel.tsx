"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  clearFeedVideoScore,
  requestFeedVideoPlay,
  setFeedVideoScore,
  subscribeFeedVideoActive,
} from "@/lib/feed-video-playback";
import { isVideoUrl } from "@/lib/media";
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
  /** Sons vidéo — muet par défaut (autoplay). */
  muted?: boolean;
  /** Volume 0–1 quand unmuted (défaut 0.3). */
  volume?: number;
};

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
}: {
  src: string;
  playing: boolean;
  shouldLoad: boolean;
  fit: "cover" | "contain";
  muted: boolean;
  volume: number;
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
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, shouldLoad, src, video]);

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
        el.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing, shouldLoad, video]);

  if (video) {
    return (
      <video
        ref={videoRef}
        muted={muted}
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        className={mediaClass(fit)}
        style={{ objectPosition: "center center" }}
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
      className={mediaClass(fit)}
      style={{ objectPosition: "center center" }}
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
  muted = true,
  volume = 0.3,
}: Props) {
  const list =
    images.length > 0
      ? images
      : ["https://picsum.photos/seed/chipshop/800/1000"];
  const feedId = useId();
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

  const hasVideo = list.some((url) => isVideoUrl(url));
  const currentIsVideo = isVideoUrl(list[index] ?? "");

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
          { root, rootMargin: "80px 0px", threshold: 0.01 },
        );

    const playIo = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const ratio = entry.intersectionRatio;

        if (hasVideo && !eager) {
          setFeedVideoScore(feedId, ratio);
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
    };
  }, [eager, feedId, hasVideo]);

  useEffect(() => {
    if (list.length <= 1 || manualHold || !inView) return;
    if (hasVideo && currentIsVideo) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [
    list.length,
    intervalMs,
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

    // Tap (pas un swipe) sur une vidéo → 1er clic pause, 2e clic lecture
    const isTap = Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX;
    if (isTap && currentIsVideo) {
      const slotActive = eager ? inView : feedActiveIds.has(feedId);
      const isPlayingNow = slotActive && !userPaused;
      if (isPlayingNow) {
        setUserPaused(true);
      } else {
        setUserPaused(false);
        if (!eager) requestFeedVideoPlay(feedId);
      }
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
  const cardMayPlay = slotActive && !userPaused;

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
                src={src}
                playing={playing}
                shouldLoad={shouldLoad}
                fit={fit}
                muted={muted}
                volume={volume}
              />
            ) : null}
            {overlay && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/95 via-[#0a0a0f]/25 to-transparent" />
            )}
          </div>
        );
      })}
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
