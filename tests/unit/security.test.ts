import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { hashPassword, verifyPassword, isValidHash } from "@/lib/admin/password";
import { CONTENT_DIR, resolveContentFile, resolveContentFolder } from "@/lib/content";
import { resolveUpload, UPLOAD_DIR } from "@/lib/uploads";
import { backgroundLayer, safeUrl } from "@/lib/background";
import { htmlToText, httpUrl } from "@/lib/widget-data";
import { toPlayer } from "@/widgets/embed/player";
import { BackgroundBaseSchema } from "@/lib/schema/config";

describe("admin password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.match(hash, /^scrypt:32768:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    assert.ok(isValidHash(hash));
    assert.equal(await verifyPassword("correct horse battery", hash), true);
    assert.equal(await verifyPassword("correct horse batter", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });

  it("fails closed on a malformed or abusive hash", async () => {
    const hash = await hashPassword("pw");
    for (const bad of ["", "scrypt:abc", "plain-text-password", hash.replace("32768", "1073741824"), hash.replace("32768", "30000")]) {
      assert.equal(isValidHash(bad), false, bad);
      assert.equal(await verifyPassword("pw", bad), false, bad);
    }
  });
});

describe("file names from requests", () => {
  it("only maps plain .md paths into the content folder", () => {
    assert.equal(resolveContentFile("about.md"), path.join(CONTENT_DIR, "about.md"));
    assert.equal(resolveContentFile("my-page_2.md"), path.join(CONTENT_DIR, "my-page_2.md"));
    assert.equal(resolveContentFile("blog/2026/hello.md"), path.join(CONTENT_DIR, "blog", "2026", "hello.md"));
    for (const bad of [
      "../../.env",
      "../package.json",
      "..%2f.env",
      "/etc/passwd",
      "blog/../../package.json",
      "blog/./x.md",
      "blog//x.md",
      "/blog/x.md",
      "blog/x.md/",
      "blog\\x.md",
      ".git/x.md",
      "blog/.hidden.md",
      "a.md/b.md",
      "a/b/c/d/e/too-deep.md",
      "about.txt",
      ".hidden.md",
      "",
      null,
      undefined,
    ]) {
      assert.equal(resolveContentFile(bad), null, String(bad));
    }
  });

  it("only maps plain folder paths into the content folder, never the folder itself", () => {
    assert.equal(resolveContentFolder("blog/2026"), path.join(CONTENT_DIR, "blog", "2026"));
    for (const bad of ["", ".", "..", "../src", "blog/..", "/blog", "blog/", "x.md", "a/b/c/d/e", null]) {
      assert.equal(resolveContentFolder(bad), null, String(bad));
    }
  });

  it("only maps content-hash names into the uploads folder", () => {
    assert.deepEqual(resolveUpload("0123456789abcdef0123.webp"), { file: path.join(UPLOAD_DIR, "0123456789abcdef0123.webp"), contentType: "image/webp" });
    assert.equal(resolveUpload("0123456789abcdef0123.mp4")?.contentType, "video/mp4");
    for (const bad of ["../visitors.db", "0123456789abcdef0123.svg", "0123456789abcdef0123.webp/..", "abc.webp", "0123456789ABCDEF0123.webp", null]) {
      assert.equal(resolveUpload(bad), null, String(bad));
    }
  });
});

describe("URLs placed into CSS and links", () => {
  it("lets only uploads and plain http(s) URLs into a background", () => {
    assert.equal(safeUrl("/api/uploads/abc.webp"), "/api/uploads/abc.webp");
    assert.equal(safeUrl("https://example.com/bg.jpg"), "https://example.com/bg.jpg");
    for (const bad of ['https://x.com/a.jpg") , url("javascript:alert(1)', "https://x.com/a b.jpg", "https://x.com/a'.jpg", "https://x.com/(a).jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "/etc/passwd", "//evil.com/x.jpg", undefined]) {
      assert.equal(safeUrl(bad), null, String(bad));
    }
  });

  it("does not draw an image background from an unsafe URL", () => {
    const base = BackgroundBaseSchema.parse({ type: "image", image: 'x") ; color: red; ("' });
    assert.equal(backgroundLayer(base).empty, true);
  });

  it("hands only http(s) links to the browser", () => {
    assert.equal(httpUrl("https://example.com/post"), "https://example.com/post");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "not a url", "", null]) assert.equal(httpUrl(bad), null, String(bad));
  });

  it("turns HTML from other sites into plain text", () => {
    assert.equal(htmlToText('<p>Hi <a href="x">there</a></p><p>Line&nbsp;2 &amp; <b>more</b></p>'), "Hi there\n\nLine 2 & more");
    assert.equal(htmlToText("<script>alert(1)</script>ok"), "alert(1)ok");
    assert.equal(htmlToText("a<br>b<br/>c"), "a\nb\nc");
  });
});

describe("embed links", () => {
  it("recognises the four supported sites in their usual link forms", () => {
    const cases: [string, string][] = [
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
      ["https://youtu.be/dQw4w9WgXcQ?t=42", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
      ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
      ["https://www.youtube.com/playlist?list=PL12345abc", "https://www.youtube-nocookie.com/embed/videoseries?list=PL12345abc"],
      ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
      ["https://open.spotify.com/intl-it/track/4cOdK2wGLETKBW3PvgPWqT?si=abc", "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT"],
      ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M"],
      ["https://soundcloud.com/artist/track-name", "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name&visual=false"],
    ];
    for (const [link, src] of cases) assert.equal(toPlayer(link)?.src, src, link);
    assert.equal(toPlayer("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")?.height, 152);
  });

  it("never builds a player for anything else", () => {
    for (const bad of ["https://example.com/watch?v=dQw4w9WgXcQ", "https://evil-youtube.com/watch?v=abc", "https://www.youtube.com/watch?v=<script>", "javascript:alert(1)", "not a link", "https://open.spotify.com/user/someone"]) {
      assert.equal(toPlayer(bad), null, bad);
    }
  });
});
