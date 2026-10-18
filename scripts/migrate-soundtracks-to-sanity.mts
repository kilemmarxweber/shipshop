/**
 * One-shot : 3 WAV seed → assets Sanity + documents catalogTrack.
 *
 *   SANITY_API_WRITE_TOKEN=... pnpm sanity:migrate-tracks
 */
import { createClient } from "next-sanity";
import { config as loadEnv } from "dotenv";
import { readFile } from "fs/promises";
import path from "path";
import { writeSeedSoundtracks } from "../src/lib/write-soundtrack-wav";

loadEnv();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "production";
const token = process.env.SANITY_API_WRITE_TOKEN?.trim();

if (!projectId || projectId === "unset") {
  console.error("NEXT_PUBLIC_SANITY_PROJECT_ID manquant");
  process.exit(1);
}
if (!token) {
  console.error("SANITY_API_WRITE_TOKEN manquant (jamais en client)");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2026-10-18",
  token,
  useCdn: false,
});

const SEED = [
  {
    key: "actualites.wav",
    title: "Flash actualités",
    artist: "ShipShop",
    mood: "news",
  },
  {
    key: "marche.wav",
    title: "Marché Kin",
    artist: "ShipShop",
    mood: "upbeat",
  },
  {
    key: "doux.wav",
    title: "Doux matin",
    artist: "ShipShop",
    mood: "calm",
  },
] as const;

async function ensureSingleton(
  id: string,
  type: string,
  extra: Record<string, unknown>,
) {
  const existing = await client.getDocument(id);
  if (existing) {
    console.log(`singleton ${id} déjà présent`);
    return;
  }
  await client.createIfNotExists({ _id: id, _type: type, ...extra });
  console.log(`singleton ${id} créé`);
}

async function main() {
  const files = await writeSeedSoundtracks();
  const dir = path.join(process.cwd(), "public", "soundtracks");
  await ensureSingleton("appConfig", "appConfig", {
    montage: {
      clipSeconds: 60,
      maxImages: 12,
      motions: ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up"],
    },
    nsfw: {
      forbidden: true,
      rejectFr: "Contenu pornographique interdit sur ShipShop",
      rejectEn: "Pornographic content is forbidden on ShipShop",
      rejectPt: "Conteúdo pornográfico é proibido no ShipShop",
    },
  });
  await ensureSingleton("seoDefaults", "seoDefaults", {
    titleTemplate: "ShipShop — Marketplace de confiance",
    description:
      "Achetez et vendez en sécurité avec portefeuille Mobile Money prépayé.",
  });

  for (const spec of SEED) {
    const file = files.find((row) => row.file === spec.key);
    if (!file) {
      console.warn("WAV manquant", spec.key);
      continue;
    }
    const buffer = await readFile(path.join(dir, spec.key));
    const asset = await client.assets.upload("file", buffer, {
      filename: spec.key,
      contentType: "audio/wav",
    });
    const docId = `catalogTrack.${spec.mood}`;
    await client.createOrReplace({
      _id: docId,
      _type: "catalogTrack",
      title: spec.title,
      artist: spec.artist,
      mood: spec.mood,
      durationMs: file.durationMs,
      isActive: true,
      audio: {
        _type: "file",
        asset: { _type: "reference", _ref: asset._id },
      },
    });
    console.log("track", spec.title, "→", asset.url);
  }
  console.log("Migration catalogue terminée.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
