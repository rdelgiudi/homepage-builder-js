import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { acceptedLanguage, contentCandidates, contentLanguages, contentPlace, isOriginal, languageChoices, pickLanguage } from "@/lib/i18n/languages";
import { carryTranslations, collectTexts, entryOf, localize, translationStatus, widgetNodes, withEntry } from "@/lib/i18n/texts";
import { suggestTranslations } from "@/lib/i18n/suggest";
import { parseConfig, strictParseConfig } from "@/lib/schema/parse";
import { tabSlug } from "@/lib/tab-slug";
import { HOME, pageView, siteMap, translationLinks } from "@/lib/pages";
import { ConfigSchema, type HomepageConfig } from "@/lib/schema/config";

const make = (texts: Record<string, string> = {}, extra: object = {}): HomepageConfig => {
  const res = strictParseConfig({
    version: 2,
    name: "My site",
    tagline: "Welcome all",
    tabs: [
      {
        id: "home",
        label: "Home",
        sections: [
          { id: "l", type: "links", text: "Find me", items: [{ label: "Shop", url: "https://shop.example" }, { label: "Music", url: "/music" }] },
          { id: "p", type: "poll", question: "Which one?", options: ["Red", "Blue"] },
          { id: "s", type: "stats", items: [{ value: "98%", label: "done" }] },
        ],
      },
      { id: "more", label: "More stuff", sections: [{ id: "t", type: "text", content: "Shop" }] },
    ],
    pages: [{ id: "pg", slug: "about", title: "About", settings: { header: { name: "Other name", tagline: "Welcome all" } }, tabs: [] }],
    languages: { translations: [{ code: "it", texts }] },
    ...extra,
  });
  assert.ok(res.config, JSON.stringify(res.issues));
  return res.config;
};
const links = (c: HomepageConfig) => (c.tabs[0].sections[0] as { items: { label: string; url: string }[] }).items;

describe("languages: which text is translated", () => {
  it("every text of the site is found, and nothing that isn't text", () => {
    const texts = collectTexts(make()).map((u) => u.text);
    assert.deepEqual(texts, ["My site", "Welcome all", "Home", "Find me", "Shop", "Music", "Which one?", "Red", "Blue", "done", "More stuff", "Shop", "About", "Other name", "Welcome all"]);
  });

  it("no address, name of an account, file, time zone or the like is marked as text", () => {
    const bad = /^(id|type|url|link|linkUrl|href|src|source|image|avatar|icon|file|timezone|target|until|time|address|username|handle|account|instance|channel|owner|repo|appid|tag|ring(Home|Prev|Next|Random)|.*[cC]olors?|hideGames|games|emojis)$/;
    interface N { type?: string; enum?: unknown; translate?: unknown; ui?: string; properties?: Record<string, N>; items?: N }
    const marked: string[] = [];
    const walk = (n: N, at: string) => {
      for (const [k, c] of Object.entries(n.properties ?? {})) {
        if (c.translate) {
          marked.push(`${at}.${k}`);
          assert.ok(!bad.test(k), `${at}.${k} must not be translated`);
          assert.ok(!c.enum && !c.items?.enum, `${at}.${k} is a fixed choice`);
          assert.ok(!["color", "gradient", "image", "icon", "content-file", "timezone", "date", "datetime", "time"].includes(c.ui ?? ""), `${at}.${k} (${c.ui})`);
        }
        walk(c, `${at}.${k}`);
        if (c.items) walk(c.items, `${at}.${k}[]`);
      }
    };
    for (const [type, node] of widgetNodes) walk(node as N, type);
    assert.ok(marked.length > 60, `${marked.length} fields`);
  });

  it("every plain string field of every widget is either text or known not to be", () => {
    // A new widget's text must be marked (`translate: true` in its meta), or its field named here.
    const notText = new Set(["id", "type", "url", "linkUrl", "link", "src", "source", "image", "avatar", "icon", "file", "timezone", "target", "until", "updated", "time", "address", "username", "handle", "account", "instance", "channel", "owner", "repo", "appid", "tag", "ringHome", "ringPrev", "ringNext", "ringRandom", "progressColors", "hideGames", "games", "emojis"]);
    interface N { type?: string; enum?: unknown; const?: unknown; translate?: unknown; properties?: Record<string, N>; items?: N; anyOf?: unknown }
    const missing: string[] = [];
    const walk = (n: N, at: string) => {
      for (const [k, c] of Object.entries(n.properties ?? {})) {
        const text = (c.type === "string" && !c.enum && c.const === undefined) || (c.type === "array" && c.items?.type === "string" && !c.items.enum);
        // A game's title is a name, the same in every language.
        if (text && !c.translate && !notText.has(k) && `${at}.${k}` !== "game-shelf.items[].title") missing.push(`${at}.${k}`);
        walk(c, `${at}.${k}`);
        if (c.items) walk(c.items, `${at}.${k}[]`);
      }
    };
    for (const [type, node] of widgetNodes) walk(node as N, type);
    assert.deepEqual(missing, []);
  });
});

