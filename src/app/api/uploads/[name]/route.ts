import fs from "fs";
import { Readable } from "stream";
import { resolveUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Serves an uploaded background image or video. Public, like the backgrounds themselves.
 * Names are content hashes, so responses can be cached forever. Byte ranges are
 * supported because browsers (Safari in particular) require them to play video.
 */
export async function GET(request: Request, ctx: { params: Promise<{ name: string }> }) {
  const upload = resolveUpload((await ctx.params).name);
  let size = 0;
  try {
    if (upload) size = fs.statSync(upload.file).size;
  } catch {}
  if (!upload || !size) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": upload.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    // "a-b", "a-" (to the end) or "-n" (the last n bytes).
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const body = Readable.toWeb(fs.createReadStream(upload.file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }

  const body = Readable.toWeb(fs.createReadStream(upload.file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}
