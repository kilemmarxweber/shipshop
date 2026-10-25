"use client";

import { useEffect, useRef } from "react";
import type { VideoSoundState } from "@/components/video-sound-button";
import { useAppConfig } from "@/lib/use-app-config";
import { usePageMediaLive } from "@/lib/page-media-session";
import { SOUND_UNLOCK_EVENT, tryPlayMedia } from "@/lib/try-play-media";

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
  const wasActiveRef = useRef(false);
  const pageLive = usePageMediaLive();
  const canPlay = pageLive && active && !sound.muted;
  const startSec = Math.max(0, startMs / 1000);

  function seekToStart(audio: HTMLAudioElement) {
    try {
      audio.currentTime = startSec;
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const el = rootRef.current?.closest("article") ?? rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = (entry?.intersectionRatio ?? 0) >= 0.08;
        const audio = ref.current;
        if (!audio) return;
        if (canPlay && inViewRef.current) {
          if (!wasActiveRef.current) seekToStart(audio);
          wasActiveRef.current = true;
          void tryPlayMedia(audio, !sound.muted);
        } else {
          wasActiveRef.current = false;
          audio.pause();
          seekToStart(audio);
        }
      },
      { threshold: [0, 0.08, 0.45, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      ref.current?.pause();
    };
  }, [canPlay, sound.muted, startSec]);

  useEffect(() => {
    return () => {
      const audio = ref.current;
      if (!audio) return;
      audio.dataset.wantSound = "0";
      audio.muted = true;
      if (!audio.paused) audio.pause();
    };
  }, []);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, sound.volume));
    if (canPlay) {
      if (!wasActiveRef.current) seekToStart(audio);
      wasActiveRef.current = true;
      if (audio.paused || audio.muted) {
        void tryPlayMedia(audio, !sound.muted);
      }
    } else if (!audio.paused || !audio.muted || wasActiveRef.current) {
      wasActiveRef.current = false;
      audio.muted = true;
      audio.pause();
      seekToStart(audio);
    }
  }, [canPlay, sound.muted, sound.volume, audioUrl, startSec]);

  useEffect(() => {
    const retry = () => {
      const audio = ref.current;
      if (!audio || !canPlay) return;
      if (!audio.paused && !audio.muted) return;
      void tryPlayMedia(audio, !sound.muted);
    };
    window.addEventListener(SOUND_UNLOCK_EVENT, retry);
    return () => window.removeEventListener(SOUND_UNLOCK_EVENT, retry);
  }, [canPlay, sound.muted]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const clipEnd = () => {
      const dur = Number.isFinite(audio.duration)
        ? audio.duration
        : startSec + clipSeconds;
      return Math.min(startSec + clipSeconds, Math.max(startSec + 0.2, dur));
    };
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      audio.pause();
      onCycleEnd?.();
    };
    const onLoaded = () => {
      audio.currentTime = startSec;
    };
    const onTime = () => {
      if (audio.currentTime < clipEnd()) return;
      if (loop) {
        audio.currentTime = startSec;
        return;
      }
      finishOnce();
    };
    const onEnded = () => {
      if (loop) {
        audio.currentTime = startSec;
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
  }, [startSec, audioUrl, canPlay, loop, onCycleEnd, clipSeconds, sound.muted]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute size-0 overflow-hidden">
      <audio ref={ref} src={audioUrl} preload="auto" />
    </div>
  );
}