describe("languages: localize", () => {
  const it_ = { "My site": "Il mio sito", "Welcome all": "Benvenuti", Home: "Inizio", Shop: "Negozio", Red: "Rosso", "More stuff": "Altro", About: "Chi sono" };

  it("applies translations everywhere the text is used and leaves the rest in the original", () => {
    const c = localize(make(it_), "it");
    assert.equal(c.name, "Il mio sito");
    assert.equal(c.tabs[0].label, "Inizio");
    assert.deepEqual(links(c).map((i) => [i.label, i.url]), [["Negozio", "https://shop.example"], ["Music", "/music"]]);
    assert.equal((c.tabs[1].sections[0] as { content: string }).content, "Negozio");
    const about = pageView(c, "pg");
    assert.equal(about.tagline, "Benvenuti", "a page's own header too");
    assert.equal(about.name, "Other name");
    assert.equal(c.pages[0].title, "Chi sono");
    assert.equal(c.pages[0].slug, "about");
  });

  it("the original and unknown languages change nothing", () => {
    const c = make(it_);
    assert.equal(localize(c, "en"), c);
    assert.equal(localize(c, "fr"), c);
  });

  it("a tab keeps its address in every language", () => {
    const c = make(it_);
    const t = localize(c, "it");
    assert.deepEqual(t.tabs.map((x) => tabSlug(x)), c.tabs.map((x) => tabSlug(x)));
    assert.deepEqual(pageView(t, HOME).tabs.map((x) => tabSlug(x)), ["home", "more-stuff"]);
  });

  it("poll options keep their original text (votes are stored by it) and get labels beside it", () => {
    const poll = localize(make(it_), "it").tabs[0].sections[1] as { options: string[]; optionsLabels?: string[] };
    assert.deepEqual(poll.options, ["Red", "Blue"]);
    assert.deepEqual(poll.optionsLabels, ["Rosso", "Blue"]);
  });

  it("a notice keeps its original text (dismissals are remembered by it) beside the translation", () => {
    const c = make({ "Back soon": "Torno presto" }, { tabs: [{ id: "h", label: "H", sections: [{ id: "n", type: "notice", message: "Back soon" }] }] });
    const notice = localize(c, "it").tabs[0].sections[0] as unknown as { message: string; messageLabels?: string };
    assert.equal(notice.message, "Back soon");
    assert.equal(notice.messageLabels, "Torno presto");
  });

  it("an empty translation, or a text named like an Object member, falls back to the original", () => {
    const c = localize(make({ Home: "  " }, { name: "constructor" }), "it");
    assert.equal(c.tabs[0].label, "Home");
    assert.equal(c.name, "constructor");
  });
});

