import fs from "fs";
import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
import { readPublishedRaw } from "@/lib/admin/publish";
import { audit, getDraft } from "@/lib/admin/store";
import { listUploads, resolveUpload, storeImage, storeVideo, UPLOAD_URL_PREFIX, UploadError } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Uploaded files, newest first, each flagged with whether the live config or the draft uses it. */
export const GET = withAdmin(async () => {
  const haystack = `${readPublishedRaw() ?? ""}${JSON.stringify(getDraft()?.value ?? "")}`;
  return NextResponse.json({ uploads: listUploads().map((u) => ({ ...u, inUse: haystack.includes(u.url) })) });
});

/** multipart/form-data with one `file`. Images are re-encoded to WebP; videos are stored as sent. */
export const POST = withAdmin(async (request) => {
  let file: unknown;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Send the file as multipart form data." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const name = file.type.startsWith("video/") ? storeVideo(data) : await storeImage(data);
    audit("upload.add", name, file.name.slice(0, 120));
    return NextResponse.json({ ok: true, name, url: UPLOAD_URL_PREFIX + name });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      return NextResponse.json({ error: "The data folder is not writable, so the file can't be stored." }, { status: 500 });
    }
    throw err;
  }
});

export const DELETE = withAdmin(async (request) => {
  const name = new URL(request.url).searchParams.get("name");
  const upload = resolveUpload(name);
  if (!upload) return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  fs.rmSync(upload.file, { force: true });
  audit("upload.delete", name);
  return NextResponse.json({ ok: true });
});
