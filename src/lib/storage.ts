import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { BusinessError } from "./business";
export async function storeMedia(file: File) {
  if (file.size > 20 * 1024 * 1024 || file.size === 0)
    throw new BusinessError("Choose a file between 1 byte and 20 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer;
  let ext: string;
  let type: string;
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    try {
      buffer = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BusinessError(
        "The image could not be read. Use a valid JPEG, PNG, or WebP.",
      );
    }
    ext = "webp";
    type = "image";
  } else if (
    file.type === "video/mp4" &&
    bytes.subarray(4, 8).toString() === "ftyp"
  ) {
    buffer = bytes;
    ext = "mp4";
    type = "video";
  } else
    throw new BusinessError("Supported formats: JPEG, PNG, WebP, and MP4.");
  const name = `${randomUUID()}.${ext}`;
  if (process.env.STORAGE_PROVIDER === "vercel-blob") {
    const blob = await put(`inventory/${name}`, buffer, {
      access: "public",
      contentType: type === "image" ? "image/webp" : "video/mp4",
      addRandomSuffix: false,
    });
    return { url: blob.url, type };
  }
  if (process.env.VERCEL)
    throw new BusinessError(
      "Configure durable media storage for this deployment.",
    );
  const root = path.join(process.cwd(), ".data", "uploads");
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, name), buffer);
  return { url: `/api/media/${name}`, type };
}