describe("languages: the same text in two places", () => {
  const t = (c: HomepageConfig) => c.languages.translations[0];
  const shopLink = "section:l.items.label";
  const shopText = "section:t.content";

  it("is two decisions: translating one leaves the other alone", () => {
    const c = make();
    const done = { ...c, languages: { ...c.languages, translations: [withEntry(t(c), shopLink, "Shop", { to: "Negozio" })] } };
    const it_ = localize(done, "it");
    assert.equal(links(it_)[0].label, "Negozio");
    assert.equal((it_.tabs[1].sections[0] as { content: string }).content, "Shop");
    const rows = translationStatus(done, t(done)).rows.filter((x) => x.use.text === "Shop");
    assert.deepEqual(rows.map((x) => [x.use.place, x.state]), [[shopLink, "done"], [shopText, "missing"]]);
  });

  it("what was decided elsewhere is offered, never applied", () => {
    const c = make();
    const one = withEntry(t(c), shopLink, "Shop", { to: "Negozio" });
    assert.deepEqual(suggestTranslations(one, shopText, "Shop"), [{ text: "Negozio", from: "Shop", place: shopLink }]);
    assert.deepEqual(suggestTranslations(one, shopLink, "Shop"), [], "not to itself");
    const two = withEntry(one, "section:x.text", "Shop", { to: "Bottega" });
    assert.deepEqual(suggestTranslations(two, shopText, "Shop").map((x) => x.text), ["Negozio", "Bottega"], "every meaning");
    const same = withEntry(t(c), shopLink, "Shop", { same: true });
    assert.deepEqual(suggestTranslations(same, shopText, "Shop").map((x) => x.text), [null], "doesn't translate elsewhere");
  });

  it("positions in a list don't matter, and texts that must match share their place", () => {
    const uses = collectTexts(make());
    assert.deepEqual(uses.filter((u) => ["Shop", "Music"].includes(u.text) && u.sectionId === "l").map((u) => u.place), [shopLink, shopLink]);
    const shelf = make({}, { tabs: [{ id: "g", label: "G", sections: [{ id: "gs", type: "game-shelf", groupBy: "custom", groupOrder: ["Favourites"], items: [{ title: "X", group: "Favourites" }] }] }] });
    assert.equal(new Set(collectTexts(shelf).filter((u) => u.text === "Favourites").map((u) => u.place)).size, 1, "a group and the order it is in");
  });
});

describe("languages: translations written without a place", () => {
  const raw = (translation: object) => ({ version: 2, name: "Home", tagline: "x", tabs: [{ id: "h", label: "Home", sections: [{ id: "t", type: "text", content: "Home" }] }], languages: { translations: [{ code: "it", ...translation }] } });

  it("are for every place that has the text now", () => {
    const c = parseConfig(raw({ texts: { Home: "Inizio" } })).config!;
    assert.deepEqual(c.languages.translations[0].texts, {
      "site.name": { Home: { to: "Inizio" } },
      "tab:h.label": { Home: { to: "Inizio" } },
      "section:t.content": { Home: { to: "Inizio" } },
    });
    assert.deepEqual(parseConfig(c).config!.languages, c.languages, "stable once expanded");
  });

  it("a decision of its own wins, and the older lists of texts are understood", () => {
    const c = parseConfig(raw({ texts: { Home: "Inizio", "tab:h.label": { Home: { to: "Casa" } } }, same: ["Home"], check: ["Home"] })).config!;
    const { texts } = c.languages.translations[0];
    assert.deepEqual(texts["tab:h.label"].Home, { to: "Casa" });
    assert.deepEqual(texts["site.name"].Home, { to: "Inizio", same: true, check: true });
    assert.equal("same" in c.languages.translations[0], false);
  });

  it("one whose text is nowhere isn't lost, and isn't given to a text that appears later", () => {
    const c = parseConfig(raw({ texts: { Gone: "Andato" } })).config!;
    assert.deepEqual(translationStatus(c, c.languages.translations[0]).stale.map((x) => [x.text, x.to]), [["Gone", "Andato"]]);
    const later = parseConfig({ ...c, tagline: "Gone" }).config!;
    assert.equal(localize(later, "it").tagline, "Gone");
    assert.deepEqual(suggestTranslations(later.languages.translations[0], "site.tagline", "Gone").map((x) => x.text), ["Andato"], "only offered");
  });
});

