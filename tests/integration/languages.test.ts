import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/admin/password";
import { Client, startServer, type TestServer } from "./server";

const PASSWORD = "integration test password";
const config = {
  version: 2,
  name: "Original name",
  tagline: "Original tagline",
  tabs: [
    { id: "home", label: "Home tab", sections: [{ id: "t", type: "text", content: "Original words" }, { id: "poll", type: "poll", question: "Which?", options: ["Red one", "Blue one"] }] },
    { id: "blog", label: "Blog tab", sections: [{ id: "posts", type: "posts" }] },
  ],
  pages: [{ id: "pg", slug: "about", title: "About page", tabs: [{ id: "a", label: "A tab", sections: [{ id: "at", type: "text", content: "Original words" }] }] }],
  languages: {
    original: "en",
    translations: [
      { code: "it", texts: { "Original name": "Nome tradotto", "Original words": "Parole tradotte", "Home tab": "Scheda inizio", "Blog tab": "Scheda blog", "About page": "Pagina chi sono", "Red one": "Rosso" } },
      { code: "de", enabled: false, texts: { "Original words": "Deutsche Worte" } },
      { code: "fr", texts: {} },
    ],
  },
};
const content = {
  "en/doc.md": "# Doc\n\nOriginal file.",
  "it/doc.md": "# Doc\n\nFile tradotto.",
  "plain.md": "Only original.",
  "en/hello.md": "---\ntitle: Hello\ndate: 2026-11-18\nsummary: English summary\ntags: [news]\n---\n\nEnglish body.",
  "it/hello.md": "---\ntitle: Ciao\n---\n\nCorpo italiano.",
  // Not moved into the original's folder (yet): works the same.
  "wip.md": "---\ntitle: Wip\ndate: 2026-11-17\n---\n\nEnglish wip.",
  "it/wip.md": "---\ntitle: Bozza\ndraft: true\n---\n\nNon finito.",
};

