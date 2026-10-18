"use client";

import { Volume2, VolumeX } from "lucide-react";
import { isVideoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export type VideoSoundState = {
  muted: boolean;
  /** 0–1, utilisé quand unmuted */
  volume: number;
};

export const DEFAULT_VIDEO_SOUND: VideoSoundState = {
  muted: false,
  volume: 0.3,
};

const VOLUME_STEPS = [0.3, 0.6, 1] as const;

export function productHasVideo(images: string[]) {
  return images.some((url) => isVideoUrl(url));
}

export function nextVideoSound(current: VideoSoundState): VideoSoundState {
  if (current.muted) {
    return { muted: false, volume: VOLUME_STEPS[0] };
  }
  const idx = VOLUME_STEPS.findIndex((v) => current.volume <= v + 0.05);
  if (idx < 0 || idx >= VOLUME_STEPS.length - 1) {
    return { muted: true, volume: VOLUME_STEPS[0] };
  }
  return { muted: false, volume: VOLUME_STEPS[idx + 1] };
}

function volumeLabel(state: VideoSoundState) {
  if (state.muted) return "Muet";
  return `${Math.round(state.volume * 100)}%`;
}

type Props = {
  images: string[];
  sound: VideoSoundState;
  onChange: (next: VideoSoundState) => void;
  className?: string;
  hasSoundtrack?: boolean;
};

/** Visible si la card a une vidéo ou une musique catalogue. */
export function VideoSoundButton({
  images,
  sound,
  onChange,
  className,
  hasSoundtrack = false,
}: Props) {
  if (!productHasVideo(images) && !hasSoundtrack) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(nextVideoSound(sound));
      }}
      className={cn("grid cursor-pointer place-items-center", className)}
      aria-label={
        sound.muted
          ? "Activer le son (30%)"
          : `Son ${volumeLabel(sound)} — cliquer pour augmenter`
      }
      title={
        sound.muted
          ? "Activer le son"
          : `Son ${volumeLabel(sound)} · clic = augmenter`
      }
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full border backdrop-blur transition hover:scale-105 active:scale-95",
          sound.muted
            ? "border-white/15 bg-white/10"
            : "border-white/35 bg-white/20",
        )}
      >
        {sound.muted ? (
          <VolumeX className="size-5 text-white" />
        ) : (
          <Volume2 className="size-5 text-white" />
        )}
      </span>
    </button>
  );
}
