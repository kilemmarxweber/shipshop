import { VideoPreset } from "livekit-client";

/** Profils portrait 9:16 — miroir de ShipShop/src/live-quality.ts */
export type LiveQualityProfileId = "economy" | "standard" | "high";

export type LiveQualityProfile = {
  id: LiveQualityProfileId;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
};

export const PORTRAIT_SIMULCAST_LOW = new VideoPreset(360, 640, 500_000, 24);
export const PORTRAIT_SIMULCAST_MID = new VideoPreset(540, 960, 1_200_000, 30);

export const LIVE_QUALITY_PROFILES: Record<
  LiveQualityProfileId,
  LiveQualityProfile
> = {
  economy: {
    id: "economy",
    label: "Économie",
    width: 720,
    height: 1280,
    frameRate: 24,
    maxBitrate: 1_000_000,
  },
  standard: {
    id: "standard",
    label: "Standard HD",
    width: 720,
    height: 1280,
    frameRate: 30,
    maxBitrate: 2_200_000,
  },
  high: {
    id: "high",
    label: "Haute qualité",
    width: 1080,
    height: 1920,
    frameRate: 30,
    maxBitrate: 3_500_000,
  },
};

export const DEFAULT_LIVE_QUALITY: LiveQualityProfileId = "standard";

export function encodingForProfile(profileId: LiveQualityProfileId) {
  const profile = LIVE_QUALITY_PROFILES[profileId];
  return {
    maxBitrate: profile.maxBitrate,
    maxFramerate: profile.frameRate,
    priority: "high" as const,
  };
}

export const SCREEN_SHARE_QUALITY = {
  width: 720,
  height: 1280,
  frameRate: 15,
  maxBitrate: 2_000_000,
} as const;

/** RoomOptions.publishDefaults alignés mobile. */
export function buildLivePublishDefaults(
  profileId: LiveQualityProfileId = DEFAULT_LIVE_QUALITY,
) {
  return {
    simulcast: true,
    degradationPreference: "maintain-resolution" as const,
    videoEncoding: encodingForProfile(profileId),
    videoSimulcastLayers: [PORTRAIT_SIMULCAST_LOW, PORTRAIT_SIMULCAST_MID],
    screenShareEncoding: {
      maxBitrate: SCREEN_SHARE_QUALITY.maxBitrate,
      maxFramerate: SCREEN_SHARE_QUALITY.frameRate,
    },
    screenShareSimulcastLayers: [
      new VideoPreset(360, 640, 400_000, 10),
      new VideoPreset(540, 960, 900_000, 15),
    ],
  };
}

export function buildLiveRoomOptions(
  profileId: LiveQualityProfileId = DEFAULT_LIVE_QUALITY,
) {
  return {
    adaptiveStream: { pixelDensity: "screen" as const },
    dynacast: true,
    publishDefaults: buildLivePublishDefaults(profileId),
  };
}

/** Contraintes getUserMedia pour un profil donné. */
export function selfieConstraintsForProfile(
  profileId: LiveQualityProfileId = DEFAULT_LIVE_QUALITY,
) {
  const profile = LIVE_QUALITY_PROFILES[profileId];
  return {
    facingMode: { ideal: "user" as const },
    width: { ideal: profile.width },
    height: { ideal: profile.height },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: { ideal: profile.frameRate, max: profile.frameRate },
  };
}
