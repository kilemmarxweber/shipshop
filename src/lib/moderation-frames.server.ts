import { spawn } from "child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

function ffmpegBin() {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export async function extractVideoJpegFrames(
  buffer: Buffer,
  opts?: { intervalSec?: number; maxFrames?: number },
): Promise<Buffer[]> {
  const intervalSec = opts?.intervalSec ?? 2;
  const maxFrames = opts?.maxFrames ?? 12;
  const dir = await mkdtemp(path.join(tmpdir(), "chipshop-mod-"));
  try {
    const input = path.join(dir, "clip.bin");
    await writeFile(input, buffer);
    const pattern = path.join(dir, "f-%03d.jpg");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpegBin(),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          input,
          "-vf",
          `fps=1/${intervalSec},scale=640:-2`,
          "-frames:v",
          String(maxFrames),
          "-q:v",
          "5",
          pattern,
        ],
        { windowsHide: true },
      );
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("ffmpeg timeout"));
      }, 25_000);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `ffmpeg exited ${code}`));
      });
    });
    const names = (await readdir(dir))
      .filter((name) => /^f-\d+\.jpg$/i.test(name))
      .sort();
    if (names.length === 0) {
      throw new Error("Aucune frame extraite");
    }
    return Promise.all(names.map((name) => readFile(path.join(dir, name))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
