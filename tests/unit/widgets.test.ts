import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lastFmTrack, listenBrainzTrack, parseContributions, parseFeed, parseYouTubeFeed, serviceState } from "@/lib/widget-sources";
import { supportUrl } from "@/widgets/support/platforms";
import { cleanText, isEmail } from "@/lib/messages";
import { zonedTimeToMs, zoneOffsetMinutes } from "@/widgets/time";
import { initialStatus } from "@/lib/comments";
import { backgroundLayer } from "@/lib/background";
import { BackgroundBaseSchema } from "@/lib/schema/config";

describe("feed parsing", () => {
  it("reads RSS items, including CDATA and entities", () => {
    const feed = parseFeed(`<?xml version="1.0"?><rss><channel><title>My &amp; Blog</title>
      <item><title><![CDATA[First <post>]]></title><link>https://example.com/1?a=1&amp;b=2</link><pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate></item>
      <item><title>No date</title><link>https://example.com/2</link></item>
      <item><title>Unsafe</title><link>javascript:alert(1)</link></item>
      <item><title></title><link>https://example.com/untitled</link></item>
    </channel></rss>`)!;
    assert.equal(feed.title, "My & Blog");
    assert.deepEqual(feed.items, [
      { title: "First <post>", url: "https://example.com/1?a=1&b=2", date: "2026-11-10T10:00:00.000Z" },
      { title: "No date", url: "https://example.com/2", date: null },
    ]);
  });

  it("reads Atom entries and prefers the alternate link", () => {
    const feed = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Site</title>
      <entry><title>Entry</title><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/entry"/><updated>2026-11-01T08:00:00Z</updated></entry>
    </feed>`)!;
    assert.equal(feed.title, "Atom Site");
    assert.deepEqual(feed.items, [{ title: "Entry", url: "https://example.com/entry", date: "2026-11-01T08:00:00.000Z" }]);
  });

  it("returns null for something that is not a feed", () => {
    assert.equal(parseFeed("<html><body>Hello</body></html>"), null);
  });
});

describe("GitHub contributions calendar", () => {
  // The shape of github.com/users/<name>/contributions (cells, then their tooltips).
  const html = `
    <td data-date="2026-01-02" id="contribution-day-component-1-0" data-level="2" class="ContributionCalendar-day"></td>
    <td data-date="2026-01-01" id="contribution-day-component-0-0" data-level="0" class="ContributionCalendar-day"></td>
    <td data-date="2026-01-03" id="contribution-day-component-2-0" data-level="4" class="ContributionCalendar-day"></td>
    <tool-tip for="contribution-day-component-0-0" popover="manual">No contributions on January 1st.</tool-tip>
    <tool-tip for="contribution-day-component-1-0" popover="manual">5 contributions on January 2nd.</tool-tip>
    <tool-tip for="contribution-day-component-2-0" popover="manual">1 contribution on January 3rd.</tool-tip>`;

  it("pairs each day with its count and sorts by date", () => {
    assert.deepEqual(parseContributions(html), [
      { date: "2026-01-01", level: 0, count: 0 },
      { date: "2026-01-02", level: 2, count: 5 },
      { date: "2026-01-03", level: 4, count: 1 },
    ]);
  });

  it("returns nothing when the markup is not there", () => {
    assert.deepEqual(parseContributions("<div>Not found</div>"), []);
  });
});

describe("time zones (clock and countdown)", () => {
  const at = (local: string, zone: string) => new Date(zonedTimeToMs(local, zone)!).toISOString();

  it("converts ordinary wall times", () => {
    assert.equal(at("2027-01-01T00:00", "Europe/Rome"), "2026-12-31T23:00:00.000Z");
    assert.equal(at("2026-07-01T12:00", "Europe/Rome"), "2026-07-01T10:00:00.000Z");
    assert.equal(at("2026-07-01T12:00", "Asia/Kolkata"), "2026-07-01T06:30:00.000Z");
    assert.equal(at("2026-07-01T12:00", "UTC"), "2026-07-01T12:00:00.000Z");
  });

  it("moves a skipped time forward past the clock change, in either hemisphere's direction", () => {
    // 02:30 doesn't exist on these days; both resolve to 03:30 local.
    assert.equal(at("2026-03-29T02:30", "Europe/Rome"), "2026-03-29T01:30:00.000Z");
    assert.equal(at("2026-03-08T02:30", "America/New_York"), "2026-03-08T07:30:00.000Z");
  });

  it("picks the earlier of a time that happens twice", () => {
    assert.equal(at("2026-10-25T02:30", "Europe/Rome"), "2026-10-25T00:30:00.000Z");
    assert.equal(at("2026-11-01T01:30", "America/New_York"), "2026-11-01T05:30:00.000Z");
  });

  it("returns null for an unknown zone or unreadable input", () => {
    assert.equal(zonedTimeToMs("2026-01-01T00:00", "Mars/Base"), null);
    assert.equal(zonedTimeToMs("tomorrow", "UTC"), null);
  });

  it("knows half-hour offsets", () => {
    assert.equal(zoneOffsetMinutes(Date.UTC(2026, 0, 1), "Asia/Kolkata"), 330);
  });
});

describe("comment moderation", () => {
  it("publishes right away unless told otherwise", () => {
    assert.equal(initialStatus("Ann", "Hello", { mode: "off", holdWords: [] }), "approved");
  });

  it("holds everything in approval mode", () => {
    assert.equal(initialStatus("Ann", "Hello", { mode: "pre", holdWords: [] }), "pending");
  });

  it("holds comments with a held word, ignoring case, in the name or the text", () => {
    const settings = { mode: "off" as const, holdWords: ["casino"] };
    assert.equal(initialStatus("Spam", "Best CASINO here", settings), "pending");
    assert.equal(initialStatus("Casino King", "hi", settings), "pending");
    assert.equal(initialStatus("Ann", "Hello", settings), "approved");
  });
});

describe("background layer", () => {
  const layer = (input: Record<string, unknown>) => backgroundLayer(BackgroundBaseSchema.parse(input));

  it("draws nothing extra for a solid colour", () => {
    assert.equal(layer({ type: "solid" }).empty, true);
  });

  it("builds a gradient per colour mode, falling back to the light one", () => {
    const vars = layer({ type: "gradient", gradientLight: ["#111", "#222"], angle: 90 }).vars as Record<string, string>;
    assert.equal(vars["--bg-image-light"], "linear-gradient(90deg, #111, #222)");
    assert.equal(vars["--bg-image-dark"], vars["--bg-image-light"]);
  });

  it("tiles an image when asked", () => {
    const spec = layer({ type: "image", image: "/api/uploads/0123456789abcdef0123.webp", fit: "tile", fixed: false });
    assert.equal((spec.vars as Record<string, string>)["--bg-repeat"], "repeat");
    assert.equal(spec.fixed, false);
  });

  it("uses the poster when a video has no source yet", () => {
    const spec = layer({ type: "video", poster: "https://example.com/p.jpg" });
    assert.equal(spec.video, null);
    assert.equal(spec.empty, false);
  });
});

describe("YouTube feed", () => {
  const xml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
    <title>Chan &amp; Co</title><author><name>Chan &amp; Co</name><uri>https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv</uri></author>
    <entry><id>yt:video:aaaaaaaaaaa</id><yt:videoId>aaaaaaaaaaa</yt:videoId><title>Long video</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=aaaaaaaaaaa"/><published>2026-11-01T10:00:00+00:00</published>
      <media:group><media:community><media:statistics views="12345"/></media:community></media:group></entry>
    <entry><yt:videoId>bbbbbbbbbbb</yt:videoId><title>A short</title><link rel="alternate" href="https://www.youtube.com/shorts/bbbbbbbbbbb"/><published>bad</published></entry>
    <entry><title>No id</title></entry>
  </feed>`;

  it("reads videos, views, dates and marks Shorts", () => {
    const feed = parseYouTubeFeed(xml)!;
    assert.equal(feed.channel, "Chan & Co");
    assert.equal(feed.url, "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv");
    assert.deepEqual(feed.videos, [
      { id: "aaaaaaaaaaa", title: "Long video", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg", date: "2026-11-01T10:00:00.000Z", views: 12345, short: false },
      { id: "bbbbbbbbbbb", title: "A short", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", thumbnail: "https://i.ytimg.com/vi/bbbbbbbbbbb/mqdefault.jpg", date: null, views: null, short: true },
    ]);
  });

  it("returns null for something that is not a feed", () => {
    assert.equal(parseYouTubeFeed("<html></html>"), null);
  });
});

describe("music history", () => {
  it("maps a ListenBrainz listen, with Cover Art Archive art and a MusicBrainz link", () => {
    const track = listenBrainzTrack({
      listened_at: 1_800_000_000,
      track_metadata: {
        artist_name: "Artist",
        track_name: "Song",
        release_name: "Album",
        mbid_mapping: { caa_release_mbid: "11111111-2222-3333-4444-555555555555", recording_mbid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
      },
    });
    assert.equal(track.cover, "https://coverartarchive.org/release/11111111-2222-3333-4444-555555555555/front-250");
    assert.equal(track.url, "https://musicbrainz.org/recording/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.equal(track.date, new Date(1_800_000_000_000).toISOString());
    assert.equal(track.nowPlaying, false);
  });

  it("ignores ids that are not MBIDs and non-http links", () => {
    const track = listenBrainzTrack({ track_metadata: { artist_name: "A", track_name: "T", mbid_mapping: { caa_release_mbid: "../../evil" }, additional_info: { origin_url: "javascript:alert(1)" } } }, true);
    assert.equal(track.cover, null);
    assert.equal(track.url, null);
    assert.equal(track.nowPlaying, true);
  });

  it("maps a Last.fm track and drops the placeholder star image", () => {
    const base = { name: "Song", url: "https://www.last.fm/music/A/_/Song", artist: { "#text": "A" }, album: { "#text": "Al" } };
    const playing = lastFmTrack({ ...base, image: [{ size: "large", "#text": "https://lastfm.freetls.fastly.net/i/u/174s/abc.png" }], "@attr": { nowplaying: "true" } });
    assert.equal(playing.cover, "https://lastfm.freetls.fastly.net/i/u/174s/abc.png");
    assert.equal(playing.nowPlaying, true);
    assert.equal(playing.date, null);
    const placeholder = lastFmTrack({ ...base, image: [{ size: "extralarge", "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png" }], date: { uts: "1800000000" } });
    assert.equal(placeholder.cover, null);
    assert.equal(placeholder.date, new Date(1_800_000_000_000).toISOString());
  });
});

describe("service status", () => {
  it("treats a login wall as up and a server error or no answer as down", () => {
    assert.equal(serviceState(200), "up");
    assert.equal(serviceState(302), "up");
    assert.equal(serviceState(401), "up");
    assert.equal(serviceState(403), "up");
    assert.equal(serviceState(404), "degraded");
    assert.equal(serviceState(503), "down");
    assert.equal(serviceState(null), "down");
  });
});

describe("support links", () => {
  it("builds the link from a fixed host and a validated username", () => {
    assert.equal(supportUrl("kofi", "me_123"), "https://ko-fi.com/me_123");
    assert.equal(supportUrl("github", "@octocat"), "https://github.com/sponsors/octocat");
    assert.equal(supportUrl("github", "https://github.com/sponsors/octocat/"), "https://github.com/sponsors/octocat");
    assert.equal(supportUrl("patreon", "https://www.patreon.com/creator"), "https://www.patreon.com/creator");
  });

  it("refuses anything that could change the host or path", () => {
    assert.equal(supportUrl("kofi", ""), null);
    assert.equal(supportUrl("kofi", "a/../../evil"), null);
    assert.equal(supportUrl("paypal", "me?x=1"), null);
    assert.equal(supportUrl("github", "-bad-"), null);
  });
});

describe("contact messages", () => {
  it("keeps newlines in the message but not in one-line fields", () => {
    assert.equal(cleanText("  Hi\r\nthere\u0000\u0007 \t ", 100, true), "Hi\nthere");
    assert.equal(cleanText("Ann\nSmith", 100), "Ann Smith");
    assert.equal(cleanText("abcdef", 3), "abc");
  });

  it("accepts plausible email addresses only", () => {
    assert.ok(isEmail("me@example.com"));
    assert.ok(!isEmail("me@example"));
    assert.ok(!isEmail("me example@x.com"));
    assert.ok(!isEmail("<a>@x.com"));
  });
});
