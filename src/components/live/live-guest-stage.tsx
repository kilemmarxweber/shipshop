"use client";

import { useEffect, useRef } from "react";
import {
  Camera,
  CameraOff,
  Hand,
  Lock,
  Mic,
  MicOff,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import { liveVideoFilterStyle } from "@/components/live/live-video-studio-grade";
import type { LiveStageLayoutId } from "@/lib/growth/live-stage-layout";

export type LiveGuestCard = {
  id: string;
  status: string;
  cameraOn: boolean;
  micOn?: boolean;
  handRaised?: boolean;
  hasFloor?: boolean;
  user: { id: string; name: string; image?: string | null };
};

/**
 * Attache un MediaStream à <audio> et force le play (autoplay policy).
 * Video reste muette — le son passe toujours par cet élément.
 * Re-sync si une piste audio arrive après la vidéo (même MediaStream).
 */
/** Son distant (host ou invité) — vidéo reste muette, autoplay iOS via mute→play→unmute. */
export function useRemoteLiveAudio(
  stream: MediaStream | null | undefined,
  enabled: boolean,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackKey = stream
    ? stream
        .getAudioTracks()
        .map((t) => `${t.id}:${t.readyState}:${t.enabled}`)
        .join("|")
    : "";

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!enabled || !stream || !audioTrackKey) {
      el.srcObject = null;
      el.pause();
      return;
    }
    // Rebind pour que le navigateur prenne la nouvelle piste audio
    el.srcObject = null;
    el.srcObject = stream;
    el.muted = true;
    void el
      .play()
      .then(() => {
        el.muted = false;
      })
      .catch(() => undefined);

    const onAddTrack = () => {
      el.srcObject = null;
      el.srcObject = stream;
      el.muted = true;
      void el
        .play()
        .then(() => {
          el.muted = false;
        })
        .catch(() => undefined);
    };
    stream.addEventListener("addtrack", onAddTrack);
    return () => {
      stream.removeEventListener("addtrack", onAddTrack);
    };
  }, [stream, enabled, audioTrackKey]);

  return audioRef;
}

function DemandeTile({
  locked,
  pending,
  onRequest,
  compact,
}: {
  locked?: boolean;
  pending?: boolean;
  onRequest?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-no-like
      disabled={Boolean(locked) || !onRequest}
      onClick={() => onRequest?.()}
      className={cn(
        "pointer-events-auto flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed transition",
        compact ? "min-h-[4.5rem]" : "aspect-[3/4] w-full",
        locked
          ? "border-white/10 bg-black/45 text-white/35"
          : pending
            ? "border-amber-400/40 bg-amber-950/55 text-amber-100"
            : "border-white/25 bg-black/40 text-white/75 hover:bg-black/55 active:scale-[0.98]",
      )}
    >
      {locked ? (
        <Lock className="size-4 opacity-70" />
      ) : (
        <Plus className="size-5 opacity-85" />
      )}
      <span className="text-[9px] font-bold">
        {locked ? "Fermé" : pending ? "Attente" : "Demande"}
      </span>
    </button>
  );
}

