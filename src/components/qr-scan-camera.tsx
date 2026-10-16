"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

function getDetector(): Detector | null {
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts?: { formats: string[] }) => Detector;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return new Ctor();
  }
}

async function openRearCamera() {
  const base = { facingMode: { ideal: "environment" as const } };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...base, facingMode: { exact: "environment" }, width: { ideal: 1280 } },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "environment", width: { ideal: 1280 } },
    });
  }
}

type Props = {
  onClose: () => void;
  onScan: (value: string) => void;
};

export function QrScanCamera({ onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non supportée");
        return;
      }
      const detector = getDetector();
      if (!detector) {
        setError(
          "Scan QR non supporté sur ce navigateur. Utilisez Chrome, Edge ou Safari.",
        );
        return;
      }
      try {
        const stream = await openRearCamera();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && v.videoWidth > 0) {
            try {
              let found: { rawValue: string }[] = [];
              try {
                found = await detector.detect(v);
              } catch {
                if (canvas && ctx) {
                  canvas.width = v.videoWidth;
                  canvas.height = v.videoHeight;
                  ctx.drawImage(v, 0, 0);
                  found = await detector.detect(canvas);
                }
              }
              const value = found[0]?.rawValue?.trim();
              if (value) {
                doneRef.current = true;
                streamRef.current?.getTracks().forEach((t) => t.stop());
                onScanRef.current(value);
                return;
              }
            } catch {
              // frame skip
            }
          }
          raf = requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch {
        setError("Impossible d’ouvrir la caméra. Autorisez l’accès photo.");
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <ScanLine className="size-4" />
          Scanner le QR de remise
        </p>
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
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {ready ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="aspect-square w-[68%] rounded-2xl border-2 border-border0 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}
      </div>
      <p className="px-4 pt-3 text-center text-[11px] text-white/70">
        Cadrez le QR du client — la remise se valide automatiquement
      </p>
      {error ? (
        <p className="px-4 pt-2 text-center text-xs text-destructive">{error}</p>
      ) : null}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full cursor-pointer"
          onClick={onClose}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
