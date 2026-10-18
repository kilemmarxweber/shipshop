const ARCHIVE_SEARCH =
  "https://archive.org/advancedsearch.php";
const ARCHIVE_META = "https://archive.org/metadata";

const AUDIO_FORMATS = [
  "VBR MP3",
  "MP3",
  "128Kbps MP3",
  "64Kbps MP3",
  "Ogg Vorbis",
  "OGG VORBIS",
  "WAVE",
  "Flac",
  "FLAC",
  "AIFF",
];

export type OnlineTrackHit = {
  identifier: string;
  title: string;
  artist: string;
  file: string;
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
      return ia - ib;
    });
  const chosen = ranked[0];
  if (!chosen?.name) return null;
  const size = Number(chosen.size ?? 0);
  if (size > 25 * 1024 * 1024) return null;
  return chosen.name;
}

export function safeArchiveIdentifier(raw: string) {
  const id = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,200}$/.test(id)) return null;
  return id;
}

export function safeArchiveFileName(raw: string) {
  const name = raw.trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  if (name.length > 240) return null;
  return name;
}

export function archiveDownloadUrl(identifier: string, file: string) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file)}`;
}

export async function searchOnlineAudio(query: string): Promise<OnlineTrackHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q: `mediatype:audio AND (${q})`,
    rows: "8",
    page: "1",
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

  await Promise.all(
    docs.slice(0, 8).map(async (doc) => {
      const identifier = safeArchiveIdentifier(doc.identifier ?? "");
      if (!identifier) return;
      const metaRes = await fetch(`${ARCHIVE_META}/${identifier}`, {
        headers: { Accept: "application/json", "User-Agent": "ShipShop/1.0" },
      });
      if (!metaRes.ok) return;
      const meta = (await metaRes.json()) as { files?: ArchiveFile[] };
      const file = pickAudioFile(meta.files ?? []);
      const safeFile = file ? safeArchiveFileName(file) : null;
      if (!safeFile) return;
      hits.push({
        identifier,
        title: (doc.title ?? identifier).slice(0, 80),
        artist: creatorOf(doc).slice(0, 60) || "Internet Archive",
        file: safeFile,
      });
    }),
  );

  return hits;
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
