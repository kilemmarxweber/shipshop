import { NextResponse } from "next/server";
import { ensureDefaultSoundtracks } from "@/lib/ensure-soundtracks";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function GET() {
  await ensureDefaultSoundtracks();
  const tracks = await withDbRetry(() =>
    prisma.soundtrack.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        artist: true,
        mood: true,
        durationMs: true,
        audioUrl: true,
      },
    }),
  );
  return NextResponse.json({ soundtracks: tracks });
}