describe("languages: editing the original", () => {
  const texts = { Shop: "Negozio", Music: "Musica", Home: "Inizio" };
  const t = (c: HomepageConfig) => c.languages.translations[0];
  const label = "section:l.items.label";
  const edit = (c: HomepageConfig, fn: (c: HomepageConfig) => void) => {
    const next = structuredClone(c);
    fn(next);
    next.languages = c.languages; // as the editor does: only what was edited is a new object
    return carryTranslations(c, next);
  };

  it("a translation follows its text, letter by letter, and is marked to check", () => {
    let c = make(texts);
    for (const name of ["Homes", "Homest", "Homestead"]) c = edit(c, (n) => void (n.tabs[0].label = name));
    assert.deepEqual(t(c).texts["tab:home.label"], { Homestead: { to: "Inizio", check: true } });
    assert.equal(localize(c, "it").tabs[0].label, "Inizio");
  });

  it("reordering, deleting and adding list items never attach a translation to another text", () => {
    const c = make(texts);
    const swapped = edit(c, (n) => void links(n).reverse());
    assert.deepEqual(t(swapped).texts, t(c).texts);
    assert.deepEqual(links(localize(swapped, "it")).map((i) => i.label), ["Musica", "Negozio"]);
    assert.deepEqual(t(edit(c, (n) => void links(n).shift())).texts, t(c).texts);
    assert.deepEqual(t(edit(c, (n) => void links(n).unshift({ label: "New", url: "/" }))).texts, t(c).texts);
  });

  it("only the place that was edited changes", () => {
    const c = edit(make(texts), (n) => void (links(n)[0].label = "Store"));
    assert.deepEqual(t(c).texts[label], { Music: { to: "Musica" }, Store: { to: "Negozio", check: true } });
    assert.deepEqual(t(c).texts["section:t.content"], { Shop: { to: "Negozio" } });
  });

  it("never overwrites a decision the new text already has", () => {
    const c = make(texts);
    const start = { ...c, languages: { ...c.languages, translations: [withEntry(t(c), "tab:home.label", "Start", { to: "Partenza" })] } };
    assert.deepEqual(entryOf(t(edit(start, (n) => void (n.tabs[0].label = "Start"))), "tab:home.label", "Start"), { to: "Partenza" });
  });

  it("moving a widget to another tab keeps its translations", () => {
    const c = make(texts);
    const moved = edit(c, (n) => void n.tabs[1].sections.push(...n.tabs[0].sections.splice(0, 1)));
    assert.deepEqual(t(moved).texts, t(c).texts);
    assert.equal((localize(moved, "it").tabs[1].sections[1] as { items: { label: string }[] }).items[0].label, "Negozio");
  });
});

describe("languages: names and texts that don't translate", () => {
  const status = (texts: Record<string, string>, same: string[] = [], check: string[] = []) => {
    const c = strictParseConfig({ ...make(), languages: { translations: [{ code: "it", texts, same, check }] } }).config!;
    const s = translationStatus(c, c.languages.translations[0]);
    return { ...s, texts: (state: string) => s.rows.filter((x) => x.state === state).map((x) => x.use.text) };
  };

  it("a name isn't missing, but waits to be confirmed or translated", () => {
    const s = status({});
    assert.deepEqual([s.total, s.decided, s.count.missing], [15, 0, 13]);
    assert.deepEqual(s.texts("name"), ["My site", "Other name"]);
    assert.deepEqual(status({}, ["My site"]).texts("name"), ["Other name"]);
    assert.deepEqual(status({ "My site": "Il mio sito" }).texts("name"), ["Other name"]);
  });

  it("any text can be confirmed; it then counts as done and is shown in the original", () => {
    const s = status({}, ["Music", "My site", "not on the site"]);
    assert.deepEqual([s.decided, s.count.missing, s.texts("done")], [2, 12, ["My site", "Music"]]);
    const c = make();
    c.languages.translations[0] = withEntry(c.languages.translations[0], "section:l.items.label", "Shop", { same: true });
    assert.equal(links(localize(c, "it"))[0].label, "Shop");
  });

  it("every text is missing, to check, or done", () => {
    const s = status({ Find: "x", Music: "Musica", Home: "Inizio" }, ["My site", "done"], ["Home", "done", "Red"]);
    assert.deepEqual(s.texts("done"), ["My site", "Music"]);
    assert.deepEqual(s.texts("edited"), ["Home", "done"], "Red was never translated: it is missing, not to check");
    assert.equal(s.count.done + s.count.edited + s.count.name + s.count.missing, s.total);
  });

  it("a confirmed text that is edited stays confirmed, but is marked to check", () => {
    const c = make();
    c.languages.translations[0] = withEntry(c.languages.translations[0], "site.name", "My site", { same: true });
    const next = carryTranslations(c, { ...c, name: "My new site" });
    assert.deepEqual(next.languages.translations[0].texts, { "site.name": { "My new site": { same: true, check: true } } });
  });

  it("an undecided text leaves nothing behind", () => {
    const t = make().languages.translations[0];
    assert.deepEqual(withEntry(withEntry(t, "a", "b", { to: "c" }), "a", "b", undefined).texts, {});
    assert.deepEqual(withEntry(t, "a", "constructor", { to: "c" }).texts.a.constructor as unknown, { to: "c" });
    assert.equal(entryOf(t, "constructor", "name"), undefined);
  });
});

