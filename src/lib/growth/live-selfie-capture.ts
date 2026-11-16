import {
  DEFAULT_LIVE_QUALITY,
  LIVE_QUALITY_PROFILES,
  selfieConstraintsForProfile,
  type LiveQualityProfileId,
} from "@/lib/growth/live-quality";

/** Capture selfie portrait — netteté prioritaire, plafonnée au profil. */

const AUDIO = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

type CapRange = { min?: number; max?: number };

function cappedMax(range: CapRange | undefined, ceiling: number) {
  if (!range?.max || !Number.isFinite(range.max)) return undefined;
  return Math.min(range.max, ceiling);
}

export async function openSelfieStream(
  profileId: LiveQualityProfileId = DEFAULT_LIVE_QUALITY,
) {
  const profile = LIVE_QUALITY_PROFILES[profileId];
  // Demande high si standard+ (le navigateur négocie au plus près) ;
  // economy reste volontairement en 720.
  const requestId: LiveQualityProfileId =
    profileId === "economy" ? "economy" : "high";

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO,
      video: selfieConstraintsForProfile(requestId),
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO,
      video: selfieConstraintsForProfile("economy"),
    });
  }

  const video = stream.getVideoTracks()[0];
  if (!video) return stream;
  video.contentHint = "detail";

  const caps = video.getCapabilities?.() as
    | { width?: CapRange; height?: CapRange }
    | undefined;
  const width = cappedMax(caps?.width, profile.width);
  const height = cappedMax(caps?.height, profile.height);
  if (width && height) {
    try {
      await video.applyConstraints({
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: profile.frameRate, max: profile.frameRate },
      });
    } catch {
      /* le mode négocié au getUserMedia reste en place */
    }
  }
  return stream;
}
