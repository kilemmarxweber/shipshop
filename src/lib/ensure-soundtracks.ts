import { writeSeedSoundtracks } from "@/lib/write-soundtrack-wav";
import { prisma, withDbRetry } from "@/lib/prisma";

let seeded = false;

export async function ensureDefaultSoundtracks() {
  if (seeded) return;
  const files = await writeSeedSoundtracks();
  const rows = [
    {
      id: "st-news",
      title: "Flash actualités",
      artist: "Chip Shop",
      mood: "news",
      durationMs: files[0]!.durationMs,
      audioUrl: files[0]!.url,
    },
    {
      id: "st-market",
      title: "Marché Kin",
      artist: "Chip Shop",
      mood: "upbeat",
      durationMs: files[1]!.durationMs,
      audioUrl: files[1]!.url,
    },
    {
      id: "st-soft",
      title: "Doux matin",
      artist: "Chip Shop",
      mood: "calm",
      durationMs: files[2]!.durationMs,
      audioUrl: files[2]!.url,
    },
  ];
  for (const row of rows) {
    await withDbRetry(() =>
      prisma.soundtrack.upsert({
        where: { id: row.id },
        create: { ...row, isActive: true },
        update: {
          title: row.title,
          artist: row.artist,
          mood: row.mood,
          durationMs: row.durationMs,
          audioUrl: row.audioUrl,
          isActive: true,
        },
      }),
    );
  }
  seeded = true;
}