/** Cartes invités ON_STAGE — preview locale ou flux WebRTC distant. */
export function LiveGuestStageGrid({
  guests,
  selfUserId,
  selfStream,
  remoteStreams,
  isHost,
  onKick,
  onToggleSelfCam,
  onToggleSelfMic,
  onRaiseHand,
  onLowerHand,
  onGrantFloor,
  onRevokeFloor,
  hostMicOn,
  onToggleHostMic,
  videoFilter,
  layout = "rail",
  embedded = false,
  emptySlots = 0,
  joinLocked = false,
  pendingSelf = false,
  onRequestJoin,
  className,
}: {
  guests: LiveGuestCard[];
  selfUserId?: string | null;
  selfStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  isHost?: boolean;
  onKick?: (guestId: string) => void;
  onToggleSelfCam?: () => void;
  onToggleSelfMic?: () => void;
  onRaiseHand?: () => void;
  onLowerHand?: () => void;
  onGrantFloor?: (guestId: string) => void;
  onRevokeFloor?: (guestId: string) => void;
  /** Host : micro rapide pour couper l’écho quand un invité parle */
  hostMicOn?: boolean;
  onToggleHostMic?: () => void;
  videoFilter?: string | null;
  layout?: LiveStageLayoutId;
  /** true = positionné par LiveStageComposer (pas absolute) */
  embedded?: boolean;
  emptySlots?: number;
  joinLocked?: boolean;
  pendingSelf?: boolean;
  onRequestJoin?: () => void;
  className?: string;
}) {
  const onStage = guests.filter((g) => g.status === "ON_STAGE");
  if (!onStage.length && emptySlots <= 0) return null;
  /** ≥2 invités → parole à tour de rôle (lever la main) */
  const floorMode = onStage.length >= 2;
  const handsUp = onStage.filter((g) => g.handRaised && !g.hasFloor);
  const gridish = layout === "board" || layout === "split";

  return (
    <div
      className={cn(
        "pointer-events-none flex flex-col items-stretch gap-1.5",
        !embedded &&
          "absolute top-[4.5rem] right-2.5 z-[22] w-[7.75rem] sm:right-3 sm:w-[9rem]",
        embedded && "h-full min-h-0 w-full",
        className,
      )}
    >
      {isHost && onToggleHostMic ? (
        <button
          type="button"
          data-no-like
          aria-label={hostMicOn ? "Couper mon micro" : "Allumer mon micro"}
          aria-pressed={Boolean(hostMicOn)}
          onClick={onToggleHostMic}
          className={cn(
            "pointer-events-auto flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-md transition active:scale-95",
            hostMicOn
              ? "border-white/20 bg-black/55 text-white"
              : "border-amber-400/50 bg-amber-950/80 text-amber-100",
          )}
        >
          {hostMicOn ? (
            <Mic className="size-3.5" />
          ) : (
            <MicOff className="size-3.5" />
          )}
          {hostMicOn ? "Micro ON" : "Micro off"}
        </button>
      ) : null}

      {isHost && floorMode && handsUp.length > 0 ? (
        <div className="pointer-events-auto space-y-1 rounded-2xl border border-sky-400/35 bg-sky-950/85 p-1.5 shadow-lg backdrop-blur-md">
          <p className="px-1 text-[9px] font-bold uppercase tracking-wide text-sky-200/90">
            Mains levées
          </p>
          {handsUp.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onGrantFloor?.(g.id)}
              className="flex w-full items-center gap-1.5 rounded-xl bg-white/10 px-1.5 py-1 text-left transition hover:bg-[#7dffb3]/25 active:scale-[0.98]"
            >
              <Hand className="size-3.5 shrink-0 text-sky-300" />
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white">
                {g.user.name}
              </span>
              <span className="shrink-0 rounded-full bg-[#7dffb3] px-1.5 py-0.5 text-[8px] font-extrabold text-black">
                OK
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1",
          gridish
            ? "grid grid-cols-2 content-start gap-1 overflow-y-auto overscroll-contain"
            : "flex flex-col gap-1.5 overflow-y-auto overscroll-contain",
        )}
      >
        {onStage.map((g) => {
          const isSelf = Boolean(selfUserId && g.user.id === selfUserId);
          const remote = remoteStreams?.[g.user.id] ?? null;
          const stream = isSelf ? selfStream : remote;
          const cameraOn = g.cameraOn !== false;
          const micOn = g.micOn !== false;
          const hasFloor = Boolean(g.hasFloor) || !floorMode;
          const handRaised = Boolean(g.handRaised);
          const showVideo = Boolean(stream && cameraOn);
          return (
            <GuestStageCard
              key={g.id}
              guest={g}
              showVideo={showVideo}
              stream={stream}
              isSelf={isSelf}
              micOn={micOn}
              cameraOn={cameraOn}
              floorMode={floorMode}
              hasFloor={hasFloor}
              handRaised={handRaised}
              compact={gridish}
              canKick={Boolean(isHost && onKick && !isSelf)}
              onKick={() => onKick?.(g.id)}
              onToggleCam={isSelf ? onToggleSelfCam : undefined}
              onToggleMic={
                isSelf && (!floorMode || hasFloor) ? onToggleSelfMic : undefined
              }
              onRaiseHand={
                isSelf && floorMode && !hasFloor ? onRaiseHand : undefined
              }
              onLowerHand={
                isSelf && floorMode && handRaised && !hasFloor
                  ? onLowerHand
                  : undefined
              }
              onGrantFloor={
                isHost && floorMode && !isSelf
                  ? () => onGrantFloor?.(g.id)
                  : undefined
              }
              onRevokeFloor={
                isHost && floorMode && hasFloor && !isSelf
                  ? () => onRevokeFloor?.(g.id)
                  : undefined
              }
              videoFilter={videoFilter}
            />
          );
        })}
        {Array.from({ length: emptySlots }, (_, i) => (
          <DemandeTile
            key={`demande-${i}`}
            locked={joinLocked}
            pending={pendingSelf && i === 0}
            onRequest={
              joinLocked
                ? undefined
                : i === 0
                  ? onRequestJoin
                  : isHost
                    ? undefined
                    : onRequestJoin
            }
            compact={gridish}
          />
        ))}
      </div>
    </div>
  );
}

