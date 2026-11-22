import { isFfmpegAvailable, runFfmpeg } from "@/lib/ffmpeg.server";
import { getSession } from "@/lib/session";
import {
    findUploadedFilePath,
    relativeUploadPathFromUrl,
    writeUploadBuffer,
} from "@/lib/upload-file.server";
import { randomUUID } from "crypto";
import { constants as fsConstants } from "fs";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";

const POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const FONT_SIZES: Record<number, number> = { 22: 36, 32: 54, 42: 72 };

function filterPath(filePath: string) {
  const slash = filePath.replace(/\\/g, "/").replace(/'/g, "\\'");
  return `'${slash.replace(/:/g, "\\:")}'`;
}

function textAnchor(position: string) {
  const [vertical, horizontal] = position.split("-");
  const x =
    horizontal === "left"
      ? "w*0.06"
      : horizontal === "right"
        ? "w-text_w-w*0.06"
        : "(w-text_w)/2";
  const y =
    vertical === "top"
      ? "h*0.08"
      : vertical === "bottom"
        ? "h-text_h-h*0.1"
        : "(h-text_h)/2";
  return { x, y };
}

async function captionFont() {
  const candidates = [
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.R_OK);
      return candidate;
    } catch {
      // police suivante
    }
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    url?: string;
    text?: string;
    position?: string;
    size?: number;
  } | null;
  const text = String(body?.text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\S ]+/g, "")
    .trim()
    .slice(0, 32);
  const position = String(body?.position ?? "");
  const size = Number(body?.size);
  if (!text || !POSITIONS.has(position) || !FONT_SIZES[size]) {
    return NextResponse.json(
      { error: "Texte de montage invalide" },
      { status: 400 },
    );
  }

  const relative = relativeUploadPathFromUrl(body?.url);
  if (!relative || !/\.(mp4|webm|mov|m4v)$/i.test(relative)) {
    return NextResponse.json({ error: "Vidéo introuvable" }, { status: 400 });
  }
  const source = await findUploadedFilePath(relative);
  if (!source) {
    return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
  }
  if (!(await isFfmpegAvailable())) {
    return NextResponse.json(
      { error: "Montage vidéo indisponible" },
      { status: 503 },
    );
  }
  const font = await captionFont();
  if (!font) {
    return NextResponse.json(
      { error: "Police de montage introuvable" },
      { status: 503 },
    );
  }

  const scratch = path.join(os.tmpdir(), `shipshop-caption-${randomUUID()}`);
  const textFile = `${scratch}.txt`;
  const output = `${scratch}.mp4`;
  const anchor = textAnchor(position);
  try {
    await fs.writeFile(textFile, text, "utf8");
    await runFfmpeg(
      [
        "-y",
        "-i",
        source,
        "-vf",
        [
          `drawtext=fontfile=${filterPath(font)}`,
          `textfile=${filterPath(textFile)}`,
          `fontsize=${FONT_SIZES[size]}`,
          "fontcolor=white",
          "shadowcolor=black@0.85",
          "shadowx=2",
          "shadowy=2",
          `x=${anchor.x}`,
          `y=${anchor.y}`,
        ].join(":"),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        output,
      ],
      120_000,
    );
    const buffer = await fs.readFile(output);
    const saved = await writeUploadBuffer(`${randomUUID()}.mp4`, buffer);
    return NextResponse.json({ url: saved.url });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.message
        ? cause.message.slice(0, 180)
        : "Écriture du texte impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.unlink(textFile).catch(() => undefined);
    await fs.unlink(output).catch(() => undefined);
  }
}
