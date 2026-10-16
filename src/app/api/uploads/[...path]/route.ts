import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  findUploadedFilePath,
  relativeUploadPathFromUrl,
} from "@/lib/upload-file.server";
import { toPublicUploadPath } from "@/lib/upload-url";

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

function parseByteRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return "invalid" as const;
  const hasStart = match[1] !== "";
  const hasEnd = match[2] !== "";
  if (!hasStart && !hasEnd) return "invalid" as const;
  let start: number;
  let end: number;
  if (!hasStart) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid" as const;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = hasEnd ? Number(match[2]) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid" as const;
  if (start >= size || start < 0 || end < start) return "invalid" as const;
  return { start, end: Math.min(end, size - 1) };
}

async function fileResponse(
  relativePath: string | null,
  includeBody: boolean,
  rangeHeader: string | null,
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
  const type = contentTypeFor(filePath);
  const range = parseByteRange(rangeHeader, size);

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, size - 1);
  const length = size === 0 ? 0 : end - start + 1;
  const partial = Boolean(range) && size > 0;

  const headers = new Headers({
    "Content-Type": type,
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": "inline",
  });
  if (partial) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  if (!includeBody || size === 0) {
    return new Response(null, {
      status: partial ? 206 : 200,
      headers,
    });
  }

  const nodeStream = createReadStream(/*turbopackIgnore: true*/ filePath, {
    start,
    end,
  });
  const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: partial ? 206 : 200,
    headers,
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const relativePath = relativeUploadPathFromUrl(
    toPublicUploadPath((segments ?? []).join("/")),
  );
  return fileResponse(relativePath, true, request.headers.get("range"));
}

export async function HEAD(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const relativePath = relativeUploadPathFromUrl(
    toPublicUploadPath((segments ?? []).join("/")),
  );
  return fileResponse(relativePath, false, request.headers.get("range"));
}
