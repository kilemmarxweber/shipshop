"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, Mic, MicOff, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import { liveVideoFilterStyle } from "@/components/live/live-video-studio-grade";

export type LiveGuestCard = {
  id: string;
  status: string;
  cameraOn: boolean;
  micOn?: boolean;
  user: { id: string; name: string; image?: string | null };
};

/** Cartes invités ON_STAGE — preview locale ou flux WebRTC distant. */
export function LiveGuestStageGrid({
  guests,
  selfUserId,
  selfStream,
  remoteStreams,
  isHost,
  onKick,
  videoFilter,
  className,
}: {
  guests: LiveGuestCard[];
  selfUserId?: string | null;
  selfStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  isHost?: boolean;
  onKick?: (guestId: string) => void;
  videoFilter?: string | null;
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
        const remote = remoteStreams?.[g.user.id] ?? null;
        const stream = isSelf ? selfStream : remote;
        const showVideo = Boolean(
          stream && (isSelf ? g.cameraOn : g.cameraOn !== false),
        );
        return (
          <GuestPiP
            key={g.id}
            guest={g}
            showVideo={showVideo}
            stream={stream}
            muted={isSelf}
            canKick={Boolean(isHost && onKick)}
            onKick={() => onKick?.(g.id)}
            videoFilter={videoFilter}
          />
        );
      })}
    </div>
  );
}

function GuestPiP({
  guest,
  showVideo,
  stream,
  muted,
  canKick,
  onKick,
  videoFilter,
}: {
  guest: LiveGuestCard;
  showVideo: boolean;
  stream?: MediaStream | null;
  muted: boolean;
  canKick: boolean;
  onKick: () => void;
  videoFilter?: string | null;
}) {
  const filterStyle = liveVideoFilterStyle(videoFilter);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const micOn = guest.micOn !== false;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showVideo && stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [showVideo, stream]);

  return (
    <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/25 bg-black/70 shadow-xl backdrop-blur-md">
      <div className="relative aspect-[3/4] w-full bg-[#121218]">
        {showVideo ? (
          <video
            ref={videoRef}
            muted={muted}
            autoPlay
            {...iosInlineVideo}
            style={filterStyle}
            className="absolute inset-0 size-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          />
        ) : guest.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guest.user.image}
            alt=""
            style={filterStyle}
            className="absolute inset-0 size-full object-cover opacity-90"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#2a2030] to-[#0e0e16]">
            <UserRound className="size-8 text-white/50" />
          </div>
        )}
        {/* Audio-only distant : élément muet=false si pas de vidéo */}
        {!showVideo && stream && !muted ? (
          <audio
            autoPlay
            ref={(el) => {
              if (el && el.srcObject !== stream) {
                el.srcObject = stream;
                void el.play().catch(() => undefined);
              }
            }}
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-1.5 pb-1.5 pt-6">
          <p className="truncate text-[10px] font-bold text-white drop-shadow">
            {guest.user.name}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
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
              Cam
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                micOn
                  ? "bg-emerald-500/25 text-emerald-200"
                  : "bg-white/15 text-white/70",
              )}
            >
              {micOn ? (
                <Mic className="size-2.5" />
              ) : (
                <MicOff className="size-2.5" />
              )}
              Mic
            </span>
          </div>
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

/** File d’attente host — demandes viewers + invitations en attente. */
export function LiveGuestRequestQueue({
  pending,
  invited = [],
  busy,
  onAccept,
  onRefuse,
  onCancelInvite,
}: {
  pending: LiveGuestCard[];
  invited?: LiveGuestCard[];
  busy?: boolean;
  onAccept: (guestId: string) => void;
  onRefuse: (guestId: string) => void;
  onCancelInvite?: (guestId: string) => void;
}) {
  if (!pending.length && !invited.length) return null;
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
      {invited.map((g) => (
        <div
          key={g.id}
          className="flex items-center gap-2 rounded-2xl border border-[#7dffb3]/30 bg-black/75 px-2.5 py-2 shadow-lg backdrop-blur-md"
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
            <p className="text-[10px] text-[#7dffb3]/90">
              Invitation envoyée — en attente
            </p>
          </div>
          {onCancelInvite ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className="h-8 shrink-0 rounded-full px-2 text-[11px] text-white/75"
              onClick={() => onCancelInvite(g.id)}
            >
              Annuler
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
