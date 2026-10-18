import { mkdtemp, readFile, rm, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { isFfmpegAvailable, probeDurationMs, runFfmpeg } from "@/lib/ffmpeg.server";
import { getAppConfig } from "@/lib/content-source";
import { MONTAGE_MAX_SECONDS } from "@/lib/montage";

export const AUDIO_INPUT_MAX_BYTES = 25 * 1024 * 1024;
export const AUDIO_STORED_MAX_BYTES = 8 * 1024 * 1024;

export function detectAudioFile(file: { name?: string; type?: string }) {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.startsWith("audio/")) return true;
  const ext = path.extname(file.name ?? "").toLowerCase();
  return [
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".ogg",
    ".oga",
    ".flac",
    ".opus",
    ".amr",
    ".weba",
  ].includes(ext);
}

export function detectVideoFile(file: { name?: string; type?: string }) {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  const ext = path.extname(file.name ?? "").toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v", ".mkv", ".avi", ".3gp", ".ogv"].includes(
    ext,
  );
}

export function detectSoundtrackSource(file: { name?: string; type?: string }) {
  return detectAudioFile(file) || detectVideoFile(file);
}

/**
 * Convertit en AAC / m4a. Par défaut : extrait publié (1 min) à startMs.
 * Le fichier source n’est écrit que dans un dossier temp ffmpeg, puis effacé.
 */
export async function compressAudioBuffer(
  input: Buffer,
  opts?: { startMs?: number; maxSeconds?: number },
): Promise<{ buffer: Buffer; ext: "m4a"; durationMs: number }> {
  if (!(await isFfmpegAvailable())) {
    throw new Error(
      "ffmpeg requis pour importer la musique (installez ffmpeg ou définissez FFMPEG_PATH)",
    );
  }

  const maxSeconds =
    opts?.maxSeconds ??
    (await getAppConfig()).clipSeconds ??
    MONTAGE_MAX_SECONDS;
  const startSec = Math.max(0, (opts?.startMs ?? 0) / 1000);
  const dir = await mkdtemp(path.join(tmpdir(), "chipshop-aud-"));
  const inputPath = path.join(dir, "in.bin");
  const outputPath = path.join(dir, "out.m4a");

  try {
    await writeFile(inputPath, input);
    await runFfmpeg(
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-ss",
        startSec.toFixed(3),
        "-t",
        String(maxSeconds),
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      180_000,
    );

    const outStat = await stat(outputPath);
    if (outStat.size < 256) {
      throw new Error("Fichier audio illisible");
    }
    const buffer = await readFile(outputPath);
    if (buffer.length > AUDIO_STORED_MAX_BYTES) {
      throw new Error("Fichier audio trop lourd après compression");
    }
    const probed = await probeDurationMs(outputPath);
    const capMs = maxSeconds * 1000;
    return {
      buffer,
      ext: "m4a",
      durationMs: Math.min(
        probed && probed > 0 ? probed : capMs,
        capMs,
      ),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
