"use client";

import { useEffect, useRef } from "react";
import type { VideoSoundState } from "@/components/video-sound-button";

type Props = {
  audioUrl: string;
  startMs?: number;
  sound: VideoSoundState;
  active: boolean;
};

export function FeedSoundtrackPlayer({
  audioUrl,
  startMs = 0,
  sound,
  active,
}: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current?.closest("article") ?? rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = (entry?.intersectionRatio ?? 0) >= 0.45;
        const audio = ref.current;
        if (!audio) return;
        if (inViewRef.current && active && !sound.muted) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      },
      { threshold: [0, 0.45, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, sound.muted]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, sound.volume));
    audio.muted = sound.muted;
    if (active && !sound.muted && inViewRef.current) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [active, sound.muted, sound.volume, audioUrl]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const onLoaded = () => {
      audio.currentTime = Math.max(0, startMs / 1000);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    return () => audio.removeEventListener("loadedmetadata", onLoaded);
  }, [startMs, audioUrl]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute size-0 overflow-hidden">
      <audio ref={ref} src={audioUrl} loop preload="none" />
    </div>
  );
}
