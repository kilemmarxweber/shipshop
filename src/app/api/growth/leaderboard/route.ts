import { NextResponse } from "next/server";
import { loadLeaderboard } from "@/lib/growth/missions";

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city");
  const [global, local] = await Promise.all([
    loadLeaderboard(),
    loadLeaderboard(city || "Kinshasa"),
  ]);
  return NextResponse.json({ global, local, city: city || "Kinshasa" });
}
