import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  buildLiveIceServers,
  liveIcePreferRelay,
} from "@/lib/growth/live-rtc-ice";

/** Serveurs ICE (STUN + TURN) — même approche que Klambo mobile. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.json({
    iceServers: buildLiveIceServers(session.user.id),
    preferRelay: liveIcePreferRelay(),
    ttlSec: 3_500,
  });
}
