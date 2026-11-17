import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lastFmTrack, listenBrainzTrack, parseContributions, parseFeed, parseYouTubeFeed, serviceState } from "@/lib/widget-sources";
import { supportUrl } from "@/widgets/support/platforms";
import { cleanText, isEmail } from "@/lib/messages";
import { zonedTimeToMs, zoneOffsetMinutes } from "@/widgets/time";
import { initialStatus } from "@/lib/comments";
import { backgroundLayer } from "@/lib/background";
import { BackgroundBaseSchema } from "@/lib/schema/config";
import { infoRequest, parseA2SReply, parseServerAddress } from "@/lib/a2s";
import { minecraftStatus, rareAchievements, speedrunRun, tetrioLevel, tetrioProfile } from "@/lib/gaming-sources";
import { summarizePlay } from "@/lib/play-history";
import { playStatus } from "@/widgets/play-with-me/status";
import { searchTerm, storeResults } from "@/lib/game-suggestions";

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

describe("A2S server query", () => {
  const info = (extra: number[] = []) =>
    Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 17]),
      Buffer.from("My Server\0de_dust2\0csgo\0Counter-Strike 2\0", "utf8"),
      Buffer.from([0xda, 0x02, 12, 24, 2, 0x64, 0x6c, 0, 1]),
      Buffer.from("1.40.2.3\0", "utf8"),
      Buffer.from(extra),
    ]);

  it("reads an A2S_INFO answer", () => {
    const reply = parseA2SReply(info([0x80, 0x87, 0x69]));
    assert.equal(reply?.kind, "info");
    if (reply?.kind !== "info") return;
    assert.deepEqual(
      { ...reply.info },
      { name: "My Server", map: "de_dust2", folder: "csgo", game: "Counter-Strike 2", appId: 730, players: 12, maxPlayers: 24, bots: 2, serverType: "d", environment: "l", passworded: false, vac: true, version: "1.40.2.3" }
    );
  });

  it("returns the challenge so the request can be sent again", () => {
    const reply = parseA2SReply(Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41, 1, 2, 3, 4]));
    assert.equal(reply?.kind, "challenge");
    if (reply?.kind === "challenge") {
      assert.deepEqual([...reply.challenge], [1, 2, 3, 4]);
      assert.deepEqual([...infoRequest(reply.challenge).subarray(-4)], [1, 2, 3, 4]);
    }
  });

  it("ignores truncated, split and unknown packets", () => {
    assert.equal(parseA2SReply(info().subarray(0, 20)), null);
    assert.equal(parseA2SReply(Buffer.from([0xfe, 0xff, 0xff, 0xff, 0x49])), null);
    assert.equal(parseA2SReply(Buffer.from([0xff, 0xff, 0xff, 0xff, 0x6d, 0])), null);
  });

  it("accepts host[:port] only", () => {
    assert.deepEqual(parseServerAddress("play.example.com", 27015), { host: "play.example.com", port: 27015 });
    assert.deepEqual(parseServerAddress("10.0.0.5:27016", 27015), { host: "10.0.0.5", port: 27016 });
    assert.equal(parseServerAddress("http://example.com", 27015), null);
    assert.equal(parseServerAddress("example.com:99999", 27015), null);
    assert.equal(parseServerAddress("a b", 27015), null);
  });
});

