import sharp from "sharp";
import {
  AVATAR_MAX_EDGE,
  DOCUMENT_MAX_EDGE,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  IMAGE_STORED_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  type CompressVariant,
} from "@/lib/media";

function boundsFor(variant: CompressVariant) {
  if (variant === "avatar") {
    return { width: AVATAR_MAX_EDGE, height: AVATAR_MAX_EDGE };
  }
  if (variant === "document") {
    return { width: DOCUMENT_MAX_EDGE, height: DOCUMENT_MAX_EDGE };
  }
  return { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT };
}

/**
 * Compression serveur rapide.
 * `skipIfLight` : si le client a déjà compressé (jpeg/webp sous cible), on garde.
 */
export async function compressImageBuffer(
  input: Buffer,
  variant: CompressVariant = "product",
  options?: { skipIfLight?: boolean; mimeHint?: string },
): Promise<{
  buffer: Buffer;
  ext: "webp" | "jpg";
}> {
  const mime = (options?.mimeHint ?? "").toLowerCase();
  const looksJpegOrWebp =
    mime.includes("jpeg") ||
    mime.includes("jpg") ||
    mime.includes("webp") ||
    // magic bytes
    (input[0] === 0xff && input[1] === 0xd8) ||
    (input[0] === 0x52 && input[1] === 0x49 && input[8] === 0x57);

  if (
    options?.skipIfLight &&
    looksJpegOrWebp &&
    input.length <= IMAGE_TARGET_BYTES * 1.2 &&
    input.length <= IMAGE_STORED_MAX_BYTES
  ) {
    const isWebp =
      mime.includes("webp") ||
      (input[0] === 0x52 && input[1] === 0x49 && input[8] === 0x57);
    return { buffer: input, ext: isWebp ? "webp" : "jpg" };
  }

  const { width, height } = boundsFor(variant);
  const base = sharp(input, { failOn: "none" }).rotate().resize({
    width,
    height,
    fit: "inside",
    withoutEnlargement: true,
    // Plus rapide que le défaut (lanczos3)
    kernel: sharp.kernel.cubic,
  });

  // Une seule passe JPEG (effort WebP élevé = lent).
  let buffer = await base
    .clone()
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();

  if (buffer.length > IMAGE_STORED_MAX_BYTES) {
    buffer = await base
      .clone()
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer();
  }
  if (buffer.length > IMAGE_STORED_MAX_BYTES) {
    throw new Error("Impossible d'envoyer ce fichier");
  }
  return { buffer, ext: "jpg" };
}
