import {
  categoryFromLabel,
  categoryFromPixels,
  cleanCategoryName,
  isKnownCategory,
  styleForCategory,
  type PixelStats,
} from "@/lib/catalog-category";
import { isFfmpegAvailable, runFfmpeg } from "@/lib/ffmpeg.server";
import {
  findUploadedFilePath,
  getUploadDirectory,
  relativeUploadPathFromUrl,
} from "@/lib/upload-file.server";
import {
  DetectLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";

export type CatalogRead = {
  category: string;
  known: boolean;
  style: string;
  soundQuery: string;
  modelId: string;
};

const EXTRA_FILE = "catalog-categories.json";

function hasAwsCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

let rekognition: RekognitionClient | null = null;

function getRekognition() {
  rekognition ??= new RekognitionClient({
    region: process.env.AWS_REGION?.trim() || "eu-west-1",
  });
  return rekognition;
}

function extraPath() {
  return path.join(getUploadDirectory(), EXTRA_FILE);
}

export async function readExtraCategories() {
  try {
    const raw = await fs.readFile(extraPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const names: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const name = cleanCategoryName(item);
      if (name && !names.some((current) => current.toLowerCase() === name.toLowerCase())) {
        names.push(name);
      }
    }
    return names;
  } catch {
    return [];
  }
}

export async function rememberCategory(category: string) {
  const name = cleanCategoryName(category);
  if (!name) return;
  const extras = await readExtraCategories();
  if (isKnownCategory(name, extras)) return;
  extras.push(name);
  await fs.mkdir(getUploadDirectory(), { recursive: true });
  await fs.writeFile(extraPath(), JSON.stringify(extras), "utf8");
}

async function pixelStats(buffer: Buffer): Promise<PixelStats | null> {
  try {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(48, 48, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    let skin = 0;
    let pink = 0;
    let food = 0;
    let green = 0;
    let blue = 0;
    let vivid = 0;
    let bright = 0;
    let center = 0;
    let centerSkin = 0;
    let count = 0;
    const hues = new Set<number>();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 3;
        const r = data[offset] ?? 0;
        const g = data[offset + 1] ?? 0;
        const b = data[offset + 2] ?? 0;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        bright += max / 255;
        vivid += sat;
        const isSkin =
          r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && r - b > 15;
        const isPink = r > 165 && b > 120 && g < r - 8;
        const isFood = r > g && g >= b && r - b > 40 && (r + g) / 2 > 130 && sat > 0.35;
        const isGreen = g > r + 12 && g > b + 8;
        const isBlue = b > r + 10 && b >= g;
        if (isSkin) skin += 1;
        if (isPink) pink += 1;
        if (isFood) food += 1;
        if (isGreen) green += 1;
        if (isBlue) blue += 1;
        if (sat > 0.28) hues.add(Math.floor(((r * 3 + g * 5 + b) / 80) % 6));
        const inCenter =
          x > width * 0.3 &&
          x < width * 0.7 &&
          y > height * 0.3 &&
          y < height * 0.7;
        if (inCenter) {
          center += 1;
          if (isSkin) centerSkin += 1;
        }
        count += 1;
      }
    }
    if (!count) return null;
    return {
      skin: skin / count,
      pink: pink / count,
      food: food / count,
      green: green / count,
      blue: blue / count,
      vivid: vivid / count,
      bright: bright / count,
      hueBins: hues.size,
      centerSkin: center ? centerSkin / center : 0,
    };
  } catch {
    return null;
  }
}

async function labelsOf(buffer: Buffer) {
  if (!hasAwsCredentials() || buffer.length > 4_500_000) return [];
  try {
    const out = await Promise.race([
      getRekognition().send(
        new DetectLabelsCommand({
          Image: { Bytes: new Uint8Array(buffer) },
          MaxLabels: 8,
          MinConfidence: 58,
        }),
      ),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1600);
      }),
    ]);
    if (!out) return [];
    return (out.Labels ?? [])
      .map((label) => ({
        name: label.Name ?? "",
        confidence: label.Confidence ?? 0,
      }))
      .filter((label) => label.name)
      .sort((a, b) => b.confidence - a.confidence);
  } catch {
    return [];
  }
}

async function videoFrame(filePath: string) {
  if (!(await isFfmpegAvailable())) return null;
  const frame = path.join(os.tmpdir(), `shipshop-cat-${randomUUID()}.jpg`);
  try {
    await runFfmpeg(
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.4",
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-vf",
        "scale=320:-2",
        "-q:v",
        "7",
        frame,
      ],
      8_000,
    );
    return await fs.readFile(frame);
  } catch {
    return null;
  } finally {
    await fs.unlink(frame).catch(() => undefined);
  }
}

function decide(
  labels: { name: string; confidence: number }[],
  pixels: PixelStats | null,
  extras: string[],
) {
  for (const label of labels) {
    const category = categoryFromLabel(label.name);
    if (!category) continue;
    const name = cleanCategoryName(category) ?? category;
    return { category: name, known: isKnownCategory(name, extras) };
  }
  const fromPixels = pixels ? categoryFromPixels(pixels) : "Mode";
  return { category: fromPixels, known: true };
}

export async function classifyUploadedMedia(url: string): Promise<CatalogRead | null> {
  const relative = relativeUploadPathFromUrl(url);
  if (!relative || relative.includes("..")) return null;
  const filePath = await findUploadedFilePath(relative);
  if (!filePath) return null;
  const video = /\.(mp4|webm|mov|m4v)$/i.test(relative);
  const image = /\.(jpe?g|png|webp|heic|heif)$/i.test(relative);
  if (!video && !image) return null;

  const buffer = video ? await videoFrame(filePath) : await fs.readFile(filePath);
  if (!buffer) return null;
  const extras = await readExtraCategories();
  const [pixels, labels] = await Promise.all([pixelStats(buffer), labelsOf(buffer)]);
  const picked = decide(labels, pixels, extras);
  if (!picked.known) await rememberCategory(picked.category).catch(() => undefined);
  const style = styleForCategory(picked.category);
  return { category: picked.category, known: picked.known, ...style };
}
