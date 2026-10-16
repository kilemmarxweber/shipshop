import sharp from "sharp";
import {
  AVATAR_MAX_EDGE,
  DOCUMENT_MAX_EDGE,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  STORED_MAX_BYTES,
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

export async function compressImageBuffer(
  input: Buffer,
  variant: CompressVariant = "product",
): Promise<{
  buffer: Buffer;
  ext: "webp" | "jpg";
}> {
  const { width, height } = boundsFor(variant);
  const base = sharp(input, { failOn: "none" }).rotate().resize({
    width,
    height,
    fit: "inside",
    withoutEnlargement: true,
  });

  let quality = 80;
  let buffer = await base.clone().webp({ quality, effort: 4 }).toBuffer();
  while (buffer.length > STORED_MAX_BYTES && quality > 45) {
    quality -= 15;
    buffer = await base.clone().webp({ quality, effort: 4 }).toBuffer();
  }

  if (buffer.length > STORED_MAX_BYTES) {
    buffer = await base
      .clone()
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer();
    if (buffer.length > STORED_MAX_BYTES) {
      throw new Error("Image trop lourde même après compression (< 5 Mo)");
    }
    return { buffer, ext: "jpg" };
  }

  return { buffer, ext: "webp" };
}
