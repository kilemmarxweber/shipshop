import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  findUploadedFilePath,
  relativeUploadPathFromUrl,
} from "@/lib/upload-file.server";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

async function fileResponse(
  relativePath: string | null,
  includeBody: boolean,
): Promise<Response> {
  if (!relativePath) {
    return Response.json({ error: "Nom de fichier invalide" }, { status: 400 });
  }

  const filePath = await findUploadedFilePath(relativePath);
  if (!filePath) {
    return Response.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
  const size = fileStat.size;
  const headers = new Headers({
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  if (!includeBody || size === 0) {
    return new Response(null, { status: 200, headers });
  }

  const nodeStream = createReadStream(/*turbopackIgnore: true*/ filePath);
  const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(body, { status: 200, headers });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const relativePath = relativeUploadPathFromUrl(
    `/uploads/${(segments ?? []).join("/")}`,
  );
  return fileResponse(relativePath, true);
}

export async function HEAD(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const relativePath = relativeUploadPathFromUrl(
    `/uploads/${(segments ?? []).join("/")}`,
  );
  return fileResponse(relativePath, false);
}
