import { spawn } from "child_process";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { homedir } from "os";

async function fileExists(filePath: string) {
  try {
    await access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    try {
      await access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/** Chemins courants (WinGet / Linux) quand PATH du processus Next est incomplet. */
function candidateBins(): string[] {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  const home = homedir();
  const localAppData =
    process.env.LOCALAPPDATA?.trim() ||
    path.join(home, "AppData", "Local");
  const wingetPkg = path.join(
    localAppData,
    "Microsoft",
    "WinGet",
    "Packages",
  );
  const list = [
    fromEnv,
    "ffmpeg",
    path.join(localAppData, "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
    // Build Gyan courant (évite le symlink WinGet Links)
    path.join(
      wingetPkg,
      "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "ffmpeg-9.0.2-full_build",
      "bin",
      "ffmpeg.exe",
    ),
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ].filter((v): v is string => Boolean(v));
  return [...new Set(list)];
}

let resolvedBin: string | null = null;

export async function resolveFfmpegBin(): Promise<string | null> {
  if (resolvedBin) return resolvedBin;
  for (const bin of candidateBins()) {
    if (bin !== "ffmpeg" && !(await fileExists(bin))) continue;
    try {
      await runFfmpegWithBin(bin, ["-hide_banner", "-version"], 5_000);
      resolvedBin = bin;
      return bin;
    } catch {
      /* essayer le suivant */
    }
  }
  return null;
}

export function ffmpegBin() {
  return (
    resolvedBin ||
    process.env.FFMPEG_PATH?.trim() ||
    "ffmpeg"
  );
}

function runFfmpegWithBin(
  bin: string,
  args: string[],
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      env: process.env,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timeout"));
    }, timeoutMs);
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
}

export async function runFfmpeg(
  args: string[],
  timeoutMs: number,
): Promise<void> {
  const bin = (await resolveFfmpegBin()) || ffmpegBin();
  return runFfmpegWithBin(bin, args, timeoutMs);
}

function parseDurationMs(stderr: string) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/** Durée d’un fichier (ffmpeg -i, sans transcodage). */
export async function probeDurationMs(inputPath: string): Promise<number | null> {
  const bin = (await resolveFfmpegBin()) || ffmpegBin();
  return new Promise((resolve) => {
    const child = spawn(bin, ["-hide_banner", "-i", inputPath], {
      windowsHide: true,
      env: process.env,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(parseDurationMs(stderr));
    }, 12_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(parseDurationMs(stderr));
    });
  });
}

let ffmpegAvailableCache: boolean | null = null;

/** Détecte si ffmpeg est utilisable (avec résolution de chemin Windows). */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailableCache === true) return true;
  const bin = await resolveFfmpegBin();
  ffmpegAvailableCache = Boolean(bin);
  return ffmpegAvailableCache;
}
