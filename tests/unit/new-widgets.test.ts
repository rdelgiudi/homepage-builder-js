import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contrastOn, detectPlatform, resolveSocials, socialHref } from "@/widgets/socials/platforms";
import { upcoming, type Slot } from "@/widgets/schedule/occurrences";
import { formatCount, parseCount } from "@/widgets/stats/count";
import { fromAniList, fromOpenLibrary, parseLetterboxd } from "@/lib/media-sources";
import { excerpt, postDate, toPost } from "@/lib/posts";
import { zonedTimeToMs } from "@/widgets/time";
import { WIDGET_BRANDS, widgetBrand } from "@/widgets/brands";
import { widgetMetas } from "@/widgets/meta";

describe("social links", () => {
  it("accepts http(s) and e-mail addresses only", () => {
    assert.equal(socialHref("https://github.com/me"), "https://github.com/me");
    assert.equal(socialHref("me@example.com"), "mailto:me@example.com");
    assert.equal(socialHref("mailto:me@example.com"), "mailto:me@example.com");
    assert.equal(socialHref("javascript:alert(1)"), null);
    assert.equal(socialHref("github.com/me"), null);
    assert.equal(socialHref(""), null);
  });

  it("recognises platforms from the link", () => {
    assert.equal(detectPlatform("https://www.youtube.com/@me"), "youtube");
    assert.equal(detectPlatform("https://steamcommunity.com/id/me"), "steam");
    assert.equal(detectPlatform("https://me.bandcamp.com/"), "bandcamp");
    assert.equal(detectPlatform("https://twitter.com/me"), "x");
    assert.equal(detectPlatform("https://bsky.app/profile/me.bsky.social"), "bluesky");
    assert.equal(detectPlatform("mailto:me@example.com"), "email");
    // Unknown host with a /@name profile path = a Mastodon server.
    assert.equal(detectPlatform("https://mastodon.social/@me"), "mastodon");
    assert.equal(detectPlatform("https://example.com/blog/feed.xml"), "rss");
    assert.equal(detectPlatform("https://example.com/rss"), "rss");
    assert.equal(detectPlatform("https://example.com/"), "website");
    // A look-alike host is not the platform.
    assert.equal(detectPlatform("https://notgithub.com/me"), "website");
  });

  it("drops invalid links and honours an explicit platform and label", () => {
    const links = resolveSocials([
      { url: "https://github.com/me" },
      { url: "javascript:x", platform: "github" },
      { url: "https://example.com", platform: "itchio", label: "My games" },
    ]);
    assert.deepEqual(
      links.map((l) => [l.key, l.label]),
      [
        ["github", "GitHub"],
        ["itchio", "My games"],
      ]
    );
  });

  it("puts dark icons only on very light brand colours", () => {
    assert.equal(contrastOn("5865F2"), "#ffffff"); // Discord
    assert.equal(contrastOn("FF5E5B"), "#ffffff"); // Ko-fi
    assert.equal(contrastOn("FFDD00"), "#000000"); // Buy Me a Coffee
    assert.equal(contrastOn("53FC18"), "#000000"); // Kick
  });
});

describe("schedule", () => {
  const tz = "Europe/Rome";
  // Wednesday 18 Nov 2026, 12:00 in Rome (UTC+1).
  const now = zonedTimeToMs("2026-11-18T12:00", tz)!;
  const slot = (s: Partial<Slot>): Slot => ({ days: [], time: "20:00", duration: 120, label: "x", ...s });

  it("lists each day's next occurrence, soonest first", () => {
    const list = upcoming([slot({ days: ["tue", "thu"] })], tz, now);
    assert.equal(list.length, 2);
    assert.equal(list[0].start, zonedTimeToMs("2026-11-19T20:00", tz)); // Thursday
    assert.equal(list[1].start, zonedTimeToMs("2026-11-24T20:00", tz)); // next Tuesday
  });

  it("keeps a running slot (live) and wraps today's past one to next week", () => {
    const live = upcoming([slot({ days: ["wed"], time: "11:00" })], tz, now);
    assert.equal(live.length, 1);
    assert.equal(live[0].live, true);
    const past = upcoming([slot({ days: ["wed"], time: "09:00", duration: 60 })], tz, now);
    assert.equal(past[0].live, false);
    assert.equal(past[0].start, zonedTimeToMs("2026-11-25T09:00", tz));
  });

  it("catches a slot that started yesterday and runs past midnight", () => {
    const at = zonedTimeToMs("2026-11-19T00:30", tz)!; // Thursday 00:30
    const list = upcoming([slot({ days: ["wed"], time: "23:00", duration: 120 })], tz, at);
    assert.equal(list[0].live, true);
    assert.equal(list[0].start, zonedTimeToMs("2026-11-18T23:00", tz));
  });

  it("skips invalid times and zones", () => {
    assert.deepEqual(upcoming([slot({ days: ["mon"], time: "25:00" })], tz, now), []);
    assert.deepEqual(upcoming([slot({ days: ["mon"] })], "Not/AZone", now), []);
  });
});

describe("stats count-up", () => {
  it("splits values and formats them the way they were typed", () => {
    const thousands = parseCount("2,400 h")!;
    assert.equal(thousands.target, 2400);
    assert.equal(formatCount(thousands, 1234.4), "1,234 h");
    assert.equal(formatCount(thousands, 2400), "2,400 h");

    const european = parseCount("2.400")!;
    assert.equal(european.target, 2400);
    assert.equal(formatCount(european, 2400), "2.400");

    const decimal = parseCount("$1.5k")!;
    assert.equal(decimal.target, 1.5);
    assert.equal(formatCount(decimal, 0.75), "$0.8k");

    assert.equal(formatCount(parseCount("98%")!, 50), "50%");
    assert.equal(formatCount(parseCount("#1")!, 1), "#1");
    assert.equal(parseCount("lots"), null);
  });
});

