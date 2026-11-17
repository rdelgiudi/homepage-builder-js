# Homepage builder with customizable components

A customizable Next.js homepage with Discord, Steam, Overwatch, and GitHub integration. Powers my site: https://giudi.me.

⚠️ WARNING ⚠️: Entire project is AI generated, there may be some major bugs or overall weirdly structured code.

## Features

- **One JSON config** (`src/config/homepage.json`) for everything, validated on load and editable without a rebuild — or through the admin panel
- **Five site layouts**: top tabs, sidebar, one-page scroll, bento grid, link-in-bio; each tab can stack its widgets or lay them out on a 12-column grid
- **36 widget types**:
  - Gaming and presence: Discord user presence (real-time over WebSocket, mobile indicator), Discord server, Steam (with achievement progress), Overwatch, chess ratings
  - Social and feeds: GitHub project cards, GitHub contribution heatmap, Mastodon, Bluesky, RSS/Atom, support buttons (Ko-fi, GitHub Sponsors, Patreon…), 88×31 button wall and webring
  - Visitors: guestbook comments (with optional moderation), anonymous emoji reactions, polls, a private contact form (read in the admin Inbox)
  - Info and media: weather, clock, countdown, service status board, images and galleries, YouTube/Vimeo/Spotify/SoundCloud embeds, latest YouTube uploads, Twitch live status, recently played music (ListenBrainz / Last.fm), random memes
  - Text and structure: headers, text, links, markdown files, "now" card, FAQ, skills, timeline, quotes, dividers
