import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConfig, strictParseConfig } from "@/lib/schema/parse";
import { allIds, linkTarget, markdownLinks, pageView, siteMap, withPageTabs } from "@/lib/pages";
import type { HomepageConfig } from "@/lib/schema/config";

/** A config with a homepage and pages; `links[slug]` = the addresses a Links widget on that page points to. */
function site(links: Record<string, string[]>, slugs = ["page-2", "page-3"]): HomepageConfig {
  const tab = (id: string, hrefs: string[] = []) => ({
    id,
    label: "Main",
    sections: hrefs.length ? [{ id: `${id}-links`, type: "links", items: hrefs.map((url) => ({ label: url, url })) }] : [],
  });
  const raw = {
    version: 2,
    tabs: [tab("home-main", links[""])],
    pages: slugs.map((slug) => ({ id: `p-${slug}`, slug, title: slug, tabs: [tab(`${slug}-main`, links[slug])] })),
  };
  const res = strictParseConfig(raw);
  assert.ok(res.config, JSON.stringify(res.issues));
  return res.config;
}

describe("pages: site map", () => {
  it("home → page 2, page 3 linked from nowhere: page 3 is unreachable", () => {
    const map = siteMap(site({ "": ["/page-2"] }));
    assert.deepEqual(map.unreachable.map((p) => p.slug), ["page-3"]);
    assert.equal(map.parent.get("page-2"), "");
  });

  it("home (no link), page 2 → page 3: neither is reachable, the link from page 2 doesn't help", () => {
    const map = siteMap(site({ "page-2": ["/page-3"] }));
    assert.deepEqual(map.unreachable.map((p) => p.slug), ["page-2", "page-3"]);
  });

  it("follows links through pages: home → page 2 → page 3", () => {
    const map = siteMap(site({ "": ["/page-2"], "page-2": ["/page-3?tab=x"] }));
    assert.deepEqual(map.unreachable, []);
    assert.equal(map.parent.get("page-3"), "page-2");
  });

  it("counts links in markdown files a widget shows, and full addresses on the site's own host", () => {
    const config = site({ "": ["https://my.site/page-2"] });
    config.tabs[0].sections.push({ id: "md", type: "markdown", file: "intro.md" } as never);
    const map = siteMap(config, { "intro.md": ["/page-3"] }, ["my.site"]);
    assert.deepEqual(map.unreachable, []);
    assert.equal(map.links.find((l) => l.to === "page-3")?.file, "intro.md");
    // Another host doesn't count.
    assert.equal(siteMap(site({ "": ["https://other.site/page-2"] }), {}, ["my.site"]).reachable.has("page-2"), false);
  });

  it("reports links to pages that don't exist", () => {
    const map = siteMap(site({ "": ["/page-2", "/gone"] }));
    assert.deepEqual(map.broken.map((l) => l.href), ["/gone"]);
  });
});

describe("pages: links", () => {
  it("linkTarget resolves only addresses that are pages of this site", () => {
    assert.equal(linkTarget("/", "x"), "");
    assert.equal(linkTarget("/?tab=about", "x"), "");
    assert.equal(linkTarget("/page-2/", ""), "page-2");
    assert.equal(linkTarget("/Page-2#top", ""), "page-2");
    assert.equal(linkTarget("page-3", "page-2"), "page-3"); // relative, like a browser: a sibling at the top level
    assert.equal(linkTarget("/about/colophon#x", ""), "about/colophon");
    assert.equal(linkTarget("colophon", "about/team"), "about/colophon"); // relative from a nested page
    assert.equal(linkTarget("../", "about/team"), "");
    assert.equal(linkTarget("/a/b/c/d", ""), null, "deeper than any page");
    assert.equal(linkTarget("/docs/cv.pdf", ""), null, "a file");
    assert.equal(linkTarget("https://my.site/page-2", "", ["my.site"]), "page-2");
    assert.equal(linkTarget("//my.site/page-2", "", ["my.site"]), "page-2");
    for (const other of ["https://example.com/page-2", "mailto:me@x.y", "/posts/hello", "/api/uploads/x.webp", "/admin", "#top", "?tab=x", "", "example.com/x", "/cv.pdf", "/logo.png", "notes.md"]) {
      assert.equal(linkTarget(other, "", ["my.site"]), null, other);
    }
  });

  it("markdownLinks finds inline, reference, HTML and autolinks", () => {
    const text = 'See [two](/page-2 "Two"), <a href="/page-3">three</a> and <https://my.site/x>.\n\n[ref]: /page-4\n';
    assert.deepEqual(markdownLinks(text).sort(), ["/page-2", "/page-3", "/page-4", "https://my.site/x"].sort());
  });
});

