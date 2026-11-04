"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LiveStageLayoutId } from "@/lib/growth/live-stage-layout";
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
  /** Rail viewers (Demande + cartes montées). Jamais côté diffuseur. */
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
  onToggleSelfCam?: () => void;
  onToggleSelfMic?: () => void;
  onRaiseHand?: () => void;
  onLowerHand?: () => void;
};

/**
 * Hôte plein écran. Cartes Demande + viewers montés : rail droite, viewers only.
 */
export function LiveStageComposer({
  layout,
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
  onToggleSelfCam,
  onToggleSelfMic,
  onRaiseHand,
  onLowerHand,
}: ComposerProps) {
  const onStage = guests.filter((g) => g.status === "ON_STAGE");
  const selfOnStage = onStage.some((g) => g.user.id === selfUserId);
  /** Viewers : 1 carte Demande. Jamais sur l’écran du diffuseur. */
  const emptySlots =
    showStageChrome && !isHost && !selfOnStage ? 1 : 0;
  const showGuestRail =
    showStageChrome && !isHost && (onStage.length > 0 || emptySlots > 0);

  return (
    <>
      <div className="absolute inset-0 z-[1]">{hostNode}</div>
      {showGuestRail ? (
        <div className="pointer-events-none absolute top-[4.5rem] right-2.5 bottom-[max(8.75rem,calc(env(safe-area-inset-bottom)+7.5rem))] z-[22] flex w-[7.75rem] flex-col sm:right-3 sm:w-[9rem]">
          <LiveGuestStageGrid
            guests={guests}
            selfUserId={selfUserId}
            selfStream={selfStream}
            remoteStreams={remoteStreams}
            isHost={false}
            videoFilter={videoFilter}
            layout={layout}
            embedded
            emptySlots={emptySlots}
            joinLocked={joinLocked}
            pendingSelf={pendingSelf}
            onRequestJoin={canRequestJoin ? onRequestJoin : undefined}
            onToggleSelfCam={onToggleSelfCam}
            onToggleSelfMic={onToggleSelfMic}
            onRaiseHand={onRaiseHand}
            onLowerHand={onLowerHand}
          />
        </div>
      ) : null}
    </>
  );
}
