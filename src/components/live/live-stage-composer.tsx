"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  LIVE_GUEST_MAX_ON_STAGE,
  type LiveStageLayoutId,
} from "@/lib/growth/live-stage-layout";
import {
  LiveGuestStageGrid,
  type LiveGuestCard,
} from "@/components/live/live-guest-stage";

/** Surface hôte — badge + nom, reçoit la <video> en children. */
export function LiveHostSurface({
  name,
  className,
  children,
}: {
  name?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[#0a0a10]", className)}>
      {children}
      <span className="absolute top-1.5 left-1.5 z-[2] rounded-md bg-sky-500/90 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white shadow">
        Hôte
      </span>
      {name ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
          <p className="truncate text-[11px] font-bold text-white drop-shadow">
            {name}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type ComposerProps = {
  layout: LiveStageLayoutId;
  hostName?: string | null;
  hostNode: ReactNode;
  /** Afficher le plateau même sans invité (slots Demande) */
  showStageChrome: boolean;
  guests: LiveGuestCard[];
  selfUserId?: string | null;
  selfStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  isHost?: boolean;
  joinLocked?: boolean;
  canRequestJoin?: boolean;
  pendingSelf?: boolean;
  onRequestJoin?: () => void;
  videoFilter?: string | null;
  hostMicOn?: boolean;
  onToggleHostMic?: () => void;
  onToggleSelfCam?: () => void;
  onToggleSelfMic?: () => void;
  onRaiseHand?: () => void;
  onLowerHand?: () => void;
  onGrantFloor?: (guestId: string) => void;
  onRevokeFloor?: (guestId: string) => void;
  onKick?: (guestId: string) => void;
};

/**
 * Compose hôte + invités selon rail / split / board.
 * Le chat reste en overlay bas (page).
 */
export function LiveStageComposer({
  layout,
  hostName,
  hostNode,
  showStageChrome,
  guests,
  selfUserId,
  selfStream,
  remoteStreams,
  isHost,
  joinLocked,
  canRequestJoin,
  pendingSelf,
  onRequestJoin,
  videoFilter,
  hostMicOn,
  onToggleHostMic,
  onToggleSelfCam,
  onToggleSelfMic,
  onRaiseHand,
  onLowerHand,
  onGrantFloor,
  onRevokeFloor,
  onKick,
}: ComposerProps) {
  const onStage = guests.filter((g) => g.status === "ON_STAGE");
  const hasOnStage = onStage.length > 0;
  /** Viewers sans invité : hôte plein écran (pas de plateau « en attente »). */
  const useSplitBoard = (layout === "split" || layout === "board") &&
    (hasOnStage || Boolean(isHost));
  const emptyCount = Math.max(0, LIVE_GUEST_MAX_ON_STAGE - onStage.length);
  const showEmpty =
    showStageChrome &&
    !joinLocked &&
    (canRequestJoin || isHost) &&
    emptyCount > 0;
  /** Host : cases Demande. Viewer : 1 seule tuile, jamais un mur d’attente. */
  const emptySlots = joinLocked && isHost && showStageChrome
    ? 1
    : showEmpty
      ? isHost
        ? Math.min(emptyCount, layout === "rail" ? 3 : layout === "split" ? 4 : 6)
        : 1
      : 0;

  const guestGrid = (
    <LiveGuestStageGrid
      guests={guests}
      selfUserId={selfUserId}
      selfStream={selfStream}
      remoteStreams={remoteStreams}
      isHost={isHost}
      videoFilter={videoFilter}
      layout={layout}
      embedded
      emptySlots={emptySlots}
      joinLocked={joinLocked}
      pendingSelf={pendingSelf}
      onRequestJoin={canRequestJoin ? onRequestJoin : undefined}
      hostMicOn={hostMicOn}
      onToggleHostMic={onToggleHostMic}
      onToggleSelfCam={onToggleSelfCam}
      onToggleSelfMic={onToggleSelfMic}
      onRaiseHand={onRaiseHand}
      onLowerHand={onLowerHand}
      onGrantFloor={onGrantFloor}
      onRevokeFloor={onRevokeFloor}
      onKick={onKick}
    />
  );

  if (layout === "split" && showStageChrome && useSplitBoard) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1] flex gap-0.5 p-0.5 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[5.5rem]">
        <LiveHostSurface
          name={hostName}
          className="pointer-events-none min-w-0 flex-[1.15] rounded-xl"
        >
          {hostNode}
        </LiveHostSurface>
        <div className="flex w-[42%] min-w-[7.5rem] max-w-[11rem] flex-col">
          {guestGrid}
        </div>
      </div>
    );
  }

  if (layout === "board" && showStageChrome && useSplitBoard) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[min(48%,24rem)] flex-col gap-0.5 p-0.5 pt-[max(3.25rem,calc(env(safe-area-inset-top)+0.25rem))]">
        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-0.5">
          <LiveHostSurface
            name={hostName}
            className="pointer-events-none col-span-2 row-span-2 rounded-lg"
          >
            {hostNode}
          </LiveHostSurface>
          <div className="col-span-2 row-span-3 min-h-0">
            {guestGrid}
          </div>
        </div>
      </div>
    );
  }

  // rail (défaut) : hôte plein écran + rail droite
  return (
    <>
      <div className="absolute inset-0 z-[1]">{hostNode}</div>
      {showStageChrome ? (
        <div className="pointer-events-none absolute top-[4.5rem] right-2 bottom-[5.5rem] z-[22] flex w-[7.75rem] flex-col sm:right-3 sm:w-[9rem]">
          {guestGrid}
        </div>
      ) : null}
    </>
  );
}