function GuestStageCard({
  guest,
  showVideo,
  stream,
  isSelf,
  micOn,
  cameraOn,
  floorMode,
  hasFloor,
  handRaised,
  compact,
  canKick,
  onKick,
  onToggleCam,
  onToggleMic,
  onRaiseHand,
  onLowerHand,
  onGrantFloor,
  onRevokeFloor,
  videoFilter,
}: {
  guest: LiveGuestCard;
  showVideo: boolean;
  stream?: MediaStream | null;
  isSelf: boolean;
  micOn: boolean;
  cameraOn: boolean;
  floorMode: boolean;
  hasFloor: boolean;
  handRaised: boolean;
  compact?: boolean;
  canKick: boolean;
  onKick: () => void;
  onToggleCam?: () => void;
  onToggleMic?: () => void;
  onRaiseHand?: () => void;
  onLowerHand?: () => void;
  onGrantFloor?: () => void;
  onRevokeFloor?: () => void;
  videoFilter?: string | null;
}) {
  const filterStyle = liveVideoFilterStyle(videoFilter);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Son distant uniquement — jamais sa propre voix (écho)
  const audioRef = useRemoteLiveAudio(stream, Boolean(stream) && !isSelf);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showVideo && stream) {
      if (el.srcObject !== stream) el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [showVideo, stream]);

  const initials = guest.user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      data-no-like
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-2xl border bg-[#0c0c12]/92 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] ring-1 backdrop-blur-md",
        hasFloor && floorMode
          ? "border-[#7dffb3]/45 ring-[#7dffb3]/20"
          : handRaised
            ? "border-sky-400/45 ring-sky-400/15"
            : "border-white/20 ring-white/10",
      )}
    >
      {/* Audio distant : toujours hors de la <video> (autoplay + cam off) */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div
        className={cn(
          "relative w-full overflow-hidden bg-[#14141c]",
          compact ? "aspect-square" : "aspect-[3/4]",
        )}
      >
        {/* Vidéo — toujours muted ; le son passe par <audio> */}
        <video
          ref={videoRef}
          muted
          autoPlay
          {...iosInlineVideo}
          style={filterStyle}
          className={cn(
            "absolute inset-0 size-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)] transition-opacity duration-200",
            showVideo ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        {/* Cam off → profil / initiales */}
        {!showVideo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-[#2a2438] via-[#16161f] to-[#0a0a10] px-1.5">
            {guest.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={guest.user.image}
                alt=""
                className={cn(
                  "rounded-full object-cover ring-2 ring-white/25 shadow-lg",
                  compact ? "size-10" : "size-14 sm:size-16",
                )}
              />
            ) : (
              <span
                className={cn(
                  "grid place-items-center rounded-full bg-white/10 font-bold tracking-wide text-white/85 ring-2 ring-white/15",
                  compact ? "size-10 text-xs" : "size-14 text-sm sm:size-16",
                )}
              >
                {initials || (
                  <UserRound className={compact ? "size-4" : "size-6"} />
                )}
              </span>
            )}
            {!compact ? (
              <p className="max-w-full truncate px-1 text-center text-[10px] font-semibold text-white/55">
                Caméra off
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Gradient bas + identité */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-1.5 pb-1.5 pt-8">
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold leading-tight text-white drop-shadow">
                {isSelf ? "Vous" : guest.user.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full",
                    cameraOn
                      ? "bg-emerald-500/25 text-emerald-200"
                      : "bg-white/10 text-white/45",
                  )}
                  title={cameraOn ? "Caméra allumée" : "Caméra coupée"}
                >
                  {cameraOn ? (
                    <Camera className="size-2.5" />
                  ) : (
                    <CameraOff className="size-2.5" />
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full",
                    micOn
                      ? "bg-emerald-500/25 text-emerald-200"
                      : "bg-amber-500/20 text-amber-200",
                  )}
                  title={micOn ? "Micro allumé" : "Micro coupé"}
                >
                  {micOn ? (
                    <Mic className="size-2.5" />
                  ) : (
                    <MicOff className="size-2.5" />
                  )}
                </span>
                {floorMode && hasFloor ? (
                  <span className="rounded-full bg-[#7dffb3]/95 px-1.5 py-0.5 text-[8px] font-extrabold text-black">
                    Parole
                  </span>
                ) : null}
                {floorMode && handRaised && !hasFloor ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/30 px-1.5 py-0.5 text-[8px] font-bold text-sky-100">
                    <Hand className="size-2.5" />
                    Main
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Contrôles A/V + main sur sa propre carte */}
        {isSelf ? (
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {onToggleCam ? (
              <button
                type="button"
                aria-label={cameraOn ? "Couper la caméra" : "Allumer la caméra"}
                onClick={onToggleCam}
                className={cn(
                  "grid size-7 place-items-center rounded-full border shadow-md backdrop-blur transition active:scale-90",
                  cameraOn
                    ? "border-white/20 bg-black/55 text-white"
                    : "border-white/15 bg-black/70 text-white/55",
                )}
              >
                {cameraOn ? (
                  <Camera className="size-3.5" />
                ) : (
                  <CameraOff className="size-3.5" />
                )}
              </button>
            ) : null}
            {onToggleMic ? (
              <button
                type="button"
                aria-label={micOn ? "Couper le micro" : "Allumer le micro"}
                onClick={onToggleMic}
                className={cn(
                  "grid size-7 place-items-center rounded-full border shadow-md backdrop-blur transition active:scale-90",
                  micOn
                    ? "border-white/20 bg-black/55 text-white"
                    : "border-amber-400/40 bg-amber-950/80 text-amber-100",
                )}
              >
                {micOn ? (
                  <Mic className="size-3.5" />
                ) : (
                  <MicOff className="size-3.5" />
                )}
              </button>
            ) : null}
            {onRaiseHand ? (
              <button
                type="button"
                aria-label="Lever la main"
                onClick={onRaiseHand}
                className="grid size-7 place-items-center rounded-full border border-sky-400/40 bg-sky-950/80 text-sky-100 shadow-md backdrop-blur transition active:scale-90"
              >
                <Hand className="size-3.5" />
              </button>
            ) : null}
            {onLowerHand ? (
              <button
                type="button"
                aria-label="Baisser la main"
                onClick={onLowerHand}
                className="grid size-7 place-items-center rounded-full border border-sky-300/50 bg-sky-500/40 text-white shadow-md backdrop-blur transition active:scale-90"
              >
                <Hand className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Host : donner / retirer la parole */}
        {!isSelf && (onGrantFloor || onRevokeFloor) ? (
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {handRaised && onGrantFloor ? (
              <button
                type="button"
                aria-label="Donner la parole"
                onClick={onGrantFloor}
                className="flex h-7 items-center gap-0.5 rounded-full border border-[#7dffb3]/50 bg-[#7dffb3] px-1.5 text-[8px] font-extrabold text-black shadow-md"
              >
                <Hand className="size-3" />
                OK
              </button>
            ) : null}
            {!handRaised && !hasFloor && onGrantFloor ? (
              <button
                type="button"
                aria-label="Donner la parole"
                onClick={onGrantFloor}
                className="grid size-7 place-items-center rounded-full border border-white/20 bg-black/55 text-white/80 shadow-md backdrop-blur"
                title="Donner la parole"
              >
                <Mic className="size-3.5" />
              </button>
            ) : null}
            {hasFloor && onRevokeFloor ? (
              <button
                type="button"
                aria-label="Retirer la parole"
                onClick={onRevokeFloor}
                className="grid size-7 place-items-center rounded-full border border-amber-400/40 bg-amber-950/80 text-amber-100 shadow-md backdrop-blur"
                title="Retirer la parole"
              >
                <MicOff className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {canKick ? (
          <button
            type="button"
            aria-label="Retirer de la scène"
            onClick={onKick}
            className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full border border-white/15 bg-black/65 text-white/90 shadow-md backdrop-blur transition hover:bg-red-600/80"
          >
            <X className="size-3.5" />
          </button>
        ) : null}

        {isSelf && !canKick ? (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-[#7dffb3]/95 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-black">
            SCÈNE
          </span>
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