describe("pages: config", () => {
  it("page views read and write one page's tabs", () => {
    const config = site({});
    assert.equal(pageView(config, "p-page-2").tabs[0].id, "page-2-main");
    assert.equal(pageView(config, "").tabs[0].id, "home-main");
    const next = withPageTabs(config, "p-page-3", []);
    assert.equal(next.pages[1].tabs.length, 0);
    assert.equal(next.tabs.length, 1);
    assert.ok(allIds(config).has("page-3-main") && allIds(config).has("p-page-2"));
  });

  it("gives pages, their tabs and widgets ids unique across the whole site", () => {
    const res = parseConfig({ version: 2, tabs: [{ label: "About" }], pages: [{ slug: "more", title: "More", tabs: [{ label: "About", sections: [{ type: "text", content: "x" }] }] }] });
    assert.ok(res.config);
    assert.equal(res.config.tabs[0].id, "about");
    assert.equal(res.config.pages[0].id, "page-more");
    assert.equal(res.config.pages[0].tabs[0].id, "about-2");
    assert.equal(res.config.pages[0].tabs[0].sections[0].id, "about-2-text");
  });

  it("a broken widget or page is dropped, not the whole site", () => {
    const res = parseConfig({
      version: 2,
      tabs: [{ label: "Home" }],
      pages: [
        { slug: "ok", title: "OK", tabs: [{ label: "T", sections: [{ type: "nope" }, { type: "text", content: "kept" }] }] },
        { slug: "Bad Slug", title: "Bad" },
        { slug: "ok", title: "Twice" },
      ],
    });
    assert.ok(res.config);
    assert.deepEqual(res.config.pages.map((p) => p.title), ["OK"]);
    assert.equal(res.config.pages[0].tabs[0].sections.length, 1);
    assert.equal(res.warnings.length, 3);
  });

  it("strict parsing refuses reserved or repeated addresses and ids repeated across pages", () => {
    for (const slug of ["admin", "admin-stuff", "api", "apiary", "posts", "overlay", "ws", "Caps", "-x", "a//b", "/a", "a/", "a/b/c/d", "posts/x", "admin/x", "a/B", "a/-b"]) {
      assert.equal(strictParseConfig({ version: 2, tabs: [], pages: [{ id: "p", slug, title: "x" }] }).config, null, slug);
    }
    for (const ok of ["postscript", "about/colophon", "a/b/c", "x/posts"]) {
      assert.ok(strictParseConfig({ version: 2, tabs: [], pages: [{ id: "p", slug: ok, title: "x" }] }).config, ok);
    }
    const twice = strictParseConfig({ version: 2, tabs: [], pages: [{ id: "a", slug: "x", title: "A" }, { id: "b", slug: "x", title: "B" }] });
    assert.match(twice.issues[0]?.message ?? "", /already uses the address/);
    const dupId = strictParseConfig({ version: 2, tabs: [{ id: "t", label: "T" }], pages: [{ id: "p", slug: "x", title: "X", tabs: [{ id: "t", label: "T" }] }] });
    assert.match(dupId.issues[0]?.message ?? "", /Duplicate id "t"/);
  });
});

describe("pages: link fields", () => {
  it("linkHref allows http(s) and same-site paths, nothing that leaves the site sideways", async () => {
    const { linkHref, opens } = await import("@/lib/url");
    assert.equal(linkHref("/page-2?tab=x"), "/page-2?tab=x");
    assert.equal(linkHref(" https://example.com "), "https://example.com/");
    for (const bad of ["//evil.example", "/\\evil.example", "/a b", "javascript:alert(1)", "data:text/html,x", "", null]) {
      assert.equal(linkHref(bad), null, String(bad));
    }
    assert.deepEqual(opens("/page-2"), {});
    assert.equal(opens("https://example.com").target, "_blank");
    assert.equal(opens("/api/uploads/x.webp").target, "_blank");
  });
});

describe("pages: changing an address", () => {
  it("retargetLinks points link fields at the new address and leaves everything else", async () => {
    const { retargetLinks } = await import("@/lib/pages");
    const config = site({ "": ["/page-2?tab=x", "https://my.site/page-2#top", "page-2", "/page-22", "https://other.site/page-2"] });
    const next = retargetLinks(config, "page-2", "two", ["my.site"]);
    const urls = (next.tabs[0].sections[0] as unknown as { items: { url: string; label: string }[] }).items;
    assert.deepEqual(urls.map((i) => i.url), ["/two?tab=x", "https://my.site/two#top", "two", "/page-22", "https://other.site/page-2"]);
    assert.equal(urls[0].label, "/page-2?tab=x"); // not a link field
  });
});

