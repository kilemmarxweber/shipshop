import { AccessToken, type VideoGrant } from "livekit-server-sdk";

/** LiveKit Cloud configuré → diffusion viewers via SFU (pas mesh). */
export function isLiveSfuConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim(),
  );
}

export function getLiveSfuUrl(): string {
  return process.env.LIVEKIT_URL?.trim() ?? "";
}

export type MintLiveSfuTokenInput = {
  liveId: string;
  identity: string;
  name?: string | null;
  canPublish: boolean;
};

export type MintLiveSfuTokenResult = {
  token: string;
  url: string;
  room: string;
  identity: string;
  sfu: true;
};

/**
 * JWT LiveKit : room = liveId, identity = userId (même clé que remoteStreams).
 */
export async function mintLiveSfuToken(
  input: MintLiveSfuTokenInput,
): Promise<MintLiveSfuTokenResult> {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = getLiveSfuUrl();
  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit non configuré");
  }

  const room = input.liveId;
  const at = new AccessToken(apiKey, apiSecret, {
    identity: input.identity,
    name: input.name?.trim() || input.identity,
    ttl: "6h",
  });

  const grant: VideoGrant = {
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: input.canPublish,
    canPublishData: input.canPublish,
  };
  at.addGrant(grant);

  const token = await at.toJwt();
  return {
    token,
    url,
    room,
    identity: input.identity,
    sfu: true,
  };
}
