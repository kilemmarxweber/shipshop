"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { iosInlineVideo } from "@/lib/ios-inline-video";

export type LiveGuestCard = {
  id: string;
  status: string;
  cameraOn: boolean;
  user: { id: string; name: string; image?: string | null };
};

/** Cartes invités ON_STAGE — écran host (+ preview locale si c’est moi). */
export function LiveGuestStageGrid({
  guests,
  selfUserId,
  selfStream,
  isHost,
  onKick,
  className,
}: {
  guests: LiveGuestCard[];
  selfUserId?: string | null;
  /** Flux caméra local de l’invité connecté (si sur scène). */
  selfStream?: MediaStream | null;
  isHost?: boolean;
  onKick?: (guestId: string) => void;
  className?: string;
}) {
  const onStage = guests.filter((g) => g.status === "ON_STAGE");
  if (!onStage.length) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-[4.5rem] right-2.5 z-[22] flex w-[7.25rem] flex-col gap-2 sm:right-3 sm:w-[8.5rem]",
        className,
      )}
    >
      {onStage.map((g) => {
        const isSelf = Boolean(selfUserId && g.user.id === selfUserId);
        return (
          <GuestPiP
            key={g.id}
            guest={g}
            showLocalVideo={isSelf && Boolean(selfStream) && g.cameraOn}
            stream={isSelf ? selfStream : null}
            canKick={Boolean(isHost && onKick)}
            onKick={() => onKick?.(g.id)}
          />
        );
      })}
    </div>
  );
}

function GuestPiP({
  guest,
  showLocalVideo,
  stream,
  canKick,
  onKick,
}: {
  guest: LiveGuestCard;
  showLocalVideo: boolean;
  stream?: MediaStream | null;
  canKick: boolean;
  onKick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showLocalVideo && stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [showLocalVideo, stream]);

  return (
    <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/25 bg-black/70 shadow-xl backdrop-blur-md">
      <div className="relative aspect-[3/4] w-full bg-[#121218]">
        {showLocalVideo ? (
          <video
            ref={videoRef}
            muted
            autoPlay
            {...iosInlineVideo}
            className="absolute inset-0 size-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          />
        ) : guest.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guest.user.image}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-90"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#2a2030] to-[#0e0e16]">
            <UserRound className="size-8 text-white/50" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-1.5 pb-1.5 pt-6">
          <p className="truncate text-[10px] font-bold text-white drop-shadow">
            {guest.user.name}
          </p>
          <span
            className={cn(
              "mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
              guest.cameraOn
                ? "bg-emerald-500/25 text-emerald-200"
                : "bg-white/15 text-white/70",
            )}
          >
            {guest.cameraOn ? (
              <Camera className="size-2.5" />
            ) : (
              <CameraOff className="size-2.5" />
            )}
            {guest.cameraOn ? "Cam" : "Off"}
          </span>
        </div>
        {canKick ? (
          <button
            type="button"
            aria-label="Retirer de la scène"
            onClick={onKick}
            className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white/90"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** File d’attente host — accepter / refuser. */
export function LiveGuestRequestQueue({
  pending,
  busy,
  onAccept,
  onRefuse,
}: {
  pending: LiveGuestCard[];
  busy?: boolean;
  onAccept: (guestId: string) => void;
  onRefuse: (guestId: string) => void;
}) {
  if (!pending.length) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-3 top-[4.35rem] z-[28] max-h-[40%] space-y-2 overflow-y-auto sm:left-3 sm:right-auto sm:w-[17rem]">
      {pending.map((g) => (
        <div
          key={g.id}
          className="flex items-center gap-2 rounded-2xl border border-amber-400/35 bg-black/75 px-2.5 py-2 shadow-lg backdrop-blur-md"
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
            {g.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.user.image} alt="" className="size-full object-cover" />
            ) : (
              <UserRound className="size-4 text-white/60" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-white">
              {g.user.name}
            </p>
            <p className="text-[10px] text-amber-200/90">Veut monter au live</p>
          </div>
          <Button
            size="sm"
            disabled={busy}
            className="h-8 shrink-0 rounded-full bg-trust px-2.5 text-[11px] font-bold text-black"
            onClick={() => onAccept(g.id)}
          >
            OK
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            className="h-8 shrink-0 rounded-full px-2 text-[11px] text-white/75"
            onClick={() => onRefuse(g.id)}
          >
            Non
          </Button>
        </div>
      ))}
    </div>
  );
}