describe("pages: own settings", () => {
  it("a page's own groups replace the site's for that page only; the rest follow the site", async () => {
    const { withPageSetting, pageSettings } = await import("@/lib/pages");
    let config = site({});
    config = withPageSetting(config, "p-page-2", "layout", { ...config.layout, site: "linkinbio" });
    config = withPageSetting(config, "", "counters", { viewers: false, visitors: true });
    assert.equal(pageView(config, "p-page-2").layout.site, "linkinbio");
    assert.equal(pageView(config, "p-page-2").counters.viewers, true, "counters still the site's on page 2");
    assert.equal(pageView(config, "p-page-3").layout.site, "tabs");
    assert.equal(pageView(config, "").counters.viewers, false, "the homepage's own counters");
    assert.equal(pageView(config, "").layout.site, "tabs");
    // Back to the site's: the empty settings object goes away entirely.
    config = withPageSetting(config, "p-page-2", "layout", undefined);
    assert.equal(pageSettings(config, "p-page-2"), undefined);
    assert.equal("settings" in config.pages[0], false);
    config = withPageSetting(config, "", "counters", undefined);
    assert.equal("homeSettings" in config, false);
    assert.ok(strictParseConfig(withPageSetting(config, "p-page-3", "effects", config.effects)).config, "valid for saving");
  });

  it("every settings group a page has of its own reaches that page's view", async () => {
    const { PAGE_SETTING_GROUPS } = await import("@/lib/schema/config");
    const { groupValue, withPageSetting } = await import("@/lib/pages");
    for (const group of PAGE_SETTING_GROUPS) {
      // A marker key, so this doesn't depend on what each group holds.
      const own = { ...groupValue(site({}), group), marker: group } as never;
      const view = pageView(withPageSetting(site({}), "p-page-2", group, own), "p-page-2") as unknown as Record<string, { marker?: string } | string>;
      const marker = group === "header" || group === "titleColors" ? view.marker : (view[group] as { marker?: string }).marker;
      assert.equal(marker, group);
    }
  });

  it("an invalid group falls back to the site's instead of dropping the page", () => {
    const res = parseConfig({
      version: 2,
      tabs: [],
      homeSettings: { layout: { site: "nope" } },
      pages: [{ slug: "x", title: "X", settings: { background: { base: { type: "lava" } }, counters: { viewers: false } } }],
    });
    assert.ok(res.config);
    assert.equal(res.config.homeSettings?.layout, undefined);
    assert.equal(res.config.pages.length, 1);
    assert.equal(res.config.pages[0].settings?.background, undefined);
    assert.equal(res.config.pages[0].settings?.counters?.viewers, false);
    assert.equal(res.warnings.length, 2);
  });
});

describe("pages: the showcase's own settings", () => {
  it("the colophon's own background is a gradient the site renders (no stripped keys)", async () => {
    const fs = await import("node:fs");
    const raw = JSON.parse(fs.readFileSync(new URL("../../src/config/homepage.showcase.json", import.meta.url), "utf-8"));
    const config = strictParseConfig(raw).config!;
    const colophon = config.pages.find((p) => p.slug === "about/colophon")!;
    const view = pageView(config, colophon.id);
    assert.equal(view.background.base.type, "gradient");
    assert.deepEqual(view.background.base.gradientLight, raw.pages.find((p: { slug: string }) => p.slug === "about/colophon").settings.background.base.gradientLight);
    assert.equal(pageView(config, "").background.base.type, config.background.base.type, "the homepage keeps the site's");
  });
});

describe("pages: own name, tagline and title colors", () => {
  it("header and titleColors are top-level on the site and nested on a page; pageView merges them", async () => {
    const { groupValue, withPageSetting, withSiteGroup } = await import("@/lib/pages");
    let config = site({});
    config = withSiteGroup(config, "header", { name: "Site", tagline: "Everywhere" });
    config = withPageSetting(config, "p-page-2", "header", { name: "Page two", tagline: "Only here" });
    config = withPageSetting(config, "", "titleColors", { titleGradient: ["#f00", "#00f"], taglineGradient: [] });
    assert.equal(config.name, "Site");
    assert.deepEqual(groupValue(config, "header"), { name: "Site", tagline: "Everywhere" });
    assert.equal(pageView(config, "p-page-2").name, "Page two");
    assert.equal(pageView(config, "p-page-3").name, "Site");
    assert.deepEqual(pageView(config, "").titleGradient, ["#f00", "#00f"]);
    assert.deepEqual(pageView(config, "p-page-2").titleGradient, [], "page 2 keeps the site's colors");
    assert.ok(strictParseConfig(config).config);
  });
});

describe("pages: nested addresses", () => {
  it("moveAddress moves the pages under a page along, and links to all of them follow", async () => {
    const { moveAddress, parentAddress } = await import("@/lib/pages");
    const config = site({ "": ["/about", "/about/colophon?tab=x"], about: ["/about/colophon"] }, ["about", "about/colophon", "aboutus"]);
    const { config: next, moved } = moveAddress(config, "p-about", "info", ["my.site"]);
    assert.deepEqual(moved, [{ from: "about", to: "info" }, { from: "about/colophon", to: "info/colophon" }]);
    assert.deepEqual(next.pages.map((p) => p.slug), ["info", "info/colophon", "aboutus"], "aboutus only shares the prefix: untouched");
    const urls = (slug: string) => siteMap(next).links.filter((l) => l.from === slug).map((l) => l.href);
    assert.deepEqual(urls(""), ["/info", "/info/colophon?tab=x"]);
    assert.deepEqual(urls("info"), ["/info/colophon"]);
    assert.deepEqual(siteMap(next).unreachable.map((p) => p.slug), ["aboutus"], "the moved pages stay reachable");
    assert.equal(parentAddress("info/colophon"), "info");
    assert.equal(parentAddress("info"), "");
  });
});
