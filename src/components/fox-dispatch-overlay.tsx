"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { holdFeedAudio } from "@/lib/feed-audio-focus";
import { iosInlineVideo } from "@/lib/ios-inline-video";

const SRC = "/renard-dispatch.mp4";

type Props = {
  open: boolean;
  onFinished: () => void;
};

export function FoxDispatchOverlay({ open, onFinished }: Props) {
  const done = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    holdFeedAudio(open);
    return () => holdFeedAudio(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      done.current = false;
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    const attempt = el.play();
    if (attempt) {
      void attempt.catch(() => {
        el.muted = true;
        void el.play().catch(() => finish());
      });
    }
  }, [open]);

  function finish() {
    if (done.current) return;
    done.current = true;
    onFinished();
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/55 px-6 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-label="Commande en route"
      onClick={finish}
    >
      <div
        className="w-full max-w-[22rem] overflow-hidden rounded-[1.75rem] bg-[#1a120c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        style={{ animation: "fox-dispatch-in 320ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <video
            ref={videoRef}
            src={SRC}
            className="absolute inset-0 size-full scale-[1.08] object-cover"
            {...iosInlineVideo}
            autoPlay
            preload="auto"
            onEnded={finish}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