describe("languages", () => {
  let server: TestServer;
  before(async () => {
    server = await startServer({ env: { ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) }, config, content });
  });
  after(() => server?.stop());

  const page = async (url: string, headers: Record<string, string> = {}) => (await fetch(server.url + url, { headers })).text();
  const lang = (html: string) => /<main[^>]* lang="([^"]+)"/.exec(html)?.[1];

  it("shows the original by default, with a picker of every language that is switched on", async () => {
    const html = await page("/");
    assert.equal(lang(html), "en");
    assert.ok(html.includes(">Original words<"));
    assert.match(html, /<option[^>]*value="it"[^>]*>Italiano</);
    assert.match(html, /<option[^>]*value="fr"[^>]*>Français</, "also one without any translation");
    assert.ok(!/<option[^>]*value="de"/.test(html), "but not a hidden one");
  });

  it("follows the cookie, the address and the browser, in that order of strength", async () => {
    for (const [url, headers] of [
      ["/", { cookie: "lang=it" }],
      ["/?lang=it", {}],
      ["/?lang=it", { cookie: "lang=en" }],
      ["/", { "accept-language": "it-IT,it;q=0.9,en;q=0.8" }],
    ] as [string, Record<string, string>][]) {
      const html = await page(url, headers);
      assert.equal(lang(html), "it", `${url} ${JSON.stringify(headers)}`);
      assert.ok(html.includes(">Parole tradotte<"));
      assert.ok(html.includes("<title>Nome tradotto</title>"));
    }
    assert.equal(lang(await page("/", { cookie: "lang=en", "accept-language": "it" })), "en", "choosing the original sticks");
    const french = await page("/?lang=fr");
    assert.equal(lang(french), "fr");
    assert.ok(french.includes(">Original words<"), "nothing translated: the original");
    for (const code of ["de", "xx", "constructor"]) assert.equal(lang(await page(`/?lang=${code}`)), "en", code);
  });

  it("translates other pages and their titles", async () => {
    const html = await page("/about", { cookie: "lang=it" });
    assert.ok(html.includes("<title>Pagina chi sono · Nome tradotto</title>"));
    assert.ok(html.includes(">Parole tradotte<"));
  });

  it("an overlay follows only its own address", async () => {
    assert.ok((await page("/overlay/t", { cookie: "lang=it", "accept-language": "it" })).includes(">Original words<"));
    assert.ok((await page("/overlay/t?lang=it")).includes(">Parole tradotte<"));
    assert.ok((await page("/overlay/t?lang=de")).includes(">Original words<"), "not a hidden language");
  });

  it("poll votes are stored by the original option in every language", async () => {
    const res = await new Client(server.url).request("/api/poll", { json: { id: "poll", option: "Red one" } });
    assert.equal(res.status, 200);
    const translated = await new Client(server.url).request("/api/poll", { json: { id: "poll", option: "Rosso" } });
    assert.notEqual(translated.status, 200);
  });

  it("serves a markdown file's translation where there is one", async () => {
    const md = async (q: string) => (await (await fetch(`${server.url}/api/markdown?${q}`)).json()).html as string;
    assert.match(await md("file=doc.md"), /Original file/);
    assert.match(await md("file=doc.md&lang=it"), /File tradotto/);
    assert.match(await md("file=plain.md&lang=it"), /Only original/);
    assert.match(await md("file=doc.md&lang=../../x"), /Original file/);
    assert.match(await md("file=en/doc.md&lang=it"), /File tradotto/, "a name written with the original's folder");
  });

  it("a translated post is the same post: one entry, one address, its own words", async () => {
    const posts = async (q = "") => (await (await fetch(`${server.url}/api/widgets/posts${q}`)).json()).data.posts as { slug: string; title: string; summary: string; date: string; tags: string[] }[];
    assert.deepEqual((await posts()).map((p) => [p.slug, p.title]), [["hello", "Hello"], ["wip", "Wip"]]);
    const it_ = await posts("?lang=it");
    assert.deepEqual(it_.map((p) => [p.slug, p.title]), [["hello", "Ciao"], ["wip", "Wip"]], "an unfinished translation isn't used");
    assert.equal(it_[0].date, "2026-11-18", "from the original");
    assert.deepEqual(it_[0].tags, ["news"]);
    assert.equal(it_[0].summary, "Corpo italiano.", "not the original's summary");
    assert.ok((await page("/posts/hello", { cookie: "lang=it" })).includes("Corpo italiano"));
    assert.ok((await page("/posts/hello")).includes("English body"));
    assert.ok(!(await page("/posts/it/hello")).includes("Corpo italiano"), "no address of its own");
    assert.ok((await page("/posts/en/hello")).includes("English body"), "an old link with the folder still works");
  });

  it("moving a markdown file takes its translations along", async () => {
    const admin = new Client(server.url);
    assert.equal((await admin.request("/api/admin/login", { json: { password: PASSWORD } })).status, 200);
    const move = (from: string, to: string) => admin.json("/api/admin/content", { method: "PATCH", json: { from, to } });
    const res = await move("en/doc.md", "en/docs/guide.md");
    assert.equal(res.status, 200);
    assert.deepEqual((res.data as { moved: unknown }).moved, [{ from: "en/doc.md", to: "en/docs/guide.md" }, { from: "it/doc.md", to: "it/docs/guide.md" }]);
    assert.ok(fs.existsSync(path.join(server.dir, "src/content/it/docs/guide.md")));
    // A folder too, and from no language folder into the original's.
    assert.deepEqual(((await move("en/docs", "en/help")).data as { moved: unknown[] }).moved, [{ from: "en/docs/guide.md", to: "en/help/guide.md" }, { from: "it/docs/guide.md", to: "it/help/guide.md" }]);
    assert.ok(!fs.existsSync(path.join(server.dir, "src/content/it/docs")), "no empty folder left behind");
    // A translation that is in the way is never overwritten, and nothing moves.
    await admin.json("/api/admin/content", { method: "PUT", json: { file: "it/x.md", content: "mine" } });
    assert.equal((await move("en/help/guide.md", "en/x.md")).status, 409);
    assert.ok(fs.existsSync(path.join(server.dir, "src/content/en/help/guide.md")));
    // The name widgets use finds the original.
    assert.match(String((await admin.json("/api/admin/content?file=help/guide.md")).data.content), /Original file/);
  });

  it("the preview has a language of its own, also a hidden one", async () => {
    const admin = new Client(server.url);
    await admin.request("/api/admin/login", { json: { password: PASSWORD } });
    const jar = (admin as unknown as { cookies: Map<string, string> }).cookies;
    const preview = async () => (await admin.request("/admin/preview")).text();
    jar.set("lang", "it");
    assert.equal(lang(await preview()), "en", "not the visitor's choice");
    jar.set("preview_lang", "de");
    const html = await preview();
    assert.equal(lang(html), "de");
    // A post too: the draft's look and the preview's language, not the visitor's.
    jar.set("lang", "en");
    jar.set("preview_lang", "it");
    const post = await (await admin.request("/admin/preview/posts/hello")).text();
    assert.equal(lang(post), "it");
    assert.ok(post.includes("Corpo italiano"));
    assert.match(post, /<select[^>]*aria-label="Language"/);
    assert.ok(!(await (await fetch(server.url + "/admin/preview/posts/hello")).text()).includes("English body"), "needs a session");
    jar.set("preview_lang", "de");
    assert.ok(html.includes(">Deutsche Worte<"));
  });
});