describe("media log", () => {
  it("reads Letterboxd diary entries and skips lists", () => {
    const items = parseLetterboxd(`<rss><channel>
      <item><title>Dune, 2021 - ★★★★½</title><link>https://letterboxd.com/me/film/dune/</link>
        <letterboxd:watchedDate>2026-11-17</letterboxd:watchedDate><letterboxd:rewatch>Yes</letterboxd:rewatch>
        <letterboxd:filmTitle>Dune &amp; Co</letterboxd:filmTitle><letterboxd:filmYear>2021</letterboxd:filmYear>
        <letterboxd:memberRating>4.5</letterboxd:memberRating>
        <description><![CDATA[ <p><img src="https://a.ltrbxd.com/poster.jpg?v=1"/></p> ]]></description></item>
      <item><title>A list</title><link>https://letterboxd.com/me/list/x/</link><description>list</description></item>
      <item><letterboxd:filmTitle>Unrated</letterboxd:filmTitle><link>javascript:x</link></item>
    </channel></rss>`);
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], {
      title: "Dune & Co",
      subtitle: "2021 · Rewatch",
      image: "https://a.ltrbxd.com/poster.jpg?v=1",
      url: "https://letterboxd.com/me/film/dune/",
      rating: 4.5,
      date: "2026-11-17",
    });
    assert.equal(items[1].rating, null);
    assert.equal(items[1].url, null);
  });

  it("maps AniList entries with progress for the current list", () => {
    const entries = [
      { progress: 5, score: 0, updatedAt: 1763000000, media: { title: { userPreferred: "Frieren" }, coverImage: { large: "https://s4.anilist.co/c.jpg" }, siteUrl: "https://anilist.co/anime/1", episodes: 28, format: "TV", startDate: { year: 2023 } } },
      { media: { title: { userPreferred: "" } } },
    ];
    const current = fromAniList(entries, "anime", "current");
    assert.equal(current.length, 1);
    assert.equal(current[0].subtitle, "Ep 5 / 28");
    assert.equal(current[0].rating, null);
    assert.equal(fromAniList([{ ...entries[0], score: 4 }], "anime", "finished")[0].subtitle, "TV · 2023");
    assert.equal(fromAniList([{ ...entries[0], score: 4 }], "anime", "finished")[0].rating, 4);
  });

  it("maps Open Library reading-log entries", () => {
    const [book] = fromOpenLibrary([
      { work: { title: "Atomic Habits", key: "/works/OL17930368W", author_names: ["James Clear"], cover_id: 12539702 }, logged_date: "2025/08/19, 18:48:06" },
      { work: { title: "Bad key", key: "/../../evil" } },
    ]);
    assert.deepEqual(book, {
      title: "Atomic Habits",
      subtitle: "James Clear",
      image: "https://covers.openlibrary.org/b/id/12539702-M.jpg",
      url: "https://openlibrary.org/works/OL17930368W",
      rating: null,
      date: "2025-08-19",
    });
    assert.equal(fromOpenLibrary([{ work: { title: "Bad key", key: "/../../evil" } }])[0].url, null);
  });
});

describe("blog posts", () => {
  it("reads dates from YAML dates and strings", () => {
    assert.equal(postDate(new Date("2026-11-18T00:00:00Z")), "2026-11-18");
    assert.equal(postDate("2026-11-18"), "2026-11-18");
    assert.equal(postDate("yesterday"), null);
    assert.equal(postDate(undefined), null);
  });

  it("only treats dated, non-draft files as posts", () => {
    assert.equal(toPost("about", { title: "About" }, "text"), null);
    assert.equal(toPost("wip", { date: "2026-11-18", draft: true }, "text"), null);
    const post = toPost("hello-world", { date: "2026-11-18", tags: ["meta", 3, " "] }, "word ".repeat(500))!;
    assert.equal(post.title, "hello world");
    assert.deepEqual(post.tags, ["meta"]);
    assert.equal(post.minutes, 2);
    assert.equal(post.author, undefined);
    assert.equal(toPost("guest", { date: "2026-11-18", author: "  Jane Doe " }, "text")!.author, "Jane Doe");
    assert.equal(toPost("blank", { date: "2026-11-18", author: " " }, "text")!.author, undefined);
  });

  it("builds a plain-text excerpt", () => {
    assert.equal(excerpt("# Title\n\nSome **bold** [link](https://x.y) e-mail text.\n\n- item\n\n```js\ncode()\n```"), "Some bold link e-mail text. item");
    const long = excerpt("word ".repeat(100), 30);
    assert.ok(long.endsWith("…") && long.length <= 31, long);
  });
});

describe("widget brand logos", () => {
  it("maps only real widget types, each to a logo", () => {
    const types = new Set(widgetMetas.map((m) => m.type));
    for (const type of Object.keys(WIDGET_BRANDS)) {
      assert.ok(types.has(type), type);
      assert.ok(widgetBrand(type)?.path, type);
    }
  });

  it("keeps brand colours, but near-black logos follow the text colour", () => {
    assert.equal(widgetBrand("twitch")?.color, "#9146FF");
    assert.equal(widgetBrand("steam")?.color, "currentColor");
    assert.equal(widgetBrand("github")?.color, "currentColor");
    // Several services or no logo: the emoji stays.
    for (const type of ["chess", "music", "media", "overwatch", "speedrun", "weather", "embed"]) assert.equal(widgetBrand(type), null, type);
  });
});
