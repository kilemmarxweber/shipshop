import { createReadStream, type ReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
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
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".3gp": "video/3gpp",
  ".ogv": "video/ogg",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".wmv": "video/x-ms-wmv",
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

/**
 * Évite ERR_INVALID_STATE (Controller already closed) quand le player
 * annule un range précédent (seek / abort).
 */
function fileStreamToWeb(
  nodeStream: ReadStream,
  signal?: AbortSignal | null,
): ReadableStream<Uint8Array> {
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    nodeStream.removeAllListeners("data");
    nodeStream.removeAllListeners("end");
    nodeStream.removeAllListeners("error");
    if (!nodeStream.destroyed) {
      nodeStream.destroy();
    }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
        stop();
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });

      nodeStream.on("data", (chunk: Buffer | string) => {
        if (stopped) return;
        try {
          const bytes =
            typeof chunk === "string"
              ? new TextEncoder().encode(chunk)
              : new Uint8Array(chunk);
          controller.enqueue(bytes);
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            nodeStream.pause();
          }
        } catch {
          stop();
        }
      });

      nodeStream.on("end", () => {
        if (stopped) return;
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
        stop();
      });

      nodeStream.on("error", (err) => {
        if (stopped) return;
        try {
          controller.error(err);
        } catch {
          /* déjà fermé */
        }
        stop();
      });
    },
    pull() {
      if (!stopped && nodeStream.isPaused()) nodeStream.resume();
    },
    cancel() {
      stop();
    },
  });
}

async function fileResponse(
  relativePath: string | null,
  includeBody: boolean,
  rangeHeader: string | null,
  signal?: AbortSignal | null,
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
  const body = fileStreamToWeb(nodeStream, signal);
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
  return fileResponse(
    relativePath,
    true,
    request.headers.get("range"),
    request.signal,
  );
}

export async function HEAD(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const relativePath = relativeUploadPathFromUrl(
    toPublicUploadPath((segments ?? []).join("/")),
  );
  return fileResponse(
    relativePath,
    false,
    request.headers.get("range"),
    request.signal,
  );
}