describe("gaming sources", () => {
  it("maps a Speedrun.com personal best, with the level in the category", () => {
    const run = speedrunRun({
      place: 2,
      run: { weblink: "https://www.speedrun.com/game/runs/abc", date: "2026-01-02", times: { primary_t: 145.976 }, level: "x" },
      game: { data: { names: { international: "Game" }, weblink: "https://www.speedrun.com/game", assets: { "cover-medium": { uri: "https://www.speedrun.com/static/game/1/cover" } } } },
      category: { data: { name: "Any%" } },
      level: { data: { name: "1-3" } },
    });
    assert.deepEqual(run, { game: "Game", category: "1-3: Any%", level: true, place: 2, seconds: 145.976, date: "2026-01-02", url: "https://www.speedrun.com/game/runs/abc", cover: "https://www.speedrun.com/static/game/1/cover" });
    const full = speedrunRun({ ...{ place: 1, run: { weblink: "javascript:alert(1)", date: null, times: { primary_t: 1 }, level: null } }, game: { data: { names: { international: "G" }, weblink: "" } }, category: { data: { name: "Any%" } }, level: { data: [] } });
    assert.equal(full.category, "Any%");
    assert.equal(full.level, false);
    assert.equal(full.url, null);
  });

  it("reads a TETR.IO profile and its records", () => {
    const p = tetrioProfile(
      { _id: "5e32fc85ab319c2ab1beb07c", username: "osk", role: "user", xp: 1525202, gamesplayed: 1936, gameswon: 240, gametime: 504015, country: "XM", avatar_revision: 17 },
      {
        "40l": { record: { results: { stats: { finaltime: 49091.6 } } }, rank: 1 },
        blitz: { record: null, rank: -1 },
        zenith: { record: null, best: { record: { results: { stats: { zenith: { altitude: 1127.09 } } } } } },
        league: { gamesplayed: 14, gameswon: 8, tr: 9499.13, gxe: 60.9097, rank: "z", bestrank: "a-", apm: 35.59, pps: 1.44, vs: 75.57, standing: -1 },
      }
    );
    assert.equal(p.level, tetrioLevel(1525202));
    assert.equal(p.sprint, 49091.6);
    assert.equal(p.blitz, null);
    assert.equal(p.zenith, 1127.09);
    assert.equal(p.league?.rank, "z");
    assert.equal(p.league?.standing, null);
    assert.equal(p.hours, 140);
    assert.match(p.avatar!, /^https:\/\/tetr\.io\/user-content\/avatars\/5e32fc85ab319c2ab1beb07c\.jpg\?rv=17$/);
    assert.equal(tetrioProfile({ _id: "x", username: "new", role: "user", xp: 0, gamesplayed: 0, gameswon: 0, gametime: -1, country: null }, {}).league, null);
  });

  it("reads a Minecraft status and keeps only a PNG data URL as the icon", () => {
    const s = minecraftStatus({ online: true, version: "1.21", motd: { clean: ["  &gt;&gt; Welcome  ", ""] }, players: { online: 3, max: 20, list: [{ name: "Steve" }, { name: "<b>x</b>" }] }, icon: "data:image/png;base64,AAAA" });
    assert.equal(s.name, ">> Welcome");
    assert.deepEqual(s.names, ["Steve"]);
    assert.equal(s.icon, "data:image/png;base64,AAAA");
    assert.equal(minecraftStatus({ online: true, icon: "javascript:alert(1)" }).icon, null);
    assert.equal(minecraftStatus({ online: false }).online, false);
  });

  it("joins unlocked achievements with their global rate", () => {
    const list = rareAchievements(
      10,
      "Game",
      [
        { apiname: "A", achieved: 1, unlocktime: 1700000000 },
        { apiname: "B", achieved: 0, unlocktime: 0 },
        { apiname: "C", achieved: 1, unlocktime: 0 },
      ],
      [
        { name: "A", percent: "3.4" },
        { name: "B", percent: 1 },
      ],
      [{ name: "A", displayName: "Alpha", description: "Do it", icon: "https://cdn.example/a.jpg" }]
    );
    assert.deepEqual(list, [{ appid: 10, game: "Game", name: "Alpha", description: "Do it", icon: "https://cdn.example/a.jpg", percent: 3.4, unlockedAt: "2023-11-14T22:13:20.000Z" }]);
  });
});

