import { NextResponse } from "next/server";
import { loadLeaderboard } from "@/lib/growth/missions";
import { enforceApiSecurity } from "@/lib/security";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  const blocked = await enforceApiSecurity({
    request: req,
    bucket: "growth",
    session,
  });
  if (blocked) return blocked;
  const city = new URL(req.url).searchParams.get("city");
  const [global, local] = await Promise.all([
    loadLeaderboard(),
    loadLeaderboard(city || "Kinshasa"),
  ]);
  return NextResponse.json({ global, local, city: city || "Kinshasa" });
}
