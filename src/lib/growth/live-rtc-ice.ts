import { createHmac } from "crypto";
import {
  LIVE_RTC_ICE_SERVERS,
  LIVE_TURN_OPEN_RELAY_HOST,
  LIVE_TURN_OPEN_RELAY_SECRET,
  sortLiveIceServers,
} from "@/lib/growth/live-rtc-shared";

export type LiveIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * ICE comme Klambo / Eteyelo : STUN + TURN Metered Open Relay (HMAC).
 * TURN est indispensable derrière NAT/CGNAT (sinon viewers sans son/vidéo).
 */
export function buildLiveIceServers(userId: string): LiveIceServer[] {
  const secret =
    process.env.LIVE_TURN_SECRET?.trim() || LIVE_TURN_OPEN_RELAY_SECRET;
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const username = `${expiry}:${userId || "anon"}`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  const turnHost =
    process.env.LIVE_TURN_HOST?.trim() || LIVE_TURN_OPEN_RELAY_HOST;

  return sortLiveIceServers([
    {
      urls: `turns:${turnHost}:443?transport=tcp`,
      username,
      credential,
    },
    {
      urls: `turn:${turnHost}:443`,
      username,
      credential,
    },
    ...LIVE_RTC_ICE_SERVERS,
  ]);
}

/** Forcer le relais TURN (Wi‑Fi très filtrés) — env LIVE_TURN_FORCE_RELAY=1. */
export function liveIcePreferRelay(): boolean {
  return (
    process.env.LIVE_TURN_FORCE_RELAY === "1" ||
    process.env.LIVE_TURN_FORCE_RELAY === "true"
  );
}
