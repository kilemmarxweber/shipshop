import { ffmpegText, isFfmpegAvailable } from "@/lib/ffmpeg.server";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php";
const ARCHIVE_META = "https://archive.org/metadata";

const AUDIO_FORMATS = [
  "64Kbps MP3",
  "VBR MP3",
  "MP3",
  "128Kbps MP3",
  "Ogg Vorbis",
  "OGG VORBIS",
  "WAVE",
  "Flac",
  "FLAC",
  "AIFF",
];

/** Genres publics les plus écoutés par pays — le tri se fait ensuite par téléchargements. */
const REGION_BUZZ: Record<string, string> = {
  CD: "rumba congolaise",
  CG: "rumba soukous",
  CI: "zouglou",
  SN: "mbalax",
  NG: "afrobeats",
  GH: "highlife",
  ZA: "amapiano",
  KE: "bongo",
  TZ: "bongo flava",
  FR: "variété française",
  BE: "variété française",
  US: "hip hop",
  GB: "uk garage",
  BR: "funk brasileiro",
};

const AFRICA = new Set([
  "DZ",
  "AO",
  "BJ",
  "BW",
  "BF",
  "BI",
  "CV",
  "CM",
  "CF",
  "TD",
  "KM",
  "CG",
  "CD",
  "CI",
  "DJ",
  "EG",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "GA",
  "GM",
  "GH",
  "GN",
  "GW",
  "KE",
  "LS",
  "LR",
  "LY",
  "MG",
  "MW",
  "ML",
  "MR",
  "MU",
  "MA",
  "MZ",
  "NA",
  "NE",
  "NG",
  "RW",
  "ST",
  "SN",
  "SC",
  "SL",
  "SO",
  "ZA",
  "SS",
  "SD",
  "TZ",
  "TG",
  "TN",
  "UG",
  "ZM",
  "ZW",
]);

export type OnlineTrackHit = {
  identifier: string;
  title: string;
  artist: string;
  file: string;
  previewUrl: string;
  hookMs: number;
};

type ArchiveDoc = {
  identifier?: string;
  title?: string;
  creator?: string | string[];
};

type ArchiveFile = {
  name?: string;
  format?: string;
  size?: string;
};

function creatorOf(doc: ArchiveDoc) {
  const c = doc.creator;
  if (Array.isArray(c)) return c[0] ?? "";
  return c ?? "";
}

function pickAudioFile(files: ArchiveFile[]) {
  const ranked = files
    .filter((f) => f.name && AUDIO_FORMATS.includes(f.format ?? ""))
    .sort((a, b) => {
      const ia = AUDIO_FORMATS.indexOf(a.format ?? "");
      const ib = AUDIO_FORMATS.indexOf(b.format ?? "");
      if (ia !== ib) return ia - ib;
      return Number(a.size ?? 0) - Number(b.size ?? 0);
    });
  const chosen = ranked.find((file) => {
    const size = Number(file.size ?? 0);
    return size <= 0 || size <= 25 * 1024 * 1024;
  });
  return chosen?.name ?? null;
}

export function safeArchiveIdentifier(raw: string) {
  const id = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,200}$/.test(id)) return null;
  return id;
}

export function safeArchiveFileName(raw: string) {
  const name = raw.trim();
  if (
    !name ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    return null;
  }
  if (name.length > 240) return null;
  return name;
}

export function archiveDownloadUrl(identifier: string, file: string) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file)}`;
}

export async function searchOnlineAudio(
  query: string,
  opts?: { rows?: number; stopAt?: number; page?: number; skip?: Set<string> },
): Promise<OnlineTrackHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const rows = Math.min(24, Math.max(1, opts?.rows ?? 12));
  const page = Math.min(12, Math.max(1, opts?.page ?? 1));

  const params = new URLSearchParams({
    q: `mediatype:audio AND (${q})`,
    rows: String(rows),
    page: String(page),
    output: "json",
  });
  params.append("fl[]", "identifier");
  params.append("fl[]", "title");
  params.append("fl[]", "creator");
  params.append("sort[]", "downloads desc");

  const res = await fetch(`${ARCHIVE_SEARCH}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "ShipShop/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error("Recherche en ligne indisponible");
  }
  const json = (await res.json()) as {
    response?: { docs?: ArchiveDoc[] };
  };
  const docs = json.response?.docs ?? [];
  const hits: OnlineTrackHit[] = [];
  const stopAt = opts?.stopAt ?? docs.length;

  for (const doc of docs) {
    if (hits.length >= stopAt) break;
    const identifier = safeArchiveIdentifier(doc.identifier ?? "");
    if (!identifier || opts?.skip?.has(identifier)) continue;
    const metaRes = await fetch(`${ARCHIVE_META}/${identifier}`, {
      headers: { Accept: "application/json", "User-Agent": "ShipShop/1.0" },
    });
    if (!metaRes.ok) continue;
    const meta = (await metaRes.json()) as { files?: ArchiveFile[] };
    const file = pickAudioFile(meta.files ?? []);
    const safeFile = file ? safeArchiveFileName(file) : null;
    if (!safeFile) continue;
    hits.push({
      identifier,
      title: (doc.title ?? identifier).slice(0, 80),
      artist: creatorOf(doc).slice(0, 60) || "Artiste",
      file: safeFile,
      previewUrl: archiveDownloadUrl(identifier, safeFile),
      hookMs: 18_000,
    });
  }

  return hits;
}

