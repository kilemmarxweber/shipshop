import {
  DEFAULT_VIDEO_SOUND,
  type VideoSoundState,
} from "@/components/video-sound-button";

/**
 * Une seule card peut avoir le son.
 * Si `next` est unmuted → toutes les autres passent en muet.
 */
export function applyExclusiveVideoSound(
  prev: Record<string, VideoSoundState>,
  id: string,
  next: VideoSoundState,
): Record<string, VideoSoundState> {
  if (next.muted) {
    return { ...prev, [id]: next };
  }

  const out: Record<string, VideoSoundState> = {};
  for (const [key, state] of Object.entries(prev)) {
    if (key === id) continue;
    out[key] = {
      muted: true,
      volume: state.volume || DEFAULT_VIDEO_SOUND.volume,
    };
  }
  out[id] = next;
  return out;
}
