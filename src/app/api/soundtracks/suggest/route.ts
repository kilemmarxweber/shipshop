import { getSession } from "@/lib/session";
import { suggestOnlineAudio } from "@/lib/soundtrack-search.server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const country = url.searchParams.get("country")?.trim() ?? "";
  const page = Number(url.searchParams.get("page") ?? "1");
  const skip = new Set(
    (url.searchParams.get("skip") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  try {
    const tracks = await suggestOnlineAudio(
      q,
      country,
      Number.isFinite(page) ? page : 1,
      skip,
    );
    return NextResponse.json({ tracks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Proposition impossible";
    return NextResponse.json({ error: message, tracks: [] }, { status: 502 });
  }
}
