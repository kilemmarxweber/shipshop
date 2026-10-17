import { mkdtemp, readFile, rm, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { isFfmpegAvailable, runFfmpeg } from "@/lib/ffmpeg.server";

/** Extrait une frame JPEG (vignette) depuis une vidéo compressée. */
export async function extractVideoPosterJpeg(
  input: Buffer,
): Promise<Buffer | null> {
  if (!(await isFfmpegAvailable())) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "chipshop-poster-"));
  const inputPath = path.join(dir, "in.bin");
  const outputPath = path.join(dir, "poster.jpg");

  try {
    await writeFile(inputPath, input);
    await runFfmpeg(
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.15",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(640,iw)':-2",
        "-q:v",
        "4",
        outputPath,
      ],
      30_000,
    );
    const outStat = await stat(outputPath);
    if (outStat.size < 64) return null;
    return readFile(outputPath);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
