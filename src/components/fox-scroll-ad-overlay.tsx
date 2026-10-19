"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { holdFeedAudio } from "@/lib/feed-audio-focus";
import { isVideoUrl } from "@/lib/media";
import { SCROLL_AD_IMAGE_SECONDS } from "@/lib/scroll-ad";
import { useScrollAd } from "@/lib/use-scroll-ad";
import { Slider } from "@/components/ui/slider";

const CLOSE_AFTER = 0.88;

function AdPlayer({ src, onFinished }: { src: string; onFinished: () => void }) {
  const done = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(0);
  const [progress, setProgress] = useState(0);
  const video = isVideoUrl(src);
  const remaining = Math.max(
    0,
    Math.ceil((1 - progress) * (video ? 0 : SCROLL_AD_IMAGE_SECONDS)),
  );
  const canClose = progress >= CLOSE_AFTER;

  useEffect(() => {
    holdFeedAudio(true);
    return () => holdFeedAudio(false);
  }, []);

  useEffect(() => {
    done.current = false;
    setProgress(0);
    startedAt.current = performance.now();
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.muted = false;
    const attempt = el.play();
    if (attempt) {
      void attempt.catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    }
  }, [src, video]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (video) {
        const el = videoRef.current;
        const dur = el?.duration;
        const t = el?.currentTime ?? 0;
        if (dur && Number.isFinite(dur) && dur > 0) {
          setProgress(Math.min(1, t / dur));
        }
      } else {
        const elapsed = (performance.now() - startedAt.current) / 1000;
        const p = Math.min(1, elapsed / SCROLL_AD_IMAGE_SECONDS);
        setProgress(p);
        if (p >= 1) finish();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src, video]);

  function finish() {
    if (done.current) return;
    done.current = true;
    onFinished();
  }

  const percent = Math.round(progress * 100);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/75 px-2 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-label="Publicité"
    >
      <div className="relative w-full max-w-[34rem]">
        <Slider
          value={[percent]}
          max={100}
          step={1}
          className="pointer-events-none mb-2 px-1 [&_[data-slot=slider-thumb]]:pointer-events-none [&_[data-slot=slider-thumb]]:size-0 [&_[data-slot=slider-thumb]]:opacity-0"
          aria-label="Avancement"
        />
        <div className="relative overflow-hidden rounded-[1.75rem] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          {canClose ? (
            <button
              type="button"
              onClick={finish}
              className="absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-white"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>
          ) : null}
          {!video ? (
            <p className="absolute left-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {remaining} s
            </p>
          ) : null}
          {video ? (
            <video
              key={src}
              ref={videoRef}
              src={src}
              className="block aspect-[9/16] max-h-[92vh] w-full object-contain"
              playsInline
              autoPlay
              preload="auto"
              data-scroll-ad="1"
              onEnded={() => {
                if ((videoRef.current?.currentTime ?? 0) > 0.4) finish();
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              draggable={false}
              className="block aspect-[9/16] max-h-[92vh] w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function FoxScrollAdOverlay() {
  const { open, src, close } = useScrollAd();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !src) return null;

  return createPortal(
    <AdPlayer src={src} onFinished={close} />,
    document.body,
  );
}