- **Backgrounds**: solid, gradient, image, video or pattern, with readability overlay, per-tab backgrounds (crossfaded) and adjustable header/card transparency
- **Canvas effects**: stars, comet, snow, fireflies, constellation, aurora; optional mouse trail and a flying emoji whenever someone reacts
- **Admin panel** (optional): drag-and-drop builder, schema-generated forms, live draft preview, publish with version history, media uploads, markdown editor, comment moderation, contact-form inbox
- Live viewer count and total visitor counter
- Light/dark mode, animated gradient title and favicon, gradient widget frames
- Responsive: under 768px the tab bar collapses into a compact bar with a slide-in menu
- No outbound API requests while nobody is on the site (Steam, Overwatch and Discord enrichment pause; data widgets only fetch when a visitor's page asks)

## Mobile

On screens narrower than 768px (`md` breakpoint), the horizontal tab bar is replaced by a compact bar showing the active tab's name and a hamburger button. Tapping the hamburger opens a side menu that slides in from the right; the hamburger morphs into an X to close it. The menu is anchored to the tab bar, so when the site title is visible at the top of the page the menu drops down below it rather than covering it. No horizontal scrolling occurs on mobile.

## Getting Started

### Prerequisites

- Node.js 26 (the version the Dockerfile uses; the tests require it)

### Installation

```bash
npm install
cp .env.example .env                                         # fill in only the integrations you use
cp src/config/homepage.example.json src/config/homepage.json
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your homepage. Without `homepage.json` the site starts with an empty default config. `homepage.json` and `src/content/*.md` are gitignored, so your own content stays out of the repository. To use the admin panel locally, set `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`, see [Admin panel](#admin-panel)) in `.env` and open `/admin`.

### Checks

```bash
npm run lint              # ESLint
npm test                  # unit tests, about a second
npm run test:integration  # builds, then tests the admin panel and APIs over HTTP (~20s)
```

The tests need Node 26, the version the Dockerfile uses. The integration tests start the built server in a temporary folder with its own config and database and with every integration (Discord, Steam, Overwatch) switched off, so the test server never reads your real `.env`, config or data. (The build step before it reads `.env` as any `npm run build` does.) It rebuilds `.next`, so stop `npm run dev` first.

## Configuration

### Homepage Settings (`src/config/homepage.json`)

```json
{
  "version": 2,
  "name": "Your Name",
  "tagline": "Your tagline or bio goes here",
  "favicon": "",  // empty/omit = auto-generated animated gradient ring
  "titleGradient": ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"],
  "taglineGradient": [],
  "layout": { "site": "tabs" },  // "tabs" | "sidebar" | "onepage" | "bento" | "linkinbio"
  "background": {
    "base": { "type": "solid", "light": "#f3f4f6", "dark": "#111827" },
    "effect": { "type": "comet" }  // "none" | "stars" | "comet" | "snow" | "fireflies" | "constellation" | "aurora"
  },
  "effects": {
    "gradientBorders": true,
    "tabTransitions": true,
    "customScrollbar": true,
    "progressGradient": true,
    "progressGradientColors": ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"],
    "widgetFrame": false,
    "widgetFrameWidth": 3,
    "mouseTrail": false,
    "mouseTrailColors": ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"],
    "reactionFlyer": true
  },
  "tabs": [
    {
      "id": "home",
      "label": "Home",
      "icon": "🏠",
      "sections": [
        { "id": "home-header", "type": "header", "title": "Welcome", "icon": "👋" },
        { "id": "home-text", "type": "text", "content": "Your bio here.", "icon": "📝" }
      ]
    },
    {
      "id": "projects",
      "label": "Projects",
      "icon": "📦",
      "sections": [
        { "id": "projects-github", "type": "github", "icon": "⭐", "text": "Open Source", "repos": [
          { "owner": "user", "repo": "repo-name", "label": "My Project", "note": "A personal note" }
        ]}
      ]
    }
  ]
}
```

**Layouts:**
- `layout.site` — the overall shell:

  | Value | Result |
  |---|---|
  | `tabs` (default) | Tab bar across the top, one tab at a time |
  | `sidebar` | Name, tagline and the tab list in a left column (falls back to the tab bar on phones) |
  | `onepage` | Every tab on one scrolling page with a sticky jump bar |
  | `bento` | Wide page; every tab is a grid, two widgets per row by default |
  | `linkinbio` | One narrow column, sized for phones; no navigation if there is a single tab |
- `tabs[].layout` — `"stack"` (default, one widget per row) or `"grid"` (12 columns).
- `sections[].span` — a widget's width in a grid, 1–12 columns (e.g. `6` = half). Unset = full width in a grid tab, half in the bento layout. On phones every widget is full width.

**Counters:** `"counters": { "viewers": true, "visitors": true }` — the live "people viewing now" count and the total unique visitors, shown bottom left. Each can be switched off on its own (both default to on).

**Config versions:** this is config **v2**. A v1 file (no `version` field, with `backgroundColor` and `effects.particleBackground` / `effects.particleEffect`) still works unchanged — it is upgraded in memory on load. `id`s are optional when writing by hand (they are derived from the tab label / section type); they must be unique across the whole file if you set them.

**Validation:** the file is validated on load. An invalid section or tab is skipped and reported in the server log (`[Config] ...`) while the rest of the site keeps working; if the file as a whole is unusable, the last good config stays active.

**Gradient & background customization:**
- `titleGradient` — Array of color stops for the animated title text gradient. Omit or empty = solid color.
- `taglineGradient` — Color stops for the tagline gradient. Leave empty or omit to inherit `titleGradient` colors.
- `background` — see [Background](#background) below.

### Background

```json
"background": {
  "base":    { "type": "image", "image": "/api/uploads/….webp", "fit": "cover", "light": "#f3f4f6", "dark": "#111827" },
  "overlay": { "dim": 40, "blur": 4 },
  "effect":  { "type": "aurora", "density": 1, "speed": 1 },
  "surface": { "header": 0, "cards": 70, "blur": 8 }
}
```

| Part | Options |
|---|---|
| `base.type` | `solid` (default), `gradient`, `image`, `video`, `pattern` |
| `base.light` / `base.dark` | Page colour per mode. Always used underneath, and while an image or video loads. |
| gradient | `gradientLight`, `gradientDark` (colour stops; dark falls back to light), `angle` (0–360), `animated` (slow drift) |
| image | `image`, `imageDark` (optional), `fit` (`cover` / `contain` / `tile`), `position` (`center` / `top` / `bottom` / `left` / `right`), `fixed` (stay in place while scrolling) |
| video | `video` (MP4 or WebM, plays muted in a loop), `poster` (still image; shown instead of the video for visitors who prefer reduced motion) |
| pattern | `pattern` (`dots` / `grid` / `diagonal` / `noise`), `patternSize` (8–80px), `patternColor` (optional) |
| `overlay` | `dim` (0–95%, fades the background toward the page colour to keep text readable), `blur` (0–24px) |
| `effect` | `type`: `none`, `stars` (default), `comet`, `snow`, `fireflies`, `constellation`, `aurora`; `density` and `speed` (0.25–3, 1 = normal); `color` (optional) |
| `surface` | `header` (0–100% opacity of the name band and tab bar), `cards` (20–100% opacity of widget cards), `blur` (0–24px blur behind the tab bar) |

A tab can have its own background: give it a `background` object with the same fields as `base`. It replaces the site's background while that tab is open, with a crossfade (not in the one-page layout).

Images and videos can be any `https://` URL, or uploaded in the admin panel (Background → Image/Video → Upload). Uploaded images are converted to WebP, scaled to at most 2560px and stripped of metadata; limits are 20 MB per image and 60 MB per video.

### Effects (`effects`)

Toggle visual effects on or off:

| Effect | Type | Default | Description |
|--------|------|---------|-------------|
| `gradientBorders` | boolean | `true` | Animated gradient border + subtle scale on hover for link cards, buttons, GitHub project cards, Steam "View Profile", and Meme "New Meme" |
| `tabTransitions` | boolean | `true` | Smooth crossfade animation when switching between tabs |
| `customScrollbar` | boolean | `true` | Thin, rounded scrollbar matching the theme |
| `progressGradient` | boolean | `true` | Animated gradient fill on music activity progress bar with sparkle particles |
| `progressGradientColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the progress bar (falls back to `titleGradient`, then default blue→purple→pink) |
| `widgetFrame` | boolean | `false` | Animated gradient frame around widget sections using title gradient colors |
| `widgetFrameWidth` | number | `2` | Border width in pixels for the widget gradient frame |
| `mouseTrail` | boolean | `false` | Comet-style mouse trail — a continuous tapering gradient line that follows the cursor; draws nothing while the cursor is stationary |
| `mouseTrailColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the mouse trail (falls back to `titleGradient`, then default blue→purple→pink) |
| `faviconAnimation` | boolean | `true` | Animated gradient-ring favicon when `favicon` is empty; `false` uses the static SVG version |
| `reactionFlyer` | boolean | `true` | Background emoji flyer — when someone reacts, an emoji flies up the screen (bottom→top) for all connected visitors. Toggle off to disable |

The boolean effects default to `true` if omitted, except `widgetFrame` and `mouseTrail` (default `false`). Set any to `false` to disable.

`progressGradientColors` accepts an array of CSS color strings. When unset it inherits `titleGradient` colors, falling back to a default blue→purple→pink gradient. On track change, the progress bar smoothly shrinks to the new position with burst sparkle particles.

`widgetFrame` can be set globally in effects or overridden per-section by adding `"widgetFrame": true` (or `false`) to individual section objects — see the "Supports `widgetFrame`" column below.

### Section Types

| Type | Description | Supports `widgetFrame` |
|------|-------------|------------------------|
| `header` | Big title with icon | no |
| `text` | Paragraph with icon | no |
| `links` | Row of link cards (supports primary/secondary styles) | no |
| `discord-server` | Discord server widget | yes |
| `discord-user` | Discord user presence with activity, status, custom status, elapsed time, and mobile indicator | yes (adds top padding to separate gradient border from banner) |
| `steam` | Steam profile, recently played, and top games | yes |
| `overwatch` | Overwatch stats with competitive ranks, hero stats, and performance metrics | yes |
| `markdown` | Renders a markdown file from `content/` directory | yes |
| `meme` | Shows a random meme (supports `popular` flag; NSFW/spoiler always filtered) | yes (frame wraps only the image, not the button) |
| `github` | GitHub project cards from public repos | yes |
| `comments` | Guestbook widget: visitors post a name + comment, listed newest-first (optional moderation in the admin panel) | yes |
| `reactions` | Anonymous emoji reactions (toggle per emoji, rate-limited, background flyer on react) | yes |
| `image` | One image or a gallery: `images` (`src`, `alt`, `caption`, `link`), `columns` (1–4, at most 2 on phones), `shape` (`original` / `square` / `wide`) | yes |
| `embed` | A YouTube or Vimeo video, or a Spotify or SoundCloud player, from its normal link (`url`) | yes |
| `clock` | Current time in a `timezone` (e.g. `Europe/Rome`), with optional date and the difference to the visitor's own time | yes |
| `countdown` | Days, hours, minutes and seconds until `target` (`YYYY-MM-DDTHH:mm` in `timezone`) | yes |
| `weather` | Current weather and three-day forecast for `latitude` / `longitude` (Open-Meteo; `units`: `celsius` / `fahrenheit`) | yes |
| `rss` | Latest posts from an RSS or Atom feed (`url`, `limit`) | yes |
| `github-activity` | A year of GitHub contributions as a heatmap (`username`) | yes |
| `mastodon` | Latest posts from a Mastodon account (`instance`, `account`, `limit`) | yes |
| `bluesky` | Latest posts from a Bluesky account (`handle`, `limit`) | yes |
| `chess` | Ratings from Lichess or Chess.com (`site`: `lichess` / `chesscom`, `username`) | yes |
| `skills` | Badges with an optional icon and level 1–5 (`items`) | yes |
| `timeline` | Events in order (`items`: `title`, `date`, `text`) | yes |
| `quote` | A quote; with several in `quotes`, each visitor sees a random one | yes |
| `divider` | A line, dots or empty space (`style`, `size`) | no |
| `poll` | A question visitors vote on (`question`, `options`; one vote per visitor, changeable; `results`: `after` / `always`) | yes |
| `contact` | Private contact form (`intro`, `askEmail`: `optional` / `required` / `hidden`, `buttonText`, `successText`). Messages go to the admin panel's Inbox; rate-limited, honeypot, blockable | yes |
| `now` | "What I'm doing now" lines (`items`: `icon`, `label`, `text`, `url`) with `updated` (`YYYY-MM-DD`, shown as "Updated 3 days ago") | yes |
| `faq` | Questions that open to show the answer (`items`: `question`, `answer`; `openFirst`) | yes |
| `support` | Support buttons in brand colours (`items`: `platform` = `kofi` / `github` / `patreon` / `buymeacoffee` / `liberapay` / `paypal` / `opencollective`, `username`, `label`) | no |
| `buttons` | Wall of 88×31 buttons (`items`: `image`, `label`, `url`; `pixelated`) plus optional webring links (`ringName`, `ringHome`, `ringPrev`, `ringNext`, `ringRandom`) | no |
| `youtube` | Latest uploads of a channel (`channel`: `@handle` or `UC…` id, `limit`, `hideShorts`, `layout`: `grid` / `list`). No API key | yes |
| `twitch` | Live status, stream title, game and viewers (`username`, `hideOffline`). Needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` | yes |
| `music` | Recently played tracks with covers (`service`: `listenbrainz` / `lastfm`, `username`, `limit`, `showCovers`). Last.fm needs `LASTFM_API_KEY` | yes |
| `status` | Up/down and response time of your sites and services (`services`: `label`, `url`, `icon`; `showLatency`, `linked`). The addresses are visible in the page source | yes |

Every section also accepts `span` (grid width, see Layouts) and `widgetFrame`; most accept `icon` and `text` for a title row. Only `discord-server`, `discord-user`, `steam`, `overwatch` and `twitch` need environment variables (`music` too, for Last.fm only). Widgets that show data from another site fetch it through this server only when a visitor's page asks for it, and cache it (weather 15 min, feeds, YouTube and chess 30 min, Mastodon and Bluesky 10 min, Twitch and music 2 min, status checks 1 min, GitHub activity 3 h). Twitch, music and status also re-check while the page stays open.

## Components Reference

### DiscordServer (`discord-server`)

Displays a Discord server widget showing member count and online presence.

**Config:** `DISCORD_SERVER_ID` environment variable

**Setup:**
1. Open Discord and go to your server
2. Go to **Server Settings > Widget** (or Engagement)
3. Enable "Enable Server Widget"
4. Copy the **Server ID**

**Features:**
- Member count display
- Online/Offline member counts
- Server name and icon
- Invite link button

---

### DiscordUser (`discord-user`)

Displays detailed Discord user presence including online status, current activity, custom status, and elapsed time.

**Config:** `DISCORD_USER_ID` and `DISCORD_BOT_TOKEN` environment variables

**Setup:**
1. Enable **Developer Mode** in Discord (User Settings > Advanced > Developer Mode)
2. Right-click your username and select **Copy User ID**
3. Create a Discord bot and get its token:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to **Bot** section
   - Enable **Presence Intent** and **Server Members Intent**
   - Click **Reset Token** and copy the token
4. The bot must be a member of a shared server with your user

**Features:**
- Avatar with Discord-style status dot (online, idle, DND, offline)
- Banner background (from avatar color extraction or user banner)
- Current activity display (game, music, streaming)
- Custom status with emoji
- Elapsed time for current activity
- "Last seen" timestamp when offline
- Music track info with album art (Spotify, YouTube Music)
- **Mobile indicator** — phone icon replaces status dot when on mobile only, appends " · On Mobile"
- **Animated gradient progress bar** — music progress bar uses moving gradient (matches title colors by default) with sparkle particles at the current position
- **Crossfade track transitions** — smooth fade-out/fade-in for song changes within the same app (album art, title, and details crossfade without layout shift)
- **Diminishing progress on track change** — progress bar smoothly shrinks to zero with an intense burst sparkle effect when a new song starts

**Real-time updates:**
- Presence data pushed via WebSocket — instant updates, no polling
- Profile data cached on server for 5 minutes
- The presence bot runs in-process with the Next.js server (no separate WebSocket hop)

**Banner color extraction:**
- Extracts the dominant color using Discord's own algorithm (reverse-engineered by [Vendicated](https://gist.github.com/Vendicated/ad803e9341e9c1110639361f17b58b5b))
- Full-resolution sampling with MMCQ median-cut quantization to 5 colors
- Falls back to Discord's `banner_color` API value or default blurple `#5865F2`

---

### SteamStatus (`steam`)

Displays Steam profile, recently played games, and top games by playtime.

**Config:** `STEAM_API_KEY` and `STEAM_ID` environment variables

**Setup:**
1. Get a Steam API key: https://steamcommunity.com/dev/apikey
   - Sign in with Steam
   - Register a domain (any domain works for personal use, e.g., `localhost`)
   - Copy the API key
2. Find your Steam 64-bit ID:
   - Go to https://steamcommunity.com/
   - Find your profile name, expand options and copy click **View my profile**
   - Copy the **SteamID64** (64-bit ID) from the URL

**Features:**
- Steam profile with avatar and display name
- Online status indicator with animated pulse glow (blue for Online, green for In Game)
- Recently played games (last 2 weeks)
- Top games by total playtime
- Game cards with box art, playtime, and direct Steam store links
- Current game being played with elapsed time

**Caching:**
- The server refreshes profile and game data every 10 seconds (achievements every 10 minutes) and pushes changes over WebSocket; refreshing pauses while nobody is on the site
- Game box art is fetched from Steam CDN
- Achievement progress needs the Steam profile's "Game details" set to **Public**

---

### OverwatchStatus (`overwatch`)

Displays Overwatch competitive ranks, hero statistics, and performance metrics.

**Config:** `OVERWATCH_BATTLE_TAG` environment variable

**Setup:**
1. Enter your BattleTag in format `Username-12345` (case-sensitive)
2. Your Overwatch profile must be set to **Public** to display stats

**Features:**
- Competitive ranks for all three roles (Tank, Damage, Support)
- Rank icons with division badges
- Most played heroes (12 heroes by default)
- Per-hero statistics: playtime, winrate, KDA, damage, healing
- Hero portraits and role icons
- General stats summary with eliminations, deaths, healing, damage
- Win/Loss record and overall winrate
- Last updated timestamp

**Role Colors:**
- Tank: `#4785ff` (blue)
- Damage: `#fa9c1e` (orange)
- Support: `#2daf3f` (green)

**Rank Colors:**
- Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion

**Refreshing:**
- The server refetches the profile every 30 seconds and pushes it over WebSocket only when it changed
- Refreshing pauses while nobody is on the site

**API Source:**
- Uses the OverFast API (https://overfast-api.tekrop.fr)

---

### GitHubProjects (`github`)

Displays GitHub project cards with stars, forks, language, license, and update time.

**Config:** no environment variables needed

**Features:**
- Repo name (with optional custom label)
- Optional personal note below the title
- Description (2-line clamp)
- Language with colored dot (GitHub-matching colors)
- Star and fork counts
- License badge (SPDX ID)
- "Updated X ago" (shows years for 12+ month old repos)
- Failed repos still show a card with name, note, and error message

**Caching:**
- Data fetched server-side via `/api/github`
- Successful responses cached in-memory for 6 hours
- Failed responses cached for 10 minutes to avoid retry storms
- No GitHub API key needed

**Config example in homepage.json:**
```json
{
  "type": "github",
  "icon": "⭐",
  "text": "Open Source Projects",
  "repos": [
    { "owner": "user", "repo": "my-project", "label": "My Project", "note": "A short personal note" }
  ]
}
```

---

### MemeWidget (`meme`)

Displays a random meme from an external API.

**Config:** no environment variables needed. Set `"popular": true` on the `meme` section in `homepage.json` to fetch the highest-upvoted memes instead of a random one.

**Features:**
- Random (or, in `popular` mode, highest-upvoted) meme; NSFW and spoiler memes are always filtered out server-side
- De-duplication via a 30-entry client history so rerolls never show the same meme twice (popular mode advances to the next most-upvoted unseen meme; default mode picks a random unseen one)
- Image display with title and subreddit source; the title links to the original Reddit post
- Loading placeholder stays until the image finishes downloading in the browser
- Refresh button for a new meme

---

### CommentsWidget (`comments`)

Lets visitors leave a name + comment on a guestbook tab. No account needed; posts are rate-limited per visitor and validated server-side, and can be moderated in the admin panel.

**Config:** no environment variables needed

**Features:**
- Name input (max 40 chars) + comment textarea (max 500 chars)
- Posts via `POST /api/comments`, lists newest-first via `GET /api/comments?limit=N`
- Per-visitor rate limit (1 post / 5s) keyed by the `visitor_id` cookie, shared with the visitor counter
- Control characters stripped; XSS-safe rendering (plain React text, never `dangerouslySetInnerHTML`)
- Loading skeleton, empty state, and error fallback
- Moderation (admin panel → Comments): publish immediately or hold every comment for approval, hold comments containing certain words, approve/reject/edit/delete, block a visitor. A held comment is shown only to its author, marked "Awaiting approval".
- Respects `widgetFrame` / `widgetFrameWidth` and `gradientBorders` effects

**Storage:** comments live in the same `data/visitors.db` SQLite file as the visitor counter (a `comments` table), so the existing Docker volume keeps them persisted.

**Config example in homepage.json:**
```json
{
  "type": "comments",
  "icon": "💬",
  "text": "Leave a comment",
  "limit": 50,
  "widgetFrame": true
}
```

---

### ReactionsWidget (`reactions`)

Lets visitors leave an anonymous emoji reaction instead of a comment — no name or account needed.

**Config:** no environment variables needed. Optional `emojis` array on the section overrides the default set.

**Features:**
- Emoji buttons with live per-emoji counts
- Toggle on/off per emoji; one reaction per emoji per visitor (enforced by a `UNIQUE(emoji, visitor_hash)` constraint in SQLite)
- State is authoritative from the server (`GET`/`POST`/`DELETE /api/reactions` return the `reacted` list derived from the `visitor_id` cookie) — not `localStorage`, so it survives reloads/devices
- Per-visitor rate limit (`RATE_LIMIT_MS` = 250ms); on a `429` the widget retries after the window so intent isn't dropped, and stays grayed/locked until the request resolves
- Real-time background flyer: a new reaction broadcasts to all connected clients, spawning an emoji that flies bottom→top behind the content (`ReactionFlyer`, gated by `effects.reactionFlyer`)
- Respects `widgetFrame` / `widgetFrameWidth` and `gradientBorders` effects

**Storage:** reactions live in the same `data/visitors.db` SQLite file as the comments/visitor counter (a `reactions` table).

**Config example in homepage.json:**
```json
{
  "type": "reactions",
  "icon": "✨",
  "text": "Or just drop a reaction",
  "emojis": ["👍", "❤️", "😂", "🔥", "🎉", "👀"],
  "widgetFrame": true
}
```

---

### MouseTrail (`effects.mouseTrail`)

A canvas overlay that renders a comet-style trail following the cursor, matching the comet background aesthetic.

**Config:** `mouseTrail` (boolean, default `false`) and `mouseTrailColors` (string[], falls back to `titleGradient`) in `effects`.

**Features:**
- Continuous tapering gradient line that follows the cursor; color flows along the trail by interpolating across `mouseTrailColors`.
- Two-pass stroke (soft glow + bright core) drawn as a single `createLinearGradient` path — cheap, no per-segment `shadowBlur`.
- Draws **nothing while the cursor is stationary**; existing points decay so the trail fades out cleanly on stop.
- `fixed`, `pointer-events-none`, `z-50` overlay — above content but non-interactive.
- Pauses on `visibilitychange` (tab hidden) and caps the point history to keep per-frame cost low.

**Config example in homepage.json:**
```json
{
  "effects": {
    "mouseTrail": true,
    "mouseTrailColors": ["#60a5fa", "#a78bfa", "#f472b6"]
  }
}
```

---

## Data Flow

| API | Mechanism | Notes |
|-----|-----------|-------|
| Discord User | **WebSocket** (push) | Real-time presence updates via WebSocket with server-side enrichment, 5 min profile cache |
| Steam | **WebSocket** (push, 10s refresh) | Profile and game data pushed via WebSocket |
| Overwatch | **WebSocket** (push, 30s refresh) | Stats and ranks pushed via WebSocket |
| GitHub | **REST** (server API, 6h cache) | `/api/github` proxies GitHub API, caches success 6h, errors 10m |
| Visitor Counter | **REST** (server API) | SQLite-backed `/api/visitors` with hashed visitor IDs |
| Comments | **REST** (server API) | SQLite-backed `/api/comments`; same `visitors.db`, shared `visitor_id` cookie for rate-limiting |
| Reactions | **REST + WebSocket** (server API + broadcast) | SQLite-backed `/api/reactions`; toggle per emoji keyed by `visitor_hash` (UNIQUE). A new reaction broadcasts `{type:"reaction", emoji}` to all clients via the WebSocket server for the background flyer |
| Live viewers | **WebSocket** (push) + REST | Count of distinct visitors with an open connection; `/api/viewers` gives the initial value |
| Poll | **REST** (server API) | SQLite-backed `/api/poll`, one vote per visitor (changeable) |
| Weather, RSS, Mastodon, Bluesky, chess, GitHub activity, YouTube, Twitch, music, status | **REST** (`/api/widgets/<type>`) | Fetched only when a visitor's widget asks, cached in memory (1 min – 3 h); the server never polls on its own |
| Contact form | **REST** (server API) | `/api/contact` stores private messages in SQLite; read in the admin Inbox (`/api/admin/messages`) |
| Config | **WebSocket** (push) | The server watches `homepage.json`; on change every open page refreshes itself |
| Discord/Steam/Overwatch (mount) | **REST** (server API snapshots) | `/api/presence`, `/api/steam`, `/api/overwatch` return the current in-memory server state so the widgets repopulate instantly on mount (e.g. after a tab switch remounts them) instead of waiting for the next re-broadcast |

---

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx / layout.tsx / loading.tsx   # Homepage (renders <SitePage> from homepage.json)
│   │   ├── admin/                   # /admin (panel, sign-in) and /admin/preview (draft preview)
│   │   └── api/                     # Public APIs: github, markdown, meme, visitors, viewers, comments,
│   │       │                        #   reactions, poll, contact, presence, steam, overwatch, favicon,
│   │       │                        #   widgets/[type] (data widgets), uploads/[name] (uploaded media)
│   │       └── admin/               # Admin APIs: login/logout, config + publish, revisions, upload,
│   │                                #   content, comments, messages, integrations
│   ├── components/                  # SitePage, Tabs, OnePage, TabSections, BackgroundLayer, effects,
│   │   │                            #   theme switch, counters, and the larger widget components
│   │   └── admin/                   # Admin panel UI (builder, schema forms, preview, screens)
│   ├── widgets/                     # Widget registry — one folder per section type
│   │   ├── <type>/meta.ts           # Options schema (zod), label, category, defaults, required env vars (server-safe)
│   │   ├── <type>/render.tsx        # How the section renders
│   │   ├── meta.ts                  # All widget metas + SectionSchema
│   │   └── registry.tsx             # renderSection(): title row + gradient frame + widget body
│   ├── lib/
│   │   ├── schema/                  # Config v2 schema (zod), v1→v2 migration, lenient/strict parsers
│   │   ├── admin/                   # Auth, sessions, password hashing, draft/revisions store, publish
│   │   ├── config.ts                # mtime-cached homepage.json loader
│   │   ├── db.ts                    # Shared SQLite connection (DATA_DIR/visitors.db)
│   │   ├── widget-sources.ts        # Fetchers for weather, rss, mastodon, bluesky, chess, github-activity
│   │   └── …                        # comments, reactions, uploads, background, markdown, visitor helpers
│   ├── hooks/useWebSocket.ts        # Shared WebSocket connection, per-type subscriptions
│   ├── config/                      # homepage.json (yours, gitignored) + homepage.example.json
│   └── content/                     # Markdown files for markdown widgets (gitignored)
├── tests/                           # Unit and integration tests (node --test)
├── scripts/admin-hash.js            # npm run admin:hash
├── websocket-server.js              # Custom server: Next.js + WebSocket, Steam/Overwatch/Discord data
├── discord-presence.js              # Discord bot (runs in the same process)
├── Dockerfile, docker-compose-example.yml, docker-entrypoint.sh
└── .env.example
```

See `AGENTS.md` for a file-by-file layout and implementation notes.

## Admin panel

Run `npm run admin:hash`, type a password, paste the printed `ADMIN_PASSWORD_HASH=...` line into `.env`, restart, and open `/admin`. Without an admin password the panel does not exist (`/admin` and `/api/admin/*` answer 404).

The hash (salted scrypt) means the password itself is not stored anywhere — someone who gets to read `.env` or the container environment can't sign in with what they find. For local development you can set a plain `ADMIN_PASSWORD` instead; the server logs a warning if that is used in production. In Docker: `docker compose run --rm homepage-admin node scripts/admin-hash.js`.

| Screen | What it does |
|---|---|
| **Builder** | Tabs and their widgets. Drag rows to reorder, drag a widget onto a tab to move it, click or drag from the palette to add. Selecting a row opens its settings on the right. |
| **Site / Background / Effects** | Every other option in `homepage.json`, as forms. |
| **Content** | Create, edit and delete the markdown files in `src/content/`, with a rendered preview. |
| **Comments** | Approve, reject, edit, delete; block a visitor; choose whether new comments publish right away or wait for approval; hold comments containing certain words. |
| **Integrations** | Which environment variables are set (never their values) and whether config, content and data are writable. |
| **History** | The last 50 published versions. Loading one puts it into the draft. |

**Resizable panels.** Drag the dividers on either side of the preview to resize the side panels (240–760px; the preview keeps at least 320px). Double-click a divider to reset it; widths are remembered in your browser.

**Draft and publish.** Edits are saved automatically as a *draft* (in the database) and shown in the live preview next to the forms. Nothing changes on the site until you press **Publish**, which writes `homepage.json` and tells open browser tabs to refresh. Markdown files and comment moderation are the exception: they take effect immediately.

**Every option gets a form automatically.** The forms are generated from the config schema (`src/lib/schema/config.ts` and each widget's `meta.ts`), so a new option or widget needs no admin code.

**Security.** One password, stored as a scrypt hash and compared in constant time; server-side sessions (7 days) in an `HttpOnly`, `SameSite=Strict` cookie; cross-site write requests are refused; 8 failed sign-ins per 10 minutes per client. For anything public-facing, the recommended setup is the two-container one in `docker-compose-example.yml`, on a single hostname: the public container runs with `APP_ROLE=public` (no admin panel at all, config and content mounted read-only) and a second container serves the panel. Your reverse proxy sends two path prefixes to the admin container and everything else to the public one:

| Path prefix | Goes to |
|---|---|
| `/admin` | admin container (panel, sign-in page, draft preview) |
| `/api/admin` | admin container (everything the panel calls) |
| everything else | public container |

The session cookie is scoped to those two prefixes, so it is never sent to the public container. Rebuild and recreate both containers together — the admin pages load their scripts from the public one, so they must run the same build. To keep the sign-in page off the internet as well, put an IP allow-list or VPN-only rule on the admin route.

**Hand-editing still works.** `homepage.json` stays a plain file; the panel just reads and writes it. Publishing rewrites it in the current format (v2) and keeps the previous content under History.

## Docker

```bash
cp docker-compose-example.yml docker-compose.yml
docker compose up --build
```

Each container runs:
- WebSocket server + Next.js + Discord presence bot (all in one Node process)
- Named volume mounted at `/app/data` for everything written at runtime: `visitors.db` (visitor counter, comments, reactions, poll votes, contact messages, admin sessions, drafts and history) and `uploads/` (background images and videos). Override the location with `DATA_DIR`.
- Bind mounts for `src/config/` and `src/content/` (read-only for the public container, writable for the one serving the admin panel)

The example compose file starts two containers from the same image — the public site and the admin panel — sharing the data volume and the config/content folders, meant to sit behind one hostname with the proxy rule described under *Admin panel*. The comments in the file cover the own-port and single-container alternatives.

## Tech Stack

- **Next.js 15 / React 19** - framework, with a custom Node server for WebSockets (`ws`)
- **TypeScript** - type safety
- **Tailwind CSS** - styling
- **zod** - config schema, validation and the admin panel's generated forms
- **better-sqlite3** - visitors, comments, reactions, polls, admin state
- **sharp** - re-encoding uploaded images
- **dnd-kit** - drag and drop in the admin builder
- **discord.js** - user presence; **Steam Web API**, **OverFast API** (Overwatch), **GitHub API**
- **Open-Meteo, Lichess, Chess.com, Mastodon, Bluesky** - data widgets (no keys needed)

## License

MIT
