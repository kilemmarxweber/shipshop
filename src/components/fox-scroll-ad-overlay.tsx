"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { holdFeedAudio } from "@/lib/feed-audio-focus";
import { useScrollAd } from "@/lib/use-scroll-ad";

function AdPlayer({ src, onFinished }: { src: string; onFinished: () => void }) {
  const done = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    holdFeedAudio(true);
    return () => holdFeedAudio(false);
  }, []);

  useEffect(() => {
    done.current = false;
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
  }, [src]);

  function finish() {
    if (done.current) return;
    done.current = true;
    onFinished();
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/75 px-2 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-label="Publicité"
    >
      <div className="relative w-full max-w-[34rem] overflow-hidden rounded-[1.75rem] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
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