describe("play history", () => {
  const H = 3600 * 1000;
  const now = Date.parse("2026-11-17T12:00:00Z");

  it("splits sessions at local midnight and totals per game", () => {
    // 22:00–02:00 in Rome (UTC+1 in November) = 21:00–01:00 UTC.
    const s = summarizePlay([{ game: "Hades", started_at: Date.parse("2026-11-15T21:00:00Z"), ended_at: Date.parse("2026-11-16T01:00:00Z"), open: 0 }], { weeks: 4, timeZone: "Europe/Rome", now });
    assert.equal(s.days.length, 28);
    assert.equal(s.days.at(-1)!.date, "2026-11-17");
    assert.equal(s.days.find((d) => d.date === "2026-11-15")!.minutes, 120);
    assert.equal(s.days.find((d) => d.date === "2026-11-16")!.minutes, 120);
    assert.equal(s.days.find((d) => d.date === "2026-11-16")!.level, 3);
    assert.deepEqual(s.games, [{ name: "Hades", minutes: 240 }]);
    assert.equal(s.totalMinutes, 240);
  });

  it("drops flicker, hidden games and time before the range, and knows what is playing now", () => {
    const s = summarizePlay(
      [
        { game: "Blip", started_at: now - 3 * H, ended_at: now - 3 * H + 60000, open: 0 },
        { game: "Secret", started_at: now - 2 * H, ended_at: now - H, open: 0 },
        { game: "Old", started_at: now - 400 * 24 * H, ended_at: now - 399 * 24 * H, open: 0 },
        { game: "Now", started_at: now - H, ended_at: now - 60000, open: 1 },
      ],
      { weeks: 4, timeZone: "UTC", now, hide: ["secret"] }
    );
    assert.deepEqual(s.games, [{ name: "Now", minutes: 59 }]);
    assert.deepEqual(s.playing, ["Now"]);
    assert.equal(s.recent.some((r) => r.game === "Blip" || r.game === "Secret"), false);
  });

  it("falls back to UTC for an unknown time zone", () => {
    assert.equal(summarizePlay([], { weeks: 4, timeZone: "Mars/Olympus", now }).timeZone, "UTC");
  });
});

describe("play with me", () => {
  const steam = { player: { steamid: "76561198000000000", personastate: 1, gameid: "730", lobbysteamid: "109775240000000000" } };

  it("prefers the Discord game and builds a Steam join link from a lobby", () => {
    const s = playStatus({ id: "123", status: "online", activities: [{ type: 2, name: "Spotify" }, { type: 0, name: "Hades", timestamps: { start: 5 } }] }, steam, "auto");
    assert.equal(s.state, "playing");
    assert.equal(s.game, "Hades");
    assert.equal(s.since, 5);
    assert.equal(s.join, "steam://joinlobby/730/109775240000000000/76561198000000000");
  });

  it("follows the status, unless the owner overrides it", () => {
    assert.equal(playStatus({ status: "dnd", activities: [] }, null, "auto").state, "busy");
    assert.equal(playStatus({ status: "idle", activities: [] }, null, "auto").state, "away");
    assert.equal(playStatus({ status: "offline", activities: [] }, { player: { personastate: 0 } }, "auto").state, "offline");
    assert.equal(playStatus(null, null, "auto").state, "unknown");
    assert.equal(playStatus(null, null, "open").state, "open");
    const busy = playStatus({ status: "online", activities: [{ type: 0, name: "Hades" }] }, steam, "busy");
    assert.equal(busy.state, "busy");
    assert.equal(busy.join, null);
  });

  it("never builds a link from ids that aren't numbers", () => {
    const s = playStatus({ id: "javascript:x" }, { player: { steamid: "1", gameid: "730", lobbysteamid: "x" } }, "auto");
    assert.equal(s.discordId, null);
    assert.equal(s.steamId, null);
    assert.equal(s.join, null);
  });
});

describe("game suggestions", () => {
  it("normalises search terms and rejects ones that are too short or long", () => {
    assert.equal(searchTerm("  Hollow\tKnight "), "hollow knight");
    assert.equal(searchTerm("a"), null);
    assert.equal(searchTerm("x".repeat(61)), null);
    assert.equal(searchTerm(null), null);
  });

  it("keeps only apps from the store's search answer", () => {
    assert.deepEqual(
      storeResults({
        items: [
          { type: "app", name: "Hollow Knight", id: 367520 },
          { type: "sub", name: "Bundle", id: 1 },
          { type: "app", name: "Bad", id: -1 },
          { type: "app", name: "Hollow Knight - Official Soundtrack", id: 598190 },
        ],
      }),
      [{ appid: 367520, title: "Hollow Knight" }]
    );
    assert.deepEqual(storeResults({}), []);
  });
});
