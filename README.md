# Homepage builder with customizable components

A customizable Next.js homepage with Discord, Steam, Overwatch, and GitHub integration. Powers my site: https://giudi.me.

⚠️ WARNING ⚠️: Entire project is AI generated, there may be some major bugs or overall weirdly structured code.

## Features

- Tab-based navigation
- Discord server widget showing member count
- Discord user presence via WebSocket (instant updates, no polling, mobile indicator)
- Steam integration showing recently played games and game library
- Overwatch stats integration (ranks, hero stats, performance metrics)
- GitHub project cards (via public API, no key needed)
- Fully customizable sections (text, links with primary/secondary styles, headers)
- Guestbook / comments widget — visitors post name + comment, stored in SQLite (open posting, rate-limited)
- Anonymous emoji reactions — visitors tap an emoji to react (no account); real-time background flyer shows the reaction to everyone currently viewing
- Icon support using emoji or image URLs
- Responsive design with Tailwind CSS — on screens under 768px (`md`), the tab bar collapses into a compact bar with the current tab label and a hamburger toggle that opens a slide-in side menu (hamburger morphs to an X, menu starts level with the tab bar leaving the site title visible)
- Light/dark mode support
- Auto-generated animated gradient favicon (when not specified, uses title colors)
- Easy to customize via JSON config files

## Mobile

On screens narrower than 768px (`md` breakpoint), the horizontal tab bar is replaced by a compact bar showing the active tab's name and a hamburger button. Tapping the hamburger opens a side menu that slides in from the right; the hamburger morphs into an X to close it. The menu is anchored to the tab bar, so when the site title is visible at the top of the page the menu drops down below it rather than covering it. No horizontal scrolling occurs on mobile.

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your homepage.

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
    "effect": { "type": "comet" }  // "none" | "stars" | "comet"
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

**Config versions:** this is config **v2**. A v1 file (no `version` field, with `backgroundColor` and `effects.particleBackground` / `effects.particleEffect`) still works unchanged — it is upgraded in memory on load. `id`s are optional when writing by hand (they are derived from the tab label / section type); they must be unique across the whole file if you set them.

**Validation:** the file is validated on load. An invalid section or tab is skipped and reported in the server log (`[Config] ...`) while the rest of the site keeps working; if the file as a whole is unusable, the last good config stays active.

**Gradient & background customization:**
- `titleGradient` — Array of color stops for the animated title text gradient. Omit or empty = solid color.
- `taglineGradient` — Color stops for the tagline gradient. Leave empty or omit to inherit `titleGradient` colors.
- `background.base` — `{ "type": "solid", "light": "#f3f4f6", "dark": "#111827" }` for the page background. Omit individual values to keep defaults.
- `background.effect.type` — Canvas particle layer: `"stars"` (default; flickering drifting circles), `"comet"` (3D comet starfield with motion trails) or `"none"`.

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
| `reactionFlyer` | boolean | `true` | Background emoji flyer — when someone reacts, an emoji flies up the screen (bottom→top) for all connected visitors. Toggle off to disable |

All effects default to `true` if omitted (except `widgetFrame`/`widgetFrameWidth`/`mouseTrail`). Set any to `false` to disable.

`progressGradientColors` accepts an array of CSS color strings. When unset it inherits `titleGradient` colors, falling back to a default blue→purple→pink gradient. On track change, the progress bar smoothly shrinks to the new position with burst sparkle particles.

`widgetFrame` can be set globally in effects or overridden per-section by adding `"widgetFrame": true` to individual section objects (discord-server, discord-user, steam, overwatch, markdown, meme, github, comments).

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
| `comments` | Guestbook widget: visitors post a name + comment, listed newest-first (open posting) | yes |
| `reactions` | Anonymous emoji reactions (toggle per emoji, rate-limited, background flyer on react) | yes |

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
- API caches data for 10 seconds
- Game box art is fetched from Steam CDN

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

**Caching:**
- API caches data for **24 hours**
- Refreshes automatically around 6 AM local time
- Stats older than 24 hours are considered stale

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

Lets visitors leave a name + comment on a guestbook tab. Posts are open (no account) but rate-limited per visitor and validated server-side.

**Config:** no environment variables needed

**Features:**
- Name input (max 40 chars) + comment textarea (max 500 chars)
- Posts via `POST /api/comments`, lists newest-first via `GET /api/comments?limit=N`
- Per-visitor rate limit (1 post / 5s) keyed by the `visitor_id` cookie, shared with the visitor counter
- Control characters stripped; XSS-safe rendering (plain React text, never `dangerouslySetInnerHTML`)
- Loading skeleton, empty state, and error fallback
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
| Discord/Steam/Overwatch (mount) | **REST** (server API snapshots) | `/api/presence`, `/api/steam`, `/api/overwatch` return the current in-memory server state so the widgets repopulate instantly on mount (e.g. after a tab switch remounts them) instead of waiting for the next re-broadcast |

