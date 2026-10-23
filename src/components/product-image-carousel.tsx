"use client";

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
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
import { isVideoUrl, videoPosterUrl } from "@/lib/media";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import {
  SOUND_UNLOCK_EVENT,
  isIosDevice,
  tryPlayMedia,
} from "@/lib/try-play-media";
import {
  playbackMotion,
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
  /** reel = image entière + fond flou (fil) ; cover = recadre ; contain = lettrebox */
  fit?: "cover" | "contain" | "reel";
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
  /** Découvrir : la tuile choisie joue même si elle n’est pas la 1re de la grille. */
  forcePlay?: boolean;
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

function mediaClass(fit: "cover" | "contain" | "reel") {
  if (fit === "reel") return "ss-reel-fg";
  if (fit === "cover") return "ss-reel-fg-cover";
  return "pointer-events-none max-h-full max-w-full object-contain object-center";
}

function portraitFocusVars(mediaRatio: number | null): CSSProperties | undefined {
  if (!mediaRatio || mediaRatio >= 0.9) return undefined;
  // 0 at ratio 0.9, 1 at ratio 0.5: tighter portraits get stronger top focus.
  const strength = Math.min(1, Math.max(0, (0.9 - mediaRatio) / 0.4));
  const objectY = 22 - strength * 8; // 22% -> 14%
  const topY = 54 + strength * 4; // 54% -> 58%
  return {
    ["--ss-portrait-y" as string]: `${objectY.toFixed(1)}%`,
    ["--ss-portrait-top" as string]: `${topY.toFixed(1)}%`,
  } as CSSProperties;
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
  fit: "cover" | "contain" | "reel";
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
  const poster = video ? videoPosterUrl(src) : src;
  const [mediaRatio, setMediaRatio] = useState<number | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const [posterBroken, setPosterBroken] = useState(false);
  const portraitFocus = Boolean(mediaRatio && mediaRatio < 0.9);
  const portraitVars = portraitFocusVars(mediaRatio);
  const applied = video ? undefined : motion;
  const fill = fit === "reel";
  const applyRatio = !fill;
  const displaySrc = imgBroken && !video ? null : src;
  const displayPoster = posterBroken ? undefined : poster;

  useEffect(() => {
    setImgBroken(false);
    setPosterBroken(false);
    setMediaRatio(null);
  }, [src]);

  useEffect(() => {
    return () => {
      const el = videoRef.current;
      if (!el || !isIosDevice()) return;
      el.dataset.wantSound = "0";
      el.muted = true;
      if (!el.paused) el.pause();
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;

    if (!shouldLoad) {
      if (!el.paused) el.pause();
      return;
    }

    if (el.preload !== "auto") el.preload = "auto";
    if (el.getAttribute("src") !== src) {
      el.src = src;
    }

    if (playing && !document.hidden) {
      if (el.paused || el.muted !== muted) {
        void tryPlayMedia(el, !muted).then((ok) => {
          if (!ok) onAutoplayBlocked?.();
        });
      }
    } else {
      el.dataset.wantSound = "0";
      if (!el.muted) el.muted = true;
      if (!el.paused) el.pause();
      try {
        if (el.currentTime > 0.04) el.currentTime = 0;
      } catch {
        /* métadonnées pas prêtes */
      }
    }
  }, [playing, shouldLoad, src, video, muted, onAutoplayBlocked]);

  useEffect(() => {
    if (!video) return;
    const retry = () => {
      const el = videoRef.current;
      if (!el || !playing || !shouldLoad || document.hidden) return;
      if (!el.paused && el.muted === muted) return;
      void tryPlayMedia(el, !muted);
    };
    window.addEventListener(SOUND_UNLOCK_EVENT, retry);
    return () => window.removeEventListener(SOUND_UNLOCK_EVENT, retry);
  }, [playing, shouldLoad, video, muted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    if (el.muted !== muted) el.muted = muted;
    const nextVol = Math.min(1, Math.max(0, volume));
    if (el.volume !== nextVol) el.volume = nextVol;
  }, [muted, volume, video]);

  useEffect(() => {
    if (!video) return;
    const onVis = () => {
      const el = videoRef.current;
      if (!el) return;
      if (document.hidden) {
        el.pause();
      } else if (playing && shouldLoad) {
        void tryPlayMedia(el, !muted);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing, shouldLoad, video, muted]);

  const ken = Boolean(!video && applied && animate);
  const kenStyle = {
    ["--ss-ms" as string]: `${Math.max(2800, motionMs ?? 5500)}ms`,
  };
  const kenClass = cn("ss-ken", ken && "ss-ken-loop");

  return (
    <>
      {fill && displayPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={ken ? `bg-${applied}` : "bg"}
          src={displayPoster}
          alt=""
          draggable={false}
          aria-hidden
          className={cn("ss-reel-bg", ken && kenClass)}
          data-motion={ken ? applied : undefined}
          style={kenStyle}
          onError={() => setPosterBroken(true)}
        />
      ) : null}
      {video ? (
        fill ? (
          <div className="absolute inset-0 z-[1] overflow-hidden bg-[#1a1a22]">
            <video
              ref={videoRef}
              muted={muted}
              loop={loop}
              {...iosInlineVideo}
              preload="auto"
              poster={displayPoster}
              disablePictureInPicture
              onEnded={() => {
                if (!loop) onPlaybackEnded?.();
              }}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.videoWidth > 0 && el.videoHeight > 0) {
                  setMediaRatio(el.videoWidth / el.videoHeight);
                }
              }}
              className={cn("ss-reel-fg-video", portraitFocus && "ss-reel-fg-portrait")}
              style={portraitVars}
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            muted={muted}
            loop={loop}
            {...iosInlineVideo}
            preload="auto"
            poster={displayPoster}
            disablePictureInPicture
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (el.videoWidth > 0 && el.videoHeight > 0) {
                setMediaRatio(el.videoWidth / el.videoHeight);
              }
            }}
            onEnded={() => {
              if (!loop) onPlaybackEnded?.();
            }}
            className={cn(
              mediaClass(fit),
              portraitFocus && "ss-reel-fg-portrait",
            )}
            style={portraitVars}
          />
        )
      ) : fill ? (
        <div className="absolute inset-0 z-[1] overflow-hidden bg-[#1a1a22]">
          {displaySrc ? (
            <div
              key={ken ? `fg-${applied}` : "fg"}
              className={cn("absolute inset-0", ken && kenClass)}
              data-motion={ken ? applied : undefined}
              style={kenStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc}
                alt=""
                draggable={false}
                loading={playing ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={playing ? "high" : "low"}
                className={cn(
                  mediaClass(fit),
                  portraitFocus && "ss-reel-fg-portrait",
                )}
                onError={() => setImgBroken(true)}
                onLoad={(e) => {
                  if (!applyRatio) return;
                  const el = e.currentTarget;
                  if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                    setMediaRatio(el.naturalWidth / el.naturalHeight);
                  }
                }}
                style={
                  applyRatio && mediaRatio
                    ? {
                        aspectRatio: `${mediaRatio}`,
                        height: "auto",
                        ...portraitVars,
                      }
                    : undefined
                }
              />
            </div>
          ) : null}
        </div>
      ) : displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={ken ? `cover-${applied}` : "cover"}
          src={displaySrc}
          alt=""
          draggable={false}
          loading={playing ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={playing ? "high" : "low"}
          className={cn(
            mediaClass(fit),
            ken && kenClass,
            portraitFocus && "ss-reel-fg-portrait",
          )}
          data-motion={ken ? applied : undefined}
          style={{
            ...kenStyle,
            ...portraitVars,
            ...(applyRatio && mediaRatio
              ? { aspectRatio: `${mediaRatio}`, height: "auto" }
              : {}),
          }}
          onError={() => setImgBroken(true)}
          onLoad={(e) => {
            if (!applyRatio) return;
            const el = e.currentTarget;
            if (el.naturalWidth > 0 && el.naturalHeight > 0) {
              setMediaRatio(el.naturalWidth / el.naturalHeight);
            }
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#1a1a22]" />
      )}
    </>
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
  fit = "reel",
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
  forcePlay = false,
}: Props) {
  const videoMuted = hasSoundtrack || muted;
  const cleaned = images.filter((u) => typeof u === "string" && u.trim());
  const list =
    cleaned.length > 0
      ? cleaned
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
  const imagesKey = list.join("\n");

  useEffect(() => {
    const urls = imagesKey.split("\n");
    const firstVideo = urls.findIndex((url) => isVideoUrl(url));
    setIndex(firstVideo >= 0 ? firstVideo : 0);
    setManualHold(false);
    setUserPaused(false);
  }, [imagesKey]);

  const wasInView = useRef(inView);
  useEffect(() => {
    if (inView && !wasInView.current) setUserPaused(false);
    wasInView.current = inView;
  }, [inView]);

  useEffect(() => {
    if (!nearView || !coverSrc) return;
    if (isVideoUrl(coverSrc)) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = coverSrc;
      return () => {
        video.pause();
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

    const ios = isIosDevice();
    const ioRoot = ios ? null : root;

    const loadIo = eager
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            if (!entry) return;
            setNearView(entry.isIntersecting);
          },
          { root: ioRoot, rootMargin: "220% 0px", threshold: 0.01 },
        );

    const applyVisibility = (ratio: number, left: number, top: number) => {
      if (hasVideo && !eager) {
        setFeedVideoScore(feedId, ratio, pageKey);
      }
      if (audioKey) {
        setFeedAudioScore(audioKey, { ratio, left, top }, pageKey);
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
    };

    const playIo = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        applyVisibility(
          entry.intersectionRatio,
          entry.boundingClientRect.left,
          entry.boundingClientRect.top,
        );
      },
      {
        root: ioRoot,
        threshold: [0, 0.2, LEFT_VIEW_RATIO, IN_VIEW_RATIO, 0.65, 0.85, 1],
      },
    );

    loadIo?.observe(target);
    playIo.observe(target);

    const measure = () => {
      const rect = target.getBoundingClientRect();
      const rootBox = root?.getBoundingClientRect() ?? {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      };
      const overlapH = Math.max(
        0,
        Math.min(rect.bottom, rootBox.bottom) - Math.max(rect.top, rootBox.top),
      );
      const overlapW = Math.max(
        0,
        Math.min(rect.right, rootBox.right) - Math.max(rect.left, rootBox.left),
      );
      const area = Math.max(1, rect.width * rect.height);
      applyVisibility((overlapH * overlapW) / area, rect.left, rect.top);
    };
    const bootId = window.requestAnimationFrame(measure);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    const scrollOpts: AddEventListenerOptions = { passive: true, capture: true };
    root?.addEventListener("scroll", onScroll, scrollOpts);
    document.addEventListener("scroll", onScroll, scrollOpts);
    window.addEventListener("scroll", onScroll, scrollOpts);
    window.visualViewport?.addEventListener("scroll", onScroll);
    window.visualViewport?.addEventListener("resize", onScroll);

    return () => {
      window.cancelAnimationFrame(bootId);
      if (raf) window.cancelAnimationFrame(raf);
      loadIo?.disconnect();
      playIo.disconnect();
      root?.removeEventListener("scroll", onScroll, scrollOpts);
      document.removeEventListener("scroll", onScroll, scrollOpts);
      window.removeEventListener("scroll", onScroll, scrollOpts);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onScroll);
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
  const cardMayPlay = pageLive && !userPaused && (forcePlay || slotActive);

  return (
    <div
      ref={rootRef}
      data-audio-key={audioKey}
      className={cn(
        "relative touch-pan-y overflow-hidden bg-black select-none",
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
          return active || neighbor;
        })();

        const playing = active && cardMayPlay;
        // Garder la source tant que la card est proche — sinon play()+son
        // est refusé en remontant le fil.
        const shouldLoad = isVid
          ? Boolean(
              mount ||
                (nearView && active) ||
                (forcePlay && active) ||
                userPaused,
            )
          : Boolean(mount);

        return (
          <div
            key={`${src}-${i}`}
            className={cn(
              "absolute inset-0 overflow-hidden",
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
                muted={videoMuted}
                volume={volume}
                loop={loop}
                onAutoplayBlocked={onAutoplayBlocked}
                onPlaybackEnded={active ? onPlaybackEnded : undefined}
                motion={isVid ? undefined : playbackMotion(i, motions)}
                motionMs={Math.max(slotMs, 4200)}
                animate={Boolean(active && playing && !isVid)}
              />
            ) : null}
            {overlay && <div className="ss-reel-vignette" />}
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
