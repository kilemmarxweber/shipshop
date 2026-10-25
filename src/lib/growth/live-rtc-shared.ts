/** Types / helpers RTC — safe côté client (pas de Prisma). */

export type LiveRtcKind = "offer" | "answer" | "ice";

export type LiveRtcSignalPublic = {
  id: string;
  fromPeerId: string;
  toPeerId: string;
  kind: LiveRtcKind | string;
  payload: unknown;
  createdAt: Date | string;
};

export type LivePublisherPeer = {
  peerId: string;
  role: "host" | "guest";
  name: string;
  image?: string | null;
  cameraOn: boolean;
  micOn: boolean;
};

/** STUN seul (dernier recours) — préférer TURN Open Relay (Klambo / Metered). */
export const LIVE_RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/** Secret public Metered Open Relay (identique Klambo mobile). */
export const LIVE_TURN_OPEN_RELAY_SECRET = "openrelayprojectsecret";
export const LIVE_TURN_OPEN_RELAY_HOST = "staticauth.openrelay.metered.ca";

/** Poll SSE de secours si le wake in-process rate (multi-instance). */
export const LIVE_RTC_SSE_FALLBACK_MS = 700;

/** Reconnexion SSE après coupure (backoff max). */
export const LIVE_RTC_SSE_RETRY_MS = 1_200;

function iceRank(urls: string | string[]): number {
  const url = Array.isArray(urls) ? urls[0] ?? "" : urls;
  const isTurn = url.startsWith("turn:") || url.startsWith("turns:");
  if (isTurn && (url.includes(":443") || url.includes(":5349"))) return 0;
  if (isTurn) return 1;
  if (url.startsWith("stun:")) return 2;
  if (url.includes(":80")) return 3;
  return 4;
}

/** TURN TLS d’abord (comme Klambo `_iceRank`). */
export function sortLiveIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  return [...servers].sort(
    (a, b) => iceRank(a.urls) - iceRank(b.urls),
  );
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Creds TURN Open Relay côté client — même algo que Klambo `_openRelayCreds`
 * (pas d’attente API pour le premier handshake derrière NAT).
 */
export async function buildClientFallbackIceServers(
  userId: string,
): Promise<RTCIceServer[]> {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const username = `${expiry}:${userId || "anon"}`;
  const credential = await hmacSha1Base64(
    LIVE_TURN_OPEN_RELAY_SECRET,
    username,
  );
  const host = LIVE_TURN_OPEN_RELAY_HOST;
  return sortLiveIceServers([
    {
      urls: `turns:${host}:443?transport=tcp`,
      username,
      credential,
    },
    {
      urls: `turn:${host}:443`,
      username,
      credential,
    },
    ...LIVE_RTC_ICE_SERVERS,
  ]);
}

export function peerIdStorageKey(liveId: string) {
  return `shipshop-live-peer:${liveId}`;
}

export function resolveLivePeerId(liveId: string, userId?: string | null) {
  if (userId) return userId;
  if (typeof window === "undefined") return "";
  const key = peerIdStorageKey(liveId);
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}
