"use client";

import { useEffect, useRef } from "react";
import type { VideoSoundState } from "@/components/video-sound-button";
import { useAppConfig } from "@/lib/use-app-config";
import { usePageMediaLive } from "@/lib/page-media-session";
import { tryPlayMedia } from "@/lib/try-play-media";

type Props = {
  audioUrl: string;
  startMs?: number;
  sound: VideoSoundState;
  active: boolean;
  /** false = un passage puis onCycleEnd (grille Découvrir). */
  loop?: boolean;
  onCycleEnd?: () => void;
};

export function FeedSoundtrackPlayer({
  audioUrl,
  startMs = 0,
  sound,
  active,
  loop = true,
  onCycleEnd,
}: Props) {
  const { clipSeconds } = useAppConfig();
  const ref = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef(false);
  const pageLive = usePageMediaLive();
  const canPlay = pageLive && active && !sound.muted;

  useEffect(() => {
    const el = rootRef.current?.closest("article") ?? rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = (entry?.intersectionRatio ?? 0) >= 0.08;
        const audio = ref.current;
        if (!audio) return;
        if (canPlay) {
          void tryPlayMedia(audio, !sound.muted);
        } else {
          audio.pause();
        }
      },
      { threshold: [0, 0.08, 0.45, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      ref.current?.pause();
    };
  }, [canPlay, sound.muted]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, sound.volume));
    if (canPlay) {
      void tryPlayMedia(audio, !sound.muted);
    } else {
      audio.muted = true;
      audio.pause();
    }
    return () => {
      audio.pause();
    };
  }, [canPlay, sound.muted, sound.volume, audioUrl]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const start = Math.max(0, startMs / 1000);
    const clipEnd = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : start + clipSeconds;
      return Math.min(start + clipSeconds, Math.max(start + 0.2, dur));
    };
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      audio.pause();
      onCycleEnd?.();
    };
    const onLoaded = () => {
      audio.currentTime = start;
    };
    const onTime = () => {
      if (audio.currentTime < clipEnd()) return;
      if (loop) {
        audio.currentTime = start;
        return;
      }
      finishOnce();
    };
    const onEnded = () => {
      if (loop) {
        audio.currentTime = start;
        if (canPlay) {
          void tryPlayMedia(audio, !sound.muted);
        }
        return;
      }
      finishOnce();
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [startMs, audioUrl, canPlay, loop, onCycleEnd, clipSeconds]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute size-0 overflow-hidden">
      <audio ref={ref} src={audioUrl} preload="metadata" />
    </div>
  );
}