describe("languages: publishing splits the markdown files by language", () => {
  let server: TestServer;
  const admin = () => new Client(server.url);
  const plain = { version: 2, name: "Site", tabs: [{ id: "h", label: "Home", sections: [{ id: "m", type: "markdown", file: "notes/about.md" }] }] };
  before(async () => {
    server = await startServer({
      env: { ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) },
      config: plain,
      content: {
        "notes/about.md": "# About\n\nOriginal about.",
        "notes/deep/a/b/far.md": "Four folders deep.",
        "post.md": "---\ntitle: A post\ndate: 2026-11-01\n---\n\nPost body.",
        "fr/recipe.md": "A folder that happens to be called fr.",
        "it/post.md": "---\ntitle: Un articolo\n---\n\nCorpo.",
      },
    });
  });
  after(() => server?.stop());

  const files = async (c: Client) => ((await c.json("/api/admin/content")).data as { files: { name: string }[] }).files.map((f) => f.name);
  const publish = async (c: Client, config: unknown) => {
    assert.equal((await c.json("/api/admin/config", { method: "PUT", json: { config } })).status, 200);
    const res = await c.json("/api/admin/config/publish", { method: "POST", json: {} });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.data.warning, undefined);
  };
  const about = async () => (await (await fetch(`${server.url}/api/markdown?file=notes/about.md`)).json()).html as string;
  const slugs = async () => ((await (await fetch(`${server.url}/api/widgets/posts`)).json()).data.posts as { slug: string }[]).map((p) => p.slug);

  it("moves nothing while the site is in one language", async () => {
    const c = admin();
    await c.request("/api/admin/login", { json: { password: PASSWORD } });
    assert.deepEqual(await slugs(), ["post"], "a translation made before its language is published isn't a second post");
    const before = await files(c);
    await publish(c, { ...plain, tagline: "x" });
    assert.deepEqual(await files(c), before);
  });

  it("moves the originals into the original's folder with the first translation; names and addresses stay", async () => {
    const c = admin();
    await c.request("/api/admin/login", { json: { password: PASSWORD } });
    const translated = { ...plain, languages: { original: "en", translations: [{ code: "it", texts: { Home: "Inizio" } }] } };
    await publish(c, translated);
    const after = await files(c);
    assert.deepEqual(after, ["en/notes/about.md", "en/notes/deep/a/b/far.md", "en/post.md", "fr/recipe.md", "it/post.md"]);
    assert.ok(!fs.existsSync(path.join(server.dir, "src/content/notes")), "the emptied folders are gone");
    assert.match(await about(), /Original about/);
    assert.deepEqual(await slugs(), ["post"]);
    assert.ok((await (await fetch(server.url + "/posts/post", { headers: { cookie: "lang=it" } })).text()).includes("Corpo"));

    // A new file outside the folders works at once and moves along with the next publish; nothing is overwritten.
    await c.json("/api/admin/content", { method: "PUT", json: { file: "new.md", content: "New." } });
    await c.json("/api/admin/content", { method: "PUT", json: { file: "post.md", content: "In the way." } });
    await publish(c, { ...translated, tagline: "y" });
    assert.deepEqual(await files(c), ["en/new.md", "en/notes/about.md", "en/notes/deep/a/b/far.md", "en/post.md", "fr/recipe.md", "it/post.md", "post.md"]);
    await c.json("/api/admin/content?file=post.md", { method: "DELETE" });

    // The original was German all along: its folder is renamed.
    await publish(c, { ...translated, languages: { ...translated.languages, original: "de" } });
    assert.deepEqual(await files(c), ["de/new.md", "de/notes/about.md", "de/notes/deep/a/b/far.md", "de/post.md", "fr/recipe.md", "it/post.md"]);
    assert.match(await about(), /Original about/);

    // Main language and translation swapped: nothing moves, and what Italian doesn't have is shown in German.
    await publish(c, { ...plain, languages: { original: "it", translations: [{ code: "de", texts: {} }] } });
    assert.match(await about(), /Original about/);
    assert.deepEqual(await slugs(), ["post"]);
    assert.ok((await (await fetch(server.url + "/posts/post", { headers: { cookie: "lang=it" } })).text()).includes("Corpo"));
    await publish(c, { ...translated, languages: { ...translated.languages, original: "de" } });

    // Back to one language: the files stay where they are and keep working.
    await publish(c, { ...plain, languages: { original: "de", translations: [] } });
    assert.match(await about(), /Original about/);
    assert.deepEqual(await slugs(), ["post"]);
    // The main language changed with no translation: its folder is still renamed along.
    await publish(c, { ...plain, languages: { original: "es", translations: [] } });
    assert.ok((await files(c)).includes("es/notes/about.md"));
    assert.match(await about(), /Original about/);
    // Changed by hand (no publish): found in the old folder all the same.
    fs.writeFileSync(server.configPath, JSON.stringify({ ...plain, languages: { original: "pt", translations: [] } }));
    assert.match(await about(), /Original about/);
  });
});
