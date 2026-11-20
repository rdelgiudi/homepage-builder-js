import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client, startServer, type TestServer } from "./server";

const config = {
  version: 2,
  name: "Pages Test",
  tagline: "Site tagline",
  tabs: [{ id: "home", label: "Home", sections: [{ id: "home-links", type: "links", items: [{ label: "More", url: "/more" }] }] }],
  homeSettings: { counters: { viewers: false, visitors: false } },
  pages: [
    {
      id: "page-deeper",
      slug: "more/deeper",
      title: "Deeper",
      tabs: [{ id: "deeper-main", label: "Main", sections: [{ id: "deeper-text", type: "text", content: "A page under More" }] }],
    },
    {
      id: "page-more",
      slug: "more",
      title: "More things",
      description: "A second page",
      settings: { background: { base: { type: "solid", dark: "#123456" } }, header: { name: "More Site", tagline: "Only on the second page's header" } },
      tabs: [
        {
          id: "more-main",
          label: "Main",
          sections: [
            { id: "more-skills", type: "skills", text: "Page widget", items: [{ label: "Only on the second page" }] },
            { id: "more-poll", type: "poll", question: "Tea?", options: ["Yes", "No"] },
            { id: "more-notice", type: "notice", message: "Read on", linkText: "Next", linkUrl: "/?tab=home" },
          ],
        },
      ],
    },
  ],
};

/** The rendered markup only (Next's flight data after it repeats things). */
const rendered = (html: string) => html.slice(0, html.indexOf("self.__next_f"));

describe("pages", () => {
  let server: TestServer;
  let admin: Client;

  before(async () => {
    server = await startServer({ env: { ADMIN_PASSWORD: "pw" }, config });
    admin = new Client(server.url);
    assert.equal((await admin.request("/api/admin/login", { json: { password: "pw" } })).status, 200);
  });
  after(() => server?.stop());

  it("serves a page at its address, with its own title and the site around it", async () => {
    const res = await fetch(server.url + "/more");
    assert.equal(res.status, 200);
    const html = rendered(await res.text());
    assert.match(html, /<title>More things · More Site<\/title>/, "the page's own name");
    assert.match(html, /<meta name="description" content="A second page"/);
    assert.match(html, /Only on the second page/);
    assert.match(html, /<a[^>]*title="Back to the homepage"[^>]*href="\/"[^>]*>More Site<\/a>/, "the (page's own) name links home");
    assert.match(html, /Only on the second page&#x27;s header|Only on the second page's header/);
    const home = rendered(await (await fetch(server.url + "/")).text());
    assert.match(home, /<title>Pages Test<\/title>/, "the homepage keeps the site's name");
    assert.doesNotMatch(home, /More Site/);
    // Same-site link fields work on pages, and open in the same tab.
    assert.match(html, /<a href="\/\?tab=home"(?![^>]*target)/);
    assert.doesNotMatch(rendered(await (await fetch(server.url + "/")).text()), /Only on the second page/);
  });

  it("each page uses its own settings where it has them, the site's otherwise", async () => {
    const more = rendered(await (await fetch(server.url + "/more")).text());
    const home = rendered(await (await fetch(server.url + "/")).text());
    assert.match(more, /--bg-dark:#123456/, "the page's own background");
    assert.doesNotMatch(home, /--bg-dark:#123456/, "not on the homepage");
    // The homepage has its own counters (both off); the other page keeps the site's (on).
    assert.doesNotMatch(home, /site-fixed-bottom fixed bottom-4 left-4[^>]*><div class="flex flex-col/);
    assert.match(more, /site-fixed-bottom fixed bottom-4 left-4[^>]*><div class="flex flex-col/);
  });

  it("serves a page nested under another at /more/deeper, and its draft in the preview", async () => {
    const html = rendered(await (await fetch(server.url + "/more/deeper")).text());
    assert.match(html, /A page under More/);
    assert.match(html, /<title>Deeper · /);
    assert.doesNotMatch(rendered(await (await fetch(server.url + "/more/deeper/nope/x")).text()), /A page under More/, "deeper than any page");
    assert.match((await admin.json("/admin/preview/more/deeper")).text, /A page under More/);
  });

  it("finds a page whatever the case of its address", async () => {
    assert.match(rendered(await (await fetch(server.url + "/More")).text()), /Only on the second page/);
  });

  it("answers unknown addresses with the not-found page", async () => {
    const html = rendered(await (await fetch(server.url + "/nope")).text());
    assert.doesNotMatch(html, /Only on the second page|More things/);
  });

  it("widgets on a page work like on the homepage: polls, overlays", async () => {
    const visitor = new Client(server.url);
    const vote = await visitor.json("/api/poll", { json: { id: "more-poll", option: "Yes" } });
    assert.deepEqual(vote.data, { counts: [1, 0], total: 1, voted: "Yes" });
    const overlay = rendered(await (await fetch(server.url + "/overlay/more-skills")).text());
    assert.match(overlay, /Only on the second page/);
  });

  it("previews a page of the draft, only with a session", async () => {
    const draft = structuredClone(config);
    (draft.pages.find((p) => p.slug === "more")!.tabs[0].sections[0] as { items?: unknown[] }).items = [{ label: "Draft-only skill" }];
    assert.equal((await admin.json("/api/admin/config", { method: "PUT", json: { config: draft } })).status, 200);
    const preview = (await admin.json("/admin/preview/more")).text;
    assert.match(preview, /Draft-only skill/);
    assert.match(preview, /data-section-id="more-skills"/, "marked for dropping widgets in the editor");
    assert.doesNotMatch(await (await fetch(server.url + "/admin/preview/more")).text(), /Draft-only skill/, "signed out");
    assert.doesNotMatch(await (await fetch(server.url + "/more")).text(), /Draft-only skill/, "the live site");
  });

  it("refuses a draft with a reserved or repeated address", async () => {
    for (const slug of ["admin-area", "api", "posts", "posts/x", "admin/x", "a/b/c/d"]) {
      const bad = structuredClone(config);
      bad.pages[0].slug = slug;
      const res = await admin.json("/api/admin/config", { method: "PUT", json: { config: bad } });
      assert.equal(res.status, 400, slug);
    }
    const twice = structuredClone(config);
    twice.pages.push({ ...structuredClone(config.pages[0]), id: "page-2", tabs: [] });
    assert.equal((await admin.json("/api/admin/config", { method: "PUT", json: { config: twice } })).status, 400);
  });
});