describe("languages: suggestions from nearly identical texts", () => {
  const place = "section:a.text";
  const t = {
    code: "it",
    enabled: true,
    texts: { [place]: Object.fromEntries(Object.entries({ Home: "Inizio", "Find me here": "Mi trovi qui", "What?": "¿Qué?", "NEW POSTS": "NUOVI ARTICOLI", "my games": "i miei giochi", Empty: " " }).map(([k, to]) => [k, { to }])) },
  };
  const suggest = (text: string) => suggestTranslations(t, place, text)[0]?.text ?? null;

  it("differing in case, spacing, or the characters around", () => {
    assert.equal(suggest("HOME"), "INIZIO");
    assert.equal(suggest("home"), "inizio");
    assert.equal(suggest("Home:"), "Inizio:");
    assert.equal(suggest("🏠 Home"), "🏠 Inizio");
    assert.equal(suggest("Find  me here!"), "Mi trovi qui!");
    assert.equal(suggest("My games"), "I miei giochi");
    assert.equal(suggest("New posts"), "Nuovi articoli");
    assert.equal(suggest("WHAT?"), "¿QUÉ?");
    assert.equal(suggestTranslations(t, place, "Home:")[0].from, "Home");
  });

  it("nothing for the text itself, other texts, or one without words", () => {
    for (const text of ["Home", "Homepage", "Find me", "Empty!", "!!!", "constructor"]) assert.equal(suggest(text), null, text);
  });
});

describe("languages: which one a visitor gets", () => {
  const langs = ["en", "it", "pt-BR"];
  it("address, then earlier choice, then browser, then the original", () => {
    assert.equal(pickLanguage(langs, "en", { query: "IT", cookie: "en" }), "it");
    assert.equal(pickLanguage(langs, "en", { query: "xx", cookie: "it" }), "it");
    assert.equal(pickLanguage(langs, "en", { cookie: "en", accept: "it" }), "en", "choosing the original sticks");
    assert.equal(pickLanguage(langs, "en", { accept: "de, it;q=0.5" }), "it");
    assert.equal(pickLanguage(langs, "en", { accept: "de" }), "en");
    assert.equal(pickLanguage(langs, "en", {}), "en");
  });

  it("reads Accept-Language by preference and by language, not only exact tags", () => {
    assert.equal(acceptedLanguage("fr;q=0.2, it-IT;q=0.9, en;q=0.8", langs), "it");
    assert.equal(acceptedLanguage("pt-PT", langs), "pt-BR");
    assert.equal(acceptedLanguage("it;q=0, en", langs), "en");
    assert.equal(acceptedLanguage("*", langs), null);
    assert.equal(acceptedLanguage("", langs), null);
  });

  it("names languages in themselves and tells variants apart", () => {
    assert.deepEqual(languageChoices(["en", "it"]).map((c) => [c.name, c.short]), [["English", "EN"], ["Italiano", "IT"]]);
    assert.deepEqual(languageChoices(["pt", "pt-BR"]).map((c) => c.short), ["PT", "BR"]);
  });
});

