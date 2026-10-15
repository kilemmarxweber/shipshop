"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Facing = "user" | "environment";

type Props = {
  facing: Facing;
  title: string;
  hint: string;
  onClose: () => void;
  onCapture: (file: File) => Promise<void> | void;
};

async function openStream(facing: Facing) {
  const base = {
    width: { ideal: 1280 },
    height: { ideal: 1280 },
  };

  if (facing === "user") {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...base, facingMode: { exact: "user" } },
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...base, facingMode: { ideal: "user" } },
      });
    }
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...base, facingMode: { exact: "environment" } },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...base, facingMode: { ideal: "environment" } },
    });
  }
}

function facingOf(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  return track?.getSettings()?.facingMode ?? null;
}

export function KycCamera({ facing, title, hint, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non supportée sur cet appareil");
        return;
      }
      try {
        const stream = await openStream(facing);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const mode = facingOf(stream);
        if (facing === "user" && mode === "environment") {
          stream.getTracks().forEach((t) => t.stop());
          setError("Caméra avant obligatoire pour le selfie. Activez-la et réessayez.");
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch {
        setError(
          facing === "user"
            ? "Impossible d’activer la caméra avant. Autorisez l’accès caméra."
            : "Impossible d’activer la caméra. Autorisez l’accès caméra.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  async function snap() {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth < 8) {
      setError("Caméra pas encore prête");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setBusy(true);
    try {
      const file = await new Promise<File>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("capture"));
              return;
            }
            resolve(
              new File([blob], `kyc-${facing}-${Date.now()}.jpg`, {
                type: "image/jpeg",
              }),
            );
          },
          "image/jpeg",
          0.92,
        );
      });
      await onCapture(file);
    } catch {
      setError("Capture impossible");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={
            facing === "user"
              ? "h-full w-full scale-x-[-1] object-cover"
              : "h-full w-full object-cover"
          }
        />
        {facing === "user" && ready ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="aspect-square w-[72%] rounded-full border-2 border-white/70" />
          </div>
        ) : null}
      </div>
      <p className="px-4 pt-3 text-center text-[11px] text-white/70">{hint}</p>
      {error ? (
        <p className="px-4 pt-2 text-center text-xs text-destructive">{error}</p>
      ) : null}
      <div className="flex gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="secondary"
          className="h-11 flex-1 cursor-pointer"
          onClick={onClose}
          disabled={busy}
        >
          Annuler
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 cursor-pointer gap-1.5"
          onClick={snap}
          disabled={!ready || busy}
        >
          <Camera className="size-4" />
          {busy ? "…" : "Prendre"}
        </Button>
      </div>
    </div>
  );
}