---

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── homepage.json            # All site config
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md
│   │   └── about-example.md
│   ├── app/
│   │   ├── api/
│   │   │   ├── favicon/route.ts     # Animated SVG favicon fallback
│   │   │   ├── github/route.ts      # GitHub repo data (6h cache)
│   │   │   ├── markdown/route.ts    # Markdown API (server-rendered HTML, mtime-cached)
│   │   │   ├── meme/route.ts        # Random meme
│   │   │   ├── visitors/route.ts    # Visitor counter (SQLite, write-behind)
│   │   │   ├── comments/route.ts    # Guestbook comments (SQLite, GET list + POST create)
│   │   │   ├── reactions/route.ts   # Anonymous emoji reactions (SQLite, GET counts + POST/DELETE, broadcasts)
│   │   │   ├── presence/route.ts    # Snapshot of current Discord presence (reads in-memory server state)
│   │   │   ├── steam/route.ts       # Snapshot of current Steam data (reads in-memory server state)
│   │   │   └── overwatch/route.ts   # Snapshot of current Overwatch data (reads in-memory server state)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── loading.tsx              # Cold-load skeleton
│   │   └── page.tsx
│   ├── components/
│   │   ├── DiscordServer.tsx        # Discord server widget (60s client cache)
│   │   ├── DiscordUser.tsx          # Discord user presence
│   │   ├── SteamStatus.tsx          # Steam profile & games
│   │   ├── OverwatchStatus.tsx      # Overwatch stats
│   │   ├── MemeWidget.tsx           # Random meme
│   │   ├── MarkdownWidget.tsx       # Renders pre-rendered HTML
│   │   ├── VisitorCounter.tsx       # Visitor count
│   │   ├── CommentsWidget.tsx       # Guestbook: post + list visitor comments (SQLite)
│   │   ├── ReactionsWidget.tsx   # Anonymous emoji reactions (toggle, visitor-hash keyed, rate-limited, GUI lock)
│   │   │   ├── ReactionFlyer.tsx     # Background layer that flies an emoji up the screen when anyone reacts
│   │   │   ├── GitHubProjects.tsx    # GitHub repo cards
│   │   ├── Tabs.tsx                 # Tab navigation
│   │   ├── ParticleBackground.tsx   # Canvas particle effect (stars/comet modes)
│   │   ├── MouseTrail.tsx           # Canvas comet-style mouse trail (gradient line, idle = no draw)
│   │   ├── EffectsController.tsx    # Conditional effects renderer
│   │   └── FaviconAnimation.tsx     # Canvas animated favicon (self-healing)
│   ├── hooks/
│   │   └── useWebSocket.ts          # WebSocket hook (rAF-coalesced per type; supports `coalesce: false` for event streams)
│   ├── widgets/                     # Widget registry — one folder per section type
│   │   ├── <type>/meta.ts           # Options schema (zod), label, defaults, required env vars (server-safe)
│   │   ├── <type>/render.tsx        # How the section renders
│   │   ├── meta.ts                  # All widget metas + SectionSchema
│   │   ├── registry.tsx             # renderSection(): title row + gradient frame + widget body
│   │   └── shared.tsx / fields.ts / types.ts
│   └── lib/
│       ├── schema/                  # Config v2 schema (zod), v1→v2 migration, lenient parser
│       ├── config.ts                # mtime-cached homepage.json loader (migrates + validates)
│       ├── markdown.ts              # Server-side markdown → HTML (marked)
│       ├── db.ts                    # Shared better-sqlite3 connection (data/visitors.db, WAL)
│       └── visitor.ts               # visitor_id cookie + hashing helpers (shared by visitors/comments)
│   │   ├── reactions.ts             # DEFAULT_EMOJIS constant shared by API + widget
│   │   └── reaction-bus.ts          # broadcastReaction() — pushes a reaction to all WS clients via globalThis.__wssBroadcast
├── discord-presence.js              # Discord.js bot (in-process module)
├── websocket-server.js              # Custom server + WebSocket
├── docker-entrypoint.sh
├── Dockerfile
├── docker-compose-example.yml
├── .env.example
└── next.config.ts
```

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
- Named volume mounted at `/app/data` for everything written at runtime (`visitors.db`: visitor counter, comments, reactions). Override the location with `DATA_DIR`.
- Bind mounts for `src/config/` and `src/content/` (read-only for the public container, writable for the one serving the admin panel)

The example compose file starts two containers from the same image — the public site and the admin panel — sharing the data volume and the config/content folders, meant to sit behind one hostname with the proxy rule described under *Admin panel*. The comments in the file cover the own-port and single-container alternatives.

## Tech Stack

- **Next.js** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Discord API** - User presence & server widget
- **Steam API** - Game library
- **OverFast API** - Overwatch stats
- **GitHub API** - Repo data

## License

MIT
