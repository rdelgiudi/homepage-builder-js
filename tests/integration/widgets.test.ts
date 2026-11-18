import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startServer, type TestServer } from "./server";

const config = {
  version: 2,
  name: "Widget test site",
  tabs: [
    {
      id: "home",
      label: "Home",
      sections: [
        { id: "p", type: "profile", name: "Test Person", pronouns: "they/them", bio: "Hello there", socials: [{ url: "https://github.com/test" }, { url: "javascript:alert(1)" }] },
        { id: "s", type: "socials", items: [{ url: "https://bsky.app/profile/test.bsky.social" }, { url: "me@example.com" }] },
        { id: "n", type: "notice", message: "Server maintenance tonight" },
        { id: "old", type: "notice", message: "Long gone notice", until: "2000-01-01T00:00", timezone: "UTC" },
        { id: "pr", type: "projects", items: [{ title: "Rocket", description: "Goes up", tags: ["godot"], url: "https://example.com/rocket" }] },
        { id: "sc", type: "schedule", timezone: "Europe/Rome", items: [{ label: "Stream", days: ["tue"], time: "20:00", duration: 60 }] },
        { id: "st", type: "stats", items: [{ value: "2,400 h", label: "played" }] },
        { id: "m", type: "media", service: "letterboxd", username: "" },
        { id: "posts", type: "posts" },
      ],
    },
    { id: "blog", label: "Blog", sections: [{ id: "posts-2", type: "posts", tag: "news" }] },
  ],
};

const content = {
  "hello-world.md": "---\ntitle: Hello world\ndate: 2026-11-18\ntags: [news]\n---\n\nFirst **post** body.",
  "older.md": "---\ntitle: Older post\ndate: \"2026-01-02\"\nsummary: A custom summary\n---\n\nOlder body.",
  "draft.md": "---\ntitle: Secret draft\ndate: 2026-11-19\ndraft: true\n---\n\nNot yet.",
  "about.md": "# About\n\nNot a post (no date).",
};

describe("new widgets", () => {
  let server: TestServer;
  before(async () => {
    server = await startServer({ env: {}, config, content });
  });
  after(() => server?.stop());

  it("renders the page with every new widget", async () => {
    const res = await fetch(server.url + "/");
    assert.equal(res.status, 200);
    const html = await res.text();
    for (const text of ["Test Person", "they/them", "Server maintenance tonight", "Rocket", "2,400 h", "https://github.com/test", "mailto:me@example.com"]) {
      assert.ok(html.includes(text), text);
    }
    // The config is serialized into the page, so look for rendered markup, not the bare text.
    assert.ok(html.includes(">Server maintenance tonight<"));
    assert.ok(!html.includes(">Long gone notice<"), "an expired notice is not rendered");
    assert.ok(!html.includes('href="javascript:'), "unsafe links are dropped");
  });

  it("lists dated, non-draft posts newest first, optionally by tag", async () => {
    const all = await fetch(server.url + "/api/widgets/posts").then((r) => r.json());
    assert.deepEqual(
      all.data.posts.map((p: { slug: string }) => p.slug),
      ["hello-world", "older"]
    );
    assert.equal(all.data.posts[1].summary, "A custom summary");
    assert.equal(all.data.posts[0].summary, "First post body.");
    const news = await fetch(server.url + "/api/widgets/posts?tag=NEWS").then((r) => r.json());
    assert.deepEqual(
      news.data.posts.map((p: { slug: string }) => p.slug),
      ["hello-world"]
    );
  });

  it("serves a post as its own page", async () => {
    const res = await fetch(server.url + "/posts/hello-world");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>Hello world · Widget test site<\/title>/);
    assert.match(html, /<strong>post<\/strong>/);
    // Back leads to the tab that lists posts (here the first tab, so plain "/").
    assert.match(html, /href="\/"/);
  });

  it("does not serve drafts, undated files or anything outside the content folder", async () => {
    for (const slug of ["draft", "about", "..%2Fconfig%2Fhomepage", "no-such-post"]) {
      const html = await fetch(`${server.url}/posts/${slug}`).then((r) => r.text());
      assert.ok(!/Not yet\.|Not a post|Widget test site<\/title>.*version/.test(html), slug);
      assert.ok(!html.includes('<article'), `${slug} renders no post`);
    }
  });

  it("validates media requests before reaching another site", async () => {
    assert.equal((await fetch(server.url + "/api/widgets/media?service=evil&user=x")).status, 400);
    assert.equal((await fetch(server.url + "/api/widgets/media?service=letterboxd&user=../x")).status, 400);
    assert.equal((await fetch(server.url + "/api/widgets/media?service=openlibrary&user=..")).status, 400);
    assert.equal((await fetch(server.url + "/api/widgets/media?service=openlibrary&user=a..b")).status, 400);
    assert.equal((await fetch(server.url + "/api/widgets/media?service=anilist&user=")).status, 400);
  });
});