/** Plusieurs sons : style de l’image + afro si la zone est l’Afrique, les plus téléchargés d’abord. */
export async function suggestOnlineAudio(
  styleQuery: string,
  country: string,
  page = 1,
  skip?: Set<string>,
) {
  const code = country.trim().toUpperCase();
  const africa = AFRICA.has(code);
  const region = REGION_BUZZ[code] ?? (africa ? "afrobeats" : "");
  const style = styleQuery.trim();
  const attempts = [
    africa ? `${region} afro` : `${style} ${region}`.trim(),
    africa ? `${style} afrobeats instrumental` : region,
    africa ? "afrobeats" : style,
    style,
  ].filter(
    (query, index, all) => query.length >= 2 && all.indexOf(query) === index,
  );
  for (const query of attempts) {
    const hits = await searchOnlineAudio(query, {
      rows: 12,
      stopAt: 4,
      page,
      skip,
    });
    if (!hits.length) continue;
    return Promise.all(hits.map((hit) => withHook(hit)));
  }
  return [];
}

const HOOK_AT_SEC = [16, 28, 42, 58, 76];

async function windowMeanDb(url: string, startSec: number) {
  const startByte = Math.floor(startSec * 8000);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ShipShop/1.0",
      Range: `bytes=${startByte}-${startByte + 96_000}`,
    },
    redirect: "follow",
  });
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 256) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "chipshop-hook-"));
  const input = path.join(dir, "in.bin");
  try {
    await writeFile(input, buf);
    const log = await ffmpegText(
      ["-hide_banner", "-i", input, "-af", "volumedetect", "-f", "null", "-"],
      12_000,
    );
    const match = /mean_volume:\s*(-?\d+(?:\.\d+)?)/.exec(log);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Passage intérieur le plus présent, en sautant l’intro souvent vide. */
async function withHook(hit: OnlineTrackHit): Promise<OnlineTrackHit> {
  if (!(await isFfmpegAvailable())) return { ...hit, hookMs: 18_000 };
  const scores = await Promise.all(
    HOOK_AT_SEC.map(async (sec) => ({
      sec,
      mean: await windowMeanDb(hit.previewUrl, sec),
    })),
  );
  const usable = scores.filter(
    (row) => row.mean != null && row.mean > -38 && row.mean < -6,
  );
  usable.sort((a, b) => (b.mean ?? -99) - (a.mean ?? -99));
  const chosen = usable[0]?.sec ?? 18;
  return { ...hit, hookMs: chosen * 1000 };
}

/** Lecture légère : environ 1 min 30 en 64 kbps, pas le morceau entier. */
export async function downloadArchiveWindow(
  identifier: string,
  file: string,
  startMs: number,
): Promise<{ buffer: Buffer; partial: boolean }> {
  const id = safeArchiveIdentifier(identifier);
  const name = safeArchiveFileName(file);
  if (!id || !name) throw new Error("Fichier en ligne invalide");
  const startByte = Math.floor((Math.max(0, startMs) / 1000) * 8000);
  const endByte = startByte + 1_200_000;
  const res = await fetch(archiveDownloadUrl(id, name), {
    headers: {
      "User-Agent": "ShipShop/1.0",
      Range: `bytes=${startByte}-${endByte}`,
    },
    redirect: "follow",
  });
  if (!res.ok && res.status !== 206) {
    throw new Error("Lecture du son impossible");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 256) throw new Error("Extrait audio illisible");
  return { buffer: buf, partial: res.status === 206 };
}

export async function downloadArchiveAudio(
  identifier: string,
  file: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const id = safeArchiveIdentifier(identifier);
  const name = safeArchiveFileName(file);
  if (!id || !name) {
    throw new Error("Fichier en ligne invalide");
  }
  const res = await fetch(archiveDownloadUrl(id, name), {
    headers: { "User-Agent": "ShipShop/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error("Téléchargement du son impossible");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 256 || buf.length > 25 * 1024 * 1024) {
    throw new Error("Fichier audio illisible ou trop lourd");
  }
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  return { buffer: buf, contentType };
}
