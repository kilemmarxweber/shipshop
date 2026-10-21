import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  PRODUCT_VIDEO_MAX_SECONDS,
  VIDEO_COMPRESS_SKIP_BYTES,
  VIDEO_STORED_MAX_BYTES,
} from "@/lib/media";
import { isFfmpegAvailable, runFfmpeg } from "@/lib/ffmpeg.server";
import { getAppConfig } from "@/lib/content-source";
import { MONTAGE_MAX_SECONDS } from "@/lib/montage";

async function clipSeconds() {
  try {
    return Math.min(
      PRODUCT_VIDEO_MAX_SECONDS,
      Math.max(5, (await getAppConfig()).clipSeconds),
    );
  } catch {
    return Math.min(MONTAGE_MAX_SECONDS, PRODUCT_VIDEO_MAX_SECONDS);
  }
}

function compressTimeoutMs(inputBytes: number) {
  const mb = inputBytes / (1024 * 1024);
  return Math.min(600_000, Math.max(120_000, Math.round(120_000 + mb * 4_000)));
}

type PassOpts = {
  inputPath: string;
  outputPath: string;
  maxWidth: number;
  crf: number;
  audioKbps: number;
  trimSeconds: number;
  fps?: number;
  mono?: boolean;
  noAudio?: boolean;
  timeoutMs: number;
};

async function encodePass(opts: PassOpts) {
  const scale = `scale='min(${opts.maxWidth},iw)':-2`;
  const vf = opts.fps ? `${scale},fps=${opts.fps}` : scale;

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    opts.inputPath,
    "-t",
    String(opts.trimSeconds),
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    String(opts.crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
  ];

  if (opts.noAudio) {
    args.push("-an");
  } else {
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      `${opts.audioKbps}k`,
      "-ac",
      opts.mono ? "1" : "2",
    );
  }

  args.push(opts.outputPath);
  await runFfmpeg(args, opts.timeoutMs);
}

/**
 * Compression agressive pour le stockage (cible ≤ 12 Mo).
 * Upload brut jusqu’à 100 Mo → sortie légère côté serveur.
 */
export async function compressVideoBuffer(
  input: Buffer,
): Promise<{ buffer: Buffer; ext: "mp4" }> {
  const trimSeconds = await clipSeconds();
  const ffmpegReady = await isFfmpegAvailable();
  if (!ffmpegReady) {
    if (input.length <= VIDEO_STORED_MAX_BYTES) {
      // Fallback historique: accepter les vidéos déjà assez légères même sans ffmpeg.
      return { buffer: input, ext: "mp4" };
    }
    throw new Error(
      "ffmpeg requis pour traiter les vidéos (découpe max 60s). Installez ffmpeg ou définissez FFMPEG_PATH.",
    );
  }

  if (input.length <= VIDEO_COMPRESS_SKIP_BYTES) {
    const dir = await mkdtemp(path.join(tmpdir(), "chipshop-vidtrim-"));
    const inputPath = path.join(dir, "in.bin");
    const outputPath = path.join(dir, "out.mp4");
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
          "-t",
          String(trimSeconds),
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        30_000,
      );
      const trimmed = await readFile(outputPath);
      if (trimmed.length >= 2048) {
        return { buffer: trimmed, ext: "mp4" };
      }
    } catch {
      // Copie impossible: passer au re-encodage pour garantir la decoupe.
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const dir = await mkdtemp(path.join(tmpdir(), "chipshop-vid-"));
  const inputPath = path.join(dir, "in.bin");
  const timeoutMs = compressTimeoutMs(input.length);

  try {
    await writeFile(inputPath, input);

    // Passes de plus en plus legeres jusqu'a <= 12 Mo, avec decoupe max 60s.
    const attempts: Array<
      Omit<PassOpts, "inputPath" | "outputPath" | "timeoutMs" | "trimSeconds">
    > = [
      { maxWidth: 960, crf: 30, audioKbps: 64, mono: true, fps: 24 },
      { maxWidth: 720, crf: 32, audioKbps: 48, mono: true, fps: 24 },
      { maxWidth: 640, crf: 34, audioKbps: 48, mono: true, fps: 20 },
      { maxWidth: 480, crf: 36, audioKbps: 32, mono: true, fps: 18 },
    ];

    let lastError: unknown;
    let buffer: Buffer | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const outputPath = path.join(dir, `out-${i}.mp4`);
      const base = attempts[i];
      try {
        await encodePass({
          ...base,
          inputPath,
          outputPath,
          trimSeconds,
          timeoutMs,
        });
      } catch {
        try {
          await encodePass({
            ...base,
            inputPath,
            outputPath,
            trimSeconds,
            timeoutMs,
            noAudio: true,
          });
        } catch (retryError) {
          lastError = retryError;
          continue;
        }
      }

      const outStat = await stat(outputPath);
      if (outStat.size < 2048) {
        lastError = new Error("Compression vidéo impossible");
        continue;
      }

      buffer = await readFile(outputPath);
      if (buffer.length <= VIDEO_STORED_MAX_BYTES) {
        return { buffer, ext: "mp4" };
      }
      lastError = new Error(
        `Vidéo encore trop lourde (${Math.round(buffer.length / (1024 * 1024))} Mo, max 12 Mo)`,
      );
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Impossible d'envoyer ce fichier");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
