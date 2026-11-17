/**
 * Uploaded background media. Files live in DATA_DIR/uploads under a name derived from
 * their content, and are served publicly at /api/uploads/<name>.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/db";

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const UPLOAD_URL_PREFIX = "/api/uploads/";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
/** Images are scaled down to fit this box; nothing is ever enlarged. */
const MAX_IMAGE_EDGE = 2560;

const NAME = /^[a-f0-9]{20}\.(webp|mp4|webm)$/;
const TYPES: Record<string, string> = { webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };

/** The file path for a stored upload, or `null` if `name` isn't one of ours. */
export function resolveUpload(name: string | null | undefined): { file: string; contentType: string } | null {
  if (!name || !NAME.test(name)) return null;
  return { file: path.join(UPLOAD_DIR, name), contentType: TYPES[name.split(".")[1]] };
}

function store(data: Buffer, ext: string): string {
  const name = `${crypto.createHash("sha256").update(data).digest("hex").slice(0, 20)}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = path.join(UPLOAD_DIR, name);
  // Same content → same name, so uploading a file twice stores it once.
  if (!fs.existsSync(file)) fs.writeFileSync(file, data);
  return name;
}

export class UploadError extends Error {}

/**
 * Re-encodes an image to WebP. Decoding and re-encoding (rather than storing the bytes
 * as sent) guarantees the stored file really is an image, drops metadata such as GPS
 * tags, and caps the dimensions.
 */
export async function storeImage(input: Buffer): Promise<string> {
  if (input.length > MAX_IMAGE_BYTES) throw new UploadError("That image is too large (20 MB max).");
  const sharp = (await import("sharp")).default;
  let output: Buffer;
  try {
    // SVG is refused: sharp would rasterise it, but its input can reference external files.
    const meta = await sharp(input).metadata();
    if (!meta.format || !["jpeg", "png", "webp", "avif", "gif", "tiff"].includes(meta.format)) {
      throw new UploadError("Use a JPEG, PNG, WebP, AVIF or GIF image.");
    }
    const encode = (animated: boolean) =>
      sharp(input, { animated }).rotate().resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    // Keep every frame of an animated GIF / WebP (88×31 buttons, stickers…). One too big to
    // decode as a whole (all frames together exceed sharp's pixel limit) is stored as a still.
    output = (meta.pages ?? 1) > 1 ? await encode(true).catch(() => encode(false)) : await encode(false);
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError("That file could not be read as an image.");
  }
  return store(output, "webp");
}

/** Videos are stored as sent (no re-encoding), after checking the container's signature. */
export function storeVideo(input: Buffer): string {
  if (input.length > MAX_VIDEO_BYTES) throw new UploadError("That video is too large (60 MB max).");
  const isMp4 = input.length > 12 && input.toString("latin1", 4, 8) === "ftyp";
  const isWebm = input.length > 4 && input.readUInt32BE(0) === 0x1a45dfa3;
  if (!isMp4 && !isWebm) throw new UploadError("Use an MP4 or WebM video.");
  return store(input, isMp4 ? "mp4" : "webm");
}

export interface UploadInfo {
  name: string;
  url: string;
  kind: "image" | "video";
  bytes: number;
  modifiedAt: number;
}

export function listUploads(): UploadInfo[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(UPLOAD_DIR);
  } catch {
    return [];
  }
  return names
    .filter((n) => NAME.test(n))
    .map((name) => {
      const stat = fs.statSync(path.join(UPLOAD_DIR, name));
      return { name, url: UPLOAD_URL_PREFIX + name, kind: name.endsWith(".webp") ? ("image" as const) : ("video" as const), bytes: stat.size, modifiedAt: stat.mtimeMs };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}