describe("languages: markdown files", () => {
  const one = { original: "en", codes: [] };
  const two = { original: "en", codes: ["it"] };

  it("a file's name doesn't have its language folder", () => {
    const files = new Set(["en/blog/hello.md", "it/blog/hello.md", "loose.md", "notes/x.md"]);
    assert.deepEqual(contentPlace("en/blog/hello.md", two, files), { name: "blog/hello.md", code: "en" });
    assert.deepEqual(contentPlace("it/blog/hello.md", two, files), { name: "blog/hello.md", code: "it" });
    assert.deepEqual(contentPlace("loose.md", two, files), { name: "loose.md", code: null });
    assert.deepEqual(contentPlace("notes/x.md", two, files), { name: "notes/x.md", code: null });
  });

  it("a folder of a language the site doesn't have is only one for files with an original", () => {
    const files = new Set(["about.md", "it/about.md", "it/printer-setup.md"]);
    assert.equal(contentPlace("it/about.md", one, files).code, "it", "a translation, not published yet");
    assert.equal(contentPlace("it/printer-setup.md", one, files).code, null, "the folder is just called it");
  });

  it("looks for the translation, then the original in its folder, then a file that was never moved", () => {
    assert.deepEqual(contentCandidates("about.md", two, "it"), ["it/about.md", "en/about.md", "about.md"]);
    assert.deepEqual(contentCandidates("about.md", two), ["en/about.md", "about.md", "it/about.md"], "better another language than nothing");
    assert.deepEqual(contentCandidates("about.md", two, "en"), ["en/about.md", "about.md", "it/about.md"]);
    assert.deepEqual(contentCandidates("about.md", two, "../x"), ["en/about.md", "about.md", "it/about.md"]);
    assert.deepEqual(contentCandidates("about.md", one), ["about.md", "en/about.md"], "in one language, the plain name wins");
    assert.deepEqual(contentCandidates("en/about.md", two, "it"), ["it/about.md", "en/about.md", "about.md"], "written with its folder");
  });

  it("while a draft changes the main language, the published one's folder still counts", () => {
    const l = { original: "de", translations: [{ code: "it" }] };
    const changed = contentLanguages(l, "en");
    assert.equal(changed.previous, "en");
    assert.deepEqual(contentCandidates("about.md", changed), ["de/about.md", "en/about.md", "about.md", "it/about.md"]);
    assert.equal(isOriginal(contentPlace("en/about.md", changed, new Set(["en/about.md"])), changed), true);
    assert.equal(contentLanguages(l, "de").previous, undefined, "not changed");
    assert.equal(contentLanguages(l, "it").previous, undefined, "swapped: it is a translation now");
  });
});

describe("languages: links are checked per language", () => {
  const site = (file: string) => parseConfig({ version: 2, tabs: [{ id: "h", label: "H", sections: [{ id: "m", type: "markdown", file }] }], pages: [{ id: "p", slug: "second", title: "Second", tabs: [] }] }).config!;

  it("a translation that lacks a link, or has a broken one, is reported for that language only", () => {
    const c = site("about.md");
    const original = siteMap(c, { "about.md": ["/second"] });
    assert.deepEqual(original.unreachable, []);
    const it_ = translationLinks(original, siteMap(c, { "about.md": ["/nope"] }), "it", new Set(["about.md"]));
    assert.deepEqual(it_.unreachable.map((p) => p.slug), ["second"]);
    assert.deepEqual(it_.broken.map((l) => [l.href, l.file, l.lang]), [["/nope", "about.md", "it"]]);
  });

  it("the original's own problems aren't repeated for every language", () => {
    const c = site("about.md");
    const map = siteMap(c, { "about.md": ["/nope"] });
    const same = translationLinks(map, map, "it", new Set());
    assert.deepEqual([same.unreachable, same.broken], [[], []]);
  });
});

describe("languages: config", () => {
  it("defaults to one language with nothing to pick", () => {
    assert.deepEqual(ConfigSchema.parse({ version: 2 }).languages, { original: "en", detect: true, translations: [] });
  });

  it("one bad language never takes the site down; saving refuses it", () => {
    const raw = { version: 2, tabs: [], languages: { translations: [{ code: "Italian!" }, { code: "it", texts: { a: "b" } }, { code: "it" }, { code: "en" }] } };
    const res = parseConfig(raw);
    assert.deepEqual(res.config?.languages.translations.map((t) => t.code), ["it"]);
    assert.equal(res.warnings.length, 3);
    assert.ok(parseConfig({ version: 2, tabs: [], languages: { original: 5 } }).config);
    assert.equal(strictParseConfig({ version: 2, tabs: [], languages: { translations: [{ code: "it" }, { code: "it" }] } }).config, null);
    assert.equal(strictParseConfig({ version: 2, tabs: [], languages: { original: "it", translations: [{ code: "it" }] } }).config, null);
  });
});
