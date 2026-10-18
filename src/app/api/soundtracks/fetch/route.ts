import { NextResponse } from "next/server";
import { downloadArchiveAudio } from "@/lib/soundtrack-search.server";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(req.url);
  const identifier = url.searchParams.get("identifier") ?? "";
  const file = url.searchParams.get("file") ?? "";

  try {
    const { buffer, contentType } = await downloadArchiveAudio(identifier, file);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Téléchargement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
