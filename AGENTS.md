# Project Overview

Next.js 15 + TypeScript + Tailwind CSS homepage with Discord, Steam, Overwatch 2 status, and GitHub project cards. Tab-based UI with real-time WebSocket updates.

## Architecture

- **Frontend**: Next.js 15 App Router (`src/app/`), React 19, Tailwind CSS
- **Backend**: Custom Node.js WebSocket server (`websocket-server.js`) — wraps Next.js, adds WebSocket on same port, in-process requires `discord-presence.js`
- **Presence Module**: `discord-presence.js` — Discord.js bot, exports `start()` / `onPresenceUpdate()` / `getCurrentPresence()`. Websocket-server calls `start()` to begin tracking, subscribes via `onPresenceUpdate()` to receive raw presence in-process (no localhost WS hop).
- **Single container**: `docker-entrypoint.sh` runs only `websocket-server.js` in the foreground; the presence bot runs in-process.

## File Layout

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── favicon/route.ts     # Serves animated SVG favicon (fallback when no favicon set)
│   │   │   ├── github/route.ts      # GitHub repo data with 6h cache, 10m error cache
│   │   │   ├── markdown/route.ts    # Reads markdown from src/content/ at runtime, renders to HTML
│   │   │   ├── meme/route.ts        # Random meme from external API (NSFW/spoiler always filtered; popular mode supported)
│   │   │   ├── visitors/route.ts    # Visitor counter (SQLite, write-behind queue)
│   │   │   ├── comments/route.ts    # Guestbook comments (SQLite, GET list + POST create)
│   │   │   ├── reactions/route.ts   # Anonymous emoji reactions (SQLite, GET counts + POST/DELETE, broadcasts to all clients)
│   │   │   ├── presence/route.ts    # Snapshot of current Discord presence (force-dynamic; reads in-memory server state)
│   │   │   ├── steam/route.ts       # Snapshot of current Steam data (force-dynamic; reads in-memory server state)
│   │   │   └── overwatch/route.ts   # Snapshot of current Overwatch data (force-dynamic; reads in-memory server state)
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout, generateMetadata reads homepage.json
│   │   ├── loading.tsx              # Cold-load skeleton
│   │   └── page.tsx                 # Homepage — reads homepage.json at runtime via fs
│   ├── components/
│   │   ├── DiscordServer.tsx        # Discord server widget (client-side cache)
│   │   ├── DiscordUser.tsx          # Discord user presence (WebSocket subscriber, mobile indicator)
│   │   ├── SteamStatus.tsx          # Steam profile & games with achievement progress
│   │   ├── OverwatchStatus.tsx      # Overwatch 2 stats
│   │   ├── MemeWidget.tsx           # Random meme display
│   │   ├── MarkdownWidget.tsx       # Renders pre-rendered HTML from /api/markdown
│   │   ├── VisitorCounter.tsx       # Visitor count display
│   │   ├── CommentsWidget.tsx       # Guestbook: post + list visitor comments (SQLite)
│   │   │   ├── ReactionsWidget.tsx      # Anonymous emoji reactions (toggle, visitor-hash keyed, rate-limited, GUI lock)
│   │   │   ├── ReactionFlyer.tsx        # Background layer that flies an emoji up the screen when anyone reacts (WebSocket subscriber, coalesce:false)
│   │   ├── GitHubProjects.tsx       # GitHub repo cards (public API, no key needed)
│   │   ├── Tabs.tsx                 # Tab navigation w/ header + icon + sections
│   │   ├── ParticleBackground.tsx   # Canvas floating particles
│   │   ├── MouseTrail.tsx           # Canvas comet-style mouse trail (gradient line, no draw while stationary)
│   │   ├── EffectsController.tsx    # Conditionally renders effects based on config
│   │   └── FaviconAnimation.tsx     # Canvas-based animated favicon (hidden canvas → PNG data URL, self-healing)
│   ├── config/
│   │   ├── homepage.json            # ALL site config: name, tagline, favicon, tabs
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md                 # Runtime markdown (not bundled)
│   │   └── about-example.md
│   ├── hooks/
│   │   └── useWebSocket.ts          # Singleton WebSocket hook (rAF-coalesced per type; supports `coalesce: false` for event streams like reaction flyers)
│   ├── lib/
│   │   ├── config.ts                # mtime-cached homepage.json loader
│   │   ├── db.ts                    # Shared better-sqlite3 connection (visitors.db, WAL)
│   │   └── visitor.ts               # visitor_id cookie + hashing helpers (shared by visitors/comments)
│   │   │   ├── reactions.ts             # DEFAULT_EMOJIS constant shared by API + widget
│   │   │   └── reaction-bus.ts          # broadcastReaction() — pushes a reaction to all WS clients via globalThis.__wssBroadcast
│   └── types/
│       ├── gray-matter.d.ts
│       └── quantize.d.ts
├── discord-presence.js              # Discord.js bot (in-process; exports start/onPresenceUpdate)
├── websocket-server.js              # Custom Next.js server + WebSocket
├── docker-entrypoint.sh             # Execs websocket-server (presence runs in-process)
├── Dockerfile                       # Multi-stage: deps → builder → runner
├── docker-compose-example.yml
├── .env.example
└── next.config.ts
```

## Configuration

### Environment Variables (`.env`) — all configs that contain secrets:

| Variable | Purpose |
|---|---|
| `HOST` | Server bind address (default: `0.0.0.0`) |
| `PORT` | Web server port (default: `3000`) |
| `DISCORD_SERVER_ID` | Discord server widget ID |
| `DISCORD_USER_ID` | User to track for presence |
| `DISCORD_BOT_TOKEN` | Discord bot token (needs Presence Intent + Server Members Intent) |
| `STEAM_API_KEY` | Steam API key |
| `STEAM_ID` | Steam 64-bit ID |
| `OVERWATCH_BATTLE_TAG` | Overwatch battle tag (e.g. `User-12345`) |
| `VISITOR_SALT` | Salt for visitor ID hashing |

### homepage.json — content config (no secrets):

| Field | Description |
|---|---|
| `name` | Site title (HTML `<title>`, page h1) |
| `tagline` | Page subtitle, also used as `<meta name="description">` |
| `favicon` | URL for favicon (optional, empty/omit = auto-generated animated gradient ring using `titleGradient` colors) |
| `titleGradient` | Array of CSS color stops for title gradient text; omit or empty = solid color |
| `taglineGradient` | Array of CSS color stops for tagline gradient; empty array or omit = inherits `titleGradient` |
| `backgroundColor` | Object with `light` and `dark` hex colors for page background (defaults: `#f3f4f6` / `#111827`) |
| `effects` | Object toggling visual effects — see Effects section below |
| `tabs` | Array of tab objects |

### Effects Config:

| Field | Type | Default | Description |
|---|---|---|---|
| `particleBackground` | boolean | `true` | Canvas particle effect — master toggle |
| `particleEffect` | string | `"stars"` | Particle visual mode: `"stars"` (flickering drifting circles) or `"comet"` (3D comet starfield with motion trails) |
| `gradientBorders` | boolean | `true` | Animated gradient border + subtle scale on hover for link cards, buttons, GitHub project cards, Steam "View Profile", and Meme "New Meme" |
| `tabTransitions` | boolean | `true` | Smooth crossfade when switching tabs |
| `customScrollbar` | boolean | `true` | Thin rounded scrollbar styling |
| `progressGradient` | boolean | `true` | Animated gradient fill on music activity progress bar + tiny sparkle particles at the current position |
| `progressGradientColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the progress bar; falls back to `titleGradient` colors, then to a default blue→purple→pink gradient |
| `widgetFrame` | boolean | `false` | Animated gradient frame around widget sections (discord-server, discord-user, steam, overwatch, markdown, meme, github, comments) using title gradient colors. Can be overridden per section with a `widgetFrame` field on the section object. |
| `widgetFrameWidth` | number | `2` | Border width in pixels for the widget gradient frame |
| `mouseTrail` | boolean | `false` | Comet-style mouse trail — continuous tapering gradient line following the cursor (no trail drawn while stationary) |
| `mouseTrailColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the mouse trail; falls back to `titleGradient` colors, then to a default blue→purple→pink gradient |
| `faviconAnimation` | boolean | `true` | Animated gradient-ring favicon (canvas → PNG data URL per frame). Set to `false` to use the static SVG favicon from `/api/favicon` — useful to silence the per-frame `<link href>` churn in DevTools while debugging. |
| `reactionFlyer` | boolean | `true` | Background emoji flyer — when someone reacts, an emoji flies up the screen (bottom→top) for all connected visitors. Toggle off to disable. |

### Tab sections types:

- **header** — Big title with icon
- **text** — Paragraph with icon, optional `align` (left/center/right)
- **links** — Row of link cards (items: label, url, icon, style: primary/secondary, invertDark; optional: text, icon, invertDark for section title)
- **discord-server** — Discord server widget (uses DISCORD_SERVER_ID)
- **discord-user** — Discord user presence (WebSocket subscriber, shows phone icon on mobile)
- **steam** — Steam profile & games (includes achievement progress for recent and top games)
- **overwatch** — Overwatch 2 competitive stats
- **markdown** — Renders `content/<file>.md` via `/api/markdown?file=<file>`
- **meme** — Random meme from external API (supports `popular` flag; NSFW/spoiler always filtered server-side)
- **github** — GitHub project cards (repos: [{ owner, repo, label?, note? }])
- **comments** — Guestbook widget (repos: none; optional `limit` for max comments fetched, default 50). Posts via `/api/comments`, lists newest-first.
- **reactions** — Anonymous emoji reactions (repos: none; optional `emojis` array overriding `DEFAULT_EMOJIS`). Toggle per emoji keyed by `visitor_hash`; a new reaction broadcasts `{type:"reaction", emoji}` to all clients for the background flyer (`effects.reactionFlyer`).

## Critical Gotchas

### `HOST` vs `HOSTNAME`
- `HOSTNAME` is a standard Unix env var set to the machine's hostname (e.g. `bazzite`). **Do not use it** as a config key.
- The bind address env var is called `HOST`.

### homepage.json is runtime, not bundled
- Read via `fs.readFileSync` in `src/lib/config.ts` (mtime-cached; re-parsed only when the file's mtime changes).
- Imported by `src/app/page.tsx` and `src/app/layout.tsx`.
- `export const dynamic = "force-dynamic"` prevents static prerendering.
- Allows editing without rebuild; can be volume-mounted in Docker.

### Background uses solid colors, not gradients
- `main` and tab bar use `bg-gray-100 dark:bg-gray-900` instead of gradients.
- CSS `transition: background-color 500ms ease` animates solid colors smoothly.
- Gradients (`background-image`) cannot be transitioned in CSS — they would pop instantly.
- The animated gradient effect is applied only to text via `background-clip: text`.

### Pulse glow uses CSS variable for color
- `@keyframes pulse-glow` uses `--glow-color` CSS variable (default: Discord green).
- Set `style={{ '--glow-color': 'rgba(...)' } as React.CSSProperties}` to customize per element.
- Steam applies blue glow for Online, green glow for In Game. Discord uses default green.
- Available via `animate-pulse-glow` class.

### Markdown files are runtime, not bundled
- API route `/api/markdown` reads `src/content/` via `fs.readFileSync` at request time.
- Renders to HTML server-side via `src/lib/markdown.ts` (using `marked`); mtime-cached.
- Sets `Cache-Control: public, max-age=300` and `export const revalidate = 300`.
- Client renders the returned HTML via `dangerouslySetInnerHTML` — `react-markdown` / `remark-gfm` are not in the client bundle.

### GitHub API caching
- `/api/github` fetches repo data server-side and caches successfully in-memory for 6 hours.
- Failed fetches are cached for 10 minutes to avoid hammering GitHub on retries.
- Error cards still render with repo name/note and a "Failed to load" message.

### Tab transitions are sequential
- `Tabs.tsx` uses a 3-phase transition: fade out → wait → swap content → next frame → fade in.
- A `transitioning` ref prevents double-clicks during the animation.
- Configurable via `enableTransitions` prop from `effects.tabTransitions` in homepage.json.
- Fade duration: 100ms (Tailwind `duration-100` on the wrapper). Swap delay: 200ms after fade-out starts. Double `requestAnimationFrame` after the swap ensures the browser has painted the new content before fading in.
- **Critical**: The `useEffect` that syncs `mountedTab` to the `?tab=` URL param must be guarded with `if (transitioning.current) return;`. Without this guard, `router.push()` in `handleTabClick` updates the URL, the effect fires immediately, and calls `setMountedTab(index)` — causing the content to swap at click time (during the fade-out) instead of after the swap delay. No amount of increasing the delay will fix it, because the swap happens via a different code path.

### Particle twinkle
- Each particle has its own `twinkleSpeed` and `twinklePhase`.
- Opacity oscillates between 80–100% of base opacity using `sin(time)` for a subtle star-like twinkle.

### Activity identity key
- `getActivityKey` uses only `${application_id}-${name}` (stable identity), excluding `state`/`details`.
- Song changes (same app, different track) keep the same key → content updates in place with no shrink/enlarge animation.
- Changing apps (e.g., Spotify → game) generates a different key → proper leave/enter animations.
- Image cooldown keys use the image URL (`album-${url}`, `small-${url}`) instead of activity key, so new album art isn't blocked by a previous failed load.

### Leaving activity lifecycle
- 0–800ms: `animate-shrink` class plays — CSS keyframes `shrink` (700ms ease-in, `forwards` fill): shrinks horizontally first (30%), then vertically to 0.
- 800–1100ms: `collapsedKeys` state set — card gets inline `width: 0px` with `transition: width 0.3s ease-out` and `transform: scale(0,0)`. The `animate-shrink` class stays throughout to prevent pop-back.
- At 1100ms: `collapsedKeys` cleared, `leavingActivities` entry removed, stashed data applied, entering keys computed.
- `pendingDataRef` guards mid-transition WebSocket messages — latest data stored, processing skipped until current animation completes. Only the latest pending message is applied (overwrites on subsequent messages).
- Width calculation uses `activeCards` (non-collapsed cards only), so remaining cards smoothly expand into vacated space during the collapse phase.
- **Critical**: activities must render in their **original flex order** (one `allActivities.map()`). Never split into separate `nonLeaving` and `leavingActivities` groups — that moves the leaving card to the end of the flex container, causing remaining cards to jump position before the collapse animation plays. Each card checks `leavingKeySet.has(key)` to decide its animation, preserving DOM order.

### Entering activity lifecycle
- New activities get `animate-enlarge` class — CSS keyframes `enlarge` (700ms ease-out, `forwards` fill): starts at scale(0,0), expands vertically first (70%), then horizontally to full size.
- `enteringKeys` state holds the keys for 800ms, then cleared.
- First data load skips entering animations entirely via `isFirstDataRef` — initial connection has no enter animations.

### Crossfade content update (same activity, changed content)
- Triggered when details, state, or album URL change for a stable activity (not leaving, entering, or collapsed).
- Only fires when no crossfade is already active for that key (prevents stacking).
- Timing: old content fades out (250ms), then new content fades in (300ms). Total: 550ms, then crossfade data cleaned up.
- Old details/state text rendered in `absolute inset-0 pointer-events-none` inside a `relative` container (overlays new text without affecting layout height).
- New text flows naturally providing layout height. Old text fades out on top.
- Album art uses same pattern: old image `absolute inset-0` inside `relative w-16 h-16`, new image renders below it.
- `prevContentRef` is NOT updated during a crossfade — keeps the "from" state until crossfade completes.
- Progress bar gets `transition: width 0.5s ease-out` (and sparkle position `transition: left 0.5s ease-out`) during crossfade to smoothly shrink from old position. Normal ticks use `transition: none`.

### Progress bar gradient + sparkles
- Music activities (type 2 or "youtube music") with timestamps get an animated gradient progress bar.
- `animate-gradient-bar` class: horizontal gradient shifted via `gradient-shift` 3s animation.
- Colors come from `effects.progressGradientColors` → `titleGradient` → default blue→purple→pink.
- When `progressGradient` is `false`, falls back to solid `bg-[#5865F2]` (Discord blurple) with no sparkles.
- Continuous random spark particles via the `ProgressSparkles` component (defined in `DiscordUser.tsx`): spawns at random intervals (60–200ms via recursive `setTimeout`) with random angle in the right-side half-circle range (-10° to -90° from horizontal), random distance (18–46px), random size (2–4.5px), random color from the gradient palette. Trajectory driven by CSS custom properties `--spark-x` / `--spark-y` on a single `spark-particle` keyframe. Each spark self-removes after 1s.
- Progress percentage extracted as `progressPct` local variable to keep fill width and sparkle position aligned.
- **Diminish on track change**: When a new song starts (crossfade), the progress bar fill gets `transition: width 0.5s ease-out` and the sparkle container gets `transition: left 0.5s ease-out` so both smoothly animate from the old position to the new (usually ~0%). Normal per-second ticks have `transition: none` to avoid lag.
- **Burst sparkles**: During crossfade, 24 one-shot burst particles (`spark-blaze-1` through `spark-blaze-24` keyframes in globals.css, 0.4–0.6s ease-out, not `infinite`) explode outward from the progress position in varied directions with sizes 2.5–5px and staggered delays 0.02–0.46s for an intense spark effect as the bar shrinks.

### Activity card layout
- Card is `h-20` (80px) with `p-2` (8px), so content area is 64px.
- Activity image is `w-16 h-16` (64px square), filling the entire content area height.
- Card uses `flex items-start` so text aligns to top; image stays anchored to top via fixed `h-16`.
- Images use `object-contain` to show the entire asset without cropping, preserving aspect ratio inside the square container.
- All text elements (name, details, state) use `truncate` for `text-overflow: ellipsis` — text never wraps.
- Text that overflows gets `...` instead of changing the image's square shape.

### Activity badge (corner icon) positioning
- The corner badge (`w-6 h-6`, 24px) is positioned at `-bottom-1 -right-1` (4px outside the image container). This centers the badge such that the container corner at (64,64) falls within the 12px radius (distance = √(8²+8²) ≈ 11.31px < 12px).
- The outer image container (`w-16 h-16`) must NOT have `overflow-hidden` — it's moved to an `absolute inset-0` inner wrapper that clips only the album art images. This lets the badge extend past the container bounds without being clipped.

### Small image nested inside badge
- The small image overlay (formerly a separate `absolute -bottom-0.5 -right-0.5 w-5 h-5` element) now renders inside the badge div at `w-5 h-5` centered via the badge's `flex items-center justify-center`.
- When `smallImageUrl` is available, it replaces the emoji icon inside the badge. When unavailable, the emoji fallback shows. This eliminates two overlapping circles at different sizes fighting for the same corner position.

### Emoji centering in activity badge
- Emojis have inconsistent internal vertical spacing. Per-emoji `offsetY` adjustments are applied via `translateY` on a `flex items-center justify-center w-full h-full` span.
- Defined in the `ACTIVITY_EMOJIS` lookup table:

  | Type | Emoji | offsetY |
  |------|-------|---------|
  | 0 (Game) | 🎮 | -3px |
  | 2 (Music) | 🎵 | 0 |
  | 1 (Stream) | 📺 | 0 |
  | 3 (Music) | 🎵 | 0 |
  | 4 (Custom) | 💬 | 0 |
  | 5 (Stream) | 📺 | 0 |

### npm overrides
- `package.json` overrides `undici@^6.27.0` to fix high-severity vulns without breaking `discord.js`.

### Docker build requires native modules
- `better-sqlite3` and `sharp` need `build-base` + `python3` (already in Dockerfile).

### Discord presence reconnection
- `discord-presence.js` `start()` is re-entrant — destroys the old client before creating a new one, so it can be safely called again after a failure.
- `clientReady` stores the `fetchUserPresence` interval in `fetchInterval` and clears any previous one before creating a new, preventing interval leaks across reconnects.
- `invalidated` event handler triggers `scheduleRestart()` — destroys the client, nulls it, waits 5s, then calls `start()` again.
- Login failure retries after 30s via `setTimeout(() => start(), 30000)` instead of giving up silently.
- A 60s health check interval calls `client.isReady()` and triggers `scheduleRestart()` if the client is stuck (connected but not ready).
- `scheduleRestart()` calls `clearIntervals()`, destroys the client, resets `userPresence` to `emptyPresence()`, then re-calls `start()` after a delay.
- `stop()` clears both `fetchInterval` and `healthCheckInterval` before destroying the client.

### WebSocket data flow
1. `discord-presence.js` connects to Discord Gateway, receives presence events.
2. Calls registered callbacks in-process (no localhost WS hop).
3. `websocket-server.js` enriches + relays to all connected browser clients.
4. React components (`DiscordUser`, `SteamStatus`, `OverwatchStatus`) subscribe via `useWebSocket` hook.
5. `useWebSocket` coalesces messages per `type` within a `requestAnimationFrame` tick, so a burst of updates results in a single React render per subscriber. Pass `coalesce: false` when every message matters (e.g. `ReactionFlyer` for reaction events).
6. **Reactions**: `POST /api/reactions` (on a new, non-duplicate insert) calls `broadcastReaction()` → `globalThis.__wssBroadcast` in `websocket-server.js` → pushes `{ type: "reaction", emoji }` to every connected client. `ReactionFlyer` is a non-coalescing subscriber that spawns a flying emoji. The three snapshot routes (`/api/presence`, `/api/steam`, `/api/overwatch`) read the in-memory server state via `globalThis.__serverSnapshots` so the widgets repopulate instantly on mount (e.g. after a tab switch remounts them) instead of waiting for the next periodic re-broadcast.

### Steam achievements
- `websocket-server.js` fetches achievement data for all games in both `recentGames` and `ownedGames` via `ISteamUserStats/GetPlayerAchievements/v0001/`.
- Games are deduplicated by `appid` before fetching — recent and top games often overlap.
- Achievement data is cached in `steamAchievementCache` Map with a 10-minute TTL per game.
- Refresh runs on a separate 10-minute interval (independent of the 10s game list refresh).
- `refreshSteam()` triggers `refreshSteamAchievements()` after the first successful broadcast, ensuring achievements are fetched within ~10s of startup (not 10 minutes).
- Concurrency-limited to 3 simultaneous API calls to avoid rate-limiting.
- Failed fetches (game has no achievements, private profile, etc.) log the error with HTTP status and response body, then return `null` and are not cached.
- Games without stats/achievements return HTTP 400 (`"Requested app has no stats"`) — these are silently skipped.
- **Privacy requirement**: The Steam profile's "Game details" must be set to **Public** for the `GetPlayerAchievements` API to work. If private, the API returns HTTP 403 with `{"playerstats":{"error":"Profile is not public","success":false}}` in the response body.
- Achievement data merges into the existing `{ type: 'steam', data }` WebSocket message — no new message type.
- `steamData.achievements` is a `Record<number, { total, unlocked, recent }>` keyed by appid.
- On new client connection, achievement data is included in the initial steam message.
- `SteamStatus.tsx` displays a thin gradient progress bar + "X/Y unlocked" below each game card.
- Hover popup uses `createPortal` to `document.body` (escapes parent `overflow-hidden` clipping) with `position: fixed`. A `useEffect` listens to `scroll` (capture phase) and `resize` events to recalculate `popupRect` via `getBoundingClientRect`, keeping the popup pinned to the game card during scrolling.
- Popup has `min-w-[220px]` and shows "Playtime" and "Achievements" subsection titles, a larger progress bar with percentage, and up to 3 recent achievements (icon + name).
- Progress bar uses the same gradient colors as the music progress bar (`progressGradientColors` → `titleGradient` → default blue→purple→pink).

### Server-side logging
- All server-side logging uses raw `console.log`/`console.error`/`console.warn` with timestamp prefix: `[${new Date().toISOString()}] [Tag]`.
- No centralized logging utility or external dependencies (winston, pino, etc.) are used.
- **`websocket-server.js`** logs cover:
  - Album cover fetching: source success/failure (iTunes, Deezer, MusicBrainz)
  - Game icon fetching: Steam Store and RAWG API errors
  - Steam data: player data fetch errors, recently played/owned games fetch errors, game name lookup failures
  - Discord enrichment: activity count processed, backpressure queuing
  - Data refresh: "No changes detected" when hash is unchanged (Steam, Overwatch)
  - WebSocket: client connect/disconnect, upgrade path routing
- **`discord-presence.js`** logs cover:
  - Client lifecycle: login, bot ready, destroy, shutdown
  - Shard events: disconnect, reconnect, ready
  - Presence: update received, nickname changes
  - Callbacks: registered/unregistered with subscriber count
  - Health checks and restart scheduling

### Mobile presence detection
- `discord-presence.js` passes `clientStatus` from Discord's API.
- `websocket-server.js` forwards it to the browser in enriched presence data.
- `DiscordUser` shows a phone icon (Discord's own SVG path) when status is mobile-only.
- Status text appends " · On Mobile" when mobile-only.

### Docker persistence
- `visitors.db` is ephemeral in the container — `docker-compose-example.yml` mounts a named volume to persist it.
- `src/config/` and `src/content/` can be bind-mounted at runtime for live config edits without rebuild.

### Comments guestbook (`comments` section + `/api/comments`)
- Comments are stored in the **same** `visitors.db` SQLite file as the visitor counter, in a `comments` table (columns: `id`, `name`, `body`, `created_at`). The shared connection lives in `src/lib/db.ts` (WAL mode); both `/api/visitors` and `/api/comments` call `getDb()` so there is exactly one connection per process.
- `src/lib/visitor.ts` holds the shared `visitor_id` cookie logic (name, salt, hashing, parsing) used by both routes for identification and rate-limiting.
- **POST `/api/comments`**: body `{ name, body }` (both trimmed, required). Server validates name ≤ 40 chars, body ≤ 500 chars, strips control characters (`\u0000-\u001f`, `\u007f`), and rate-limits per hashed `visitor_id` to one post / 5s. A new `visitor_id` cookie is set if absent. Returns `201` with the created row.
- **GET `/api/comments?limit=N`**: returns the most recent `N` comments newest-first (`ORDER BY id DESC`), `limit` clamped to 1–200 (default 50).
- **XSS safety**: `CommentsWidget` renders `name` and `body` as plain React text (`whitespace-pre-wrap break-words`) — never `dangerouslySetInnerHTML` — so user input cannot inject markup. All length/clamp limits are re-enforced server-side, not just client-side.
- v1 is **open posting** (no moderation). Spam protection is the per-visitor rate limit only; add pre-moderation/blocklist if needed later.
- The `comments` section is wrapped by `maybeWrapFrame` in `Tabs.tsx`, so `widgetFrame`/`widgetFrameWidth` apply like other widgets. The section title (`icon`/`text`) renders above the frame, consistent with `discord-user`/`steam`/etc.

### Reactions (`reactions` section + `/api/reactions`)
- Anonymous emoji reactions — an alternative to leaving a comment. A visitor taps an emoji to react; no name/body required.
- Stored in the **same** `visitors.db` SQLite file, in a `reactions` table (`id`, `emoji`, `visitor_hash`, `created_at`) with a `UNIQUE(emoji, visitor_hash)` constraint so each visitor reacts once per emoji. The shared connection lives in `src/lib/db.ts`.
- `src/lib/reactions.ts` holds the `DEFAULT_EMOJIS` list (shared by the API validation and the widget). The section config may override with an `emojis` array.
- **GET `/api/reactions`**: returns per-emoji `counts` plus the `reacted` list (the emojis the current `visitor_id` has already reacted to, derived from the cookie) so the widget is authoritative and survives across reloads/devices sharing the cookie.
- **POST `/api/reactions`**: body `{ emoji }`. Server validates the emoji is in the allowed set, then `INSERT OR IGNORE`. Only a genuinely new row (`changes > 0`) triggers `broadcastReaction(emoji)` → a real-time flyer for all connected visitors. Returns updated `counts` + `reacted`.
- **DELETE `/api/reactions`**: body `{ emoji }`. Removes the visitor's reaction row; returns updated `counts` + `reacted`.
- **Rate limit**: a global `RATE_LIMIT_MS` (250ms) per hashed `visitor_id`. A `429` is not a hard failure — `ReactionsWidget` retries the request after the window elapses so the visitor's intent is honored rather than dropped, and the whole widget stays locked (grayed out) until the request resolves, matching the rate-limit window.
- **Keyed by visitor hash, not localStorage**: the `reacted` state comes from the server (`GET`/`POST`/`DELETE` responses), not client storage, so toggling is consistent with the `UNIQUE` constraint.
- **Real-time flyer**: on a new reaction the server broadcasts `{ type: "reaction", emoji }` to every client. `ReactionFlyer` (rendered by `EffectsController` when `effects.reactionFlyer` is not `false`) subscribes with `coalesce: false` and spawns an emoji that animates bottom→top in the background; capped at 40 concurrent, removed on animation end.
- The `reactions` section is wrapped by `maybeWrapFrame` in `Tabs.tsx`, so `widgetFrame`/`widgetFrameWidth` apply like other widgets.

### Gradient widget frame stacking
- `.gradient-frame::before` needs `z-index: 1` and `.gradient-frame` needs `isolation: isolate` because Next.js `Image fill` uses `position: absolute`, putting it in the same stacking level as the `::before`. Without these, the image renders on top of the gradient border at the left/right edges of full-width content like the Discord banner.
- When `widgetFrame` is enabled on a `discord-user` section, DiscordUser receives a `framed` prop. When `framed`, it removes its own inner `border` (redundant with the gradient frame) and adds `paddingTop: var(--gf-width, 2px)` so the widget's background creates a clean gap between the gradient border and the full-width banner at the top.

### `framed` prop on DiscordUser
- `DiscordUser` accepts a `framed` boolean prop. When `true`: no `border` classes applied, and `paddingTop: var(--gf-width, 2px)` added via inline style. The CSS variable cascades from the `.gradient-frame` wrapper which sets `--gf-width`.
- Passed from `Tabs.tsx` as `framed={section.widgetFrame ?? widgetFrame}`.
- The loading skeleton, error fallback, and main render all handle `framed` identically.

### Meme widget frame wraps only the image, not the whole widget
- `MemeWidget` accepts `widgetFrameEnabled`, `widgetFrameWidth`, `widgetFrameGradient` props directly (not wrapped by `maybeWrapFrame`).
- When enabled, the `gradient-frame` class and CSS variables are applied only to the image container `<div>`, leaving the title, metadata, and "New Meme" button outside the framed area.

### Meme API always filters NSFW, and de-duplicates via client history
- `/api/meme` fetches a batch of 50 from `meme-api.com`, then **always** filters out `nsfw` and `spoiler` memes before returning anything — this runs in both default and `popular` modes, so NSFW can never be served.
- **Default mode** (`popular` not set): the safe batch is shuffled and returned as a `memes` array; the client picks a random entry that is not in the 30-entry `historyRef` (falling back to a full reset when the pool is exhausted). The `meme` section's `popular` flag (default `false`) controls this.
- **Popular mode** (`popular: true`): the safe batch is sorted by `ups` descending and the top 30 returned as `memes`; the client walks the list, showing the highest-`ups` entry not already in `historyRef`, so rerolling advances to the next most-popular unseen meme instead of looping the same few.
- `MemeWidget` keeps the loading placeholder (`imgLoaded` state) until the `<img>` `onLoad` fires, so the new meme is only revealed once the browser has actually downloaded it.
- The title is rendered as a link to the meme's Reddit `postLink` (new tab).

### ParticleBackground must only render once
- `ParticleBackground` is rendered conditionally by `EffectsController` (based on `effects.particleBackground` in `homepage.json`).
- It must **not** also be rendered unconditionally in `src/app/layout.tsx` — doing so produces two canvas elements animating on top of each other, doubling GPU/CPU cost.
- `EffectsController` is the single source of truth for when the particle background is active.

### MouseTrail performance + layering
- `MouseTrail` is rendered conditionally by `EffectsController` (based on `effects.mouseTrail` in `homepage.json`), default `false`.
- It is a `fixed` transparent overlay with `pointer-events-none z-50` — above content but non-interactive, so it reads as a cursor effect.
- Drawn as a **single gradient path** (one `createLinearGradient` + two stroke passes: soft glow + bright core) — never per-segment `shadowBlur` strokes, which were too expensive. When the cursor is stationary the trail draws nothing (existing points simply decay and the line fades out).
- A `moved` flag ensures points are only pushed on frames where the cursor actually moved, so idle frames do zero trail work.
- `EffectsController` is the single source of truth for when the trail is active; do not also render it elsewhere.

### Default favicon animation
- When `favicon` is empty/omitted in `homepage.json`, the favicon is animated by the `FaviconAnimation` client component (a `<canvas>` → PNG data URL per frame). The server-side SVG at `/api/favicon` (set via `generateMetadata`) is the SSR/non-JS fallback favicon only.
- **Why not pure animated SVG?** Chromium-based browsers (Chrome/Edge) do not animate SMIL SVG favicons at all — "Support animated webpage icon" is a still-open Chromium feature request, and animated GIF/APNG favicons are also ignored. So a frame-free animated favicon is impossible in Chromium; the canvas data-URL approach is the only reliable method.
- **Dev vs prod / debugging:** `FaviconAnimation` runs whenever `effects.faviconAnimation` (default `true`) is enabled. Because it mutates `<link href>` every frame, it floods DevTools and makes the rest of the DOM hard to inspect — set `effects.faviconAnimation: false` in `homepage.json` while debugging to fall back to the static SVG favicon from `/api/favicon`. The animation still runs in production by default.
- **Self-healing (fixes the old "stops animating" bug):** `FaviconAnimation` marks its own `<link rel="icon" data-anim-favicon>` node and re-acquires it every frame (`link.isConnected` check) — so when Next.js re-renders `<head>` on client-side navigation (the Tabs `?tab=` `router.push` does this) and replaces the icon node, the loop seamlessly switches to the new live node instead of writing to a detached one. It also prunes any other `rel="icon"` link Next injects, so the animated link is always the only/last one shown. The rAF loop is wrapped in try/catch (an exception can't kill it), restarts on `visibilitychange` when the tab becomes visible, and uses a time-based angle so speed is consistent regardless of frame rate. It is throttled to ~20fps to limit work.
- The canvas draws a conic-gradient ring (sweeping via `createConicGradient` start angle) using `titleGradient` colors. The first color is duplicated at position `1.0` to avoid a seam. Falls back to `["#60a5fa", "#a78bfa", "#f472b6"]` if no gradient is configured.
- Note: this approach updates `link.href` with a data URL each frame (client-local work; the server pushes nothing). If a frame-free favicon is required later, it depends on browser support for animated SVG/GIF favicons.

### ParticleBackground mobile performance
- Canvas uses `transform: translate3d(0,0,0)` in its inline style to promote it to its own GPU compositor layer, so the browser doesn't repaint the page underneath on every frame.
- `getCount()` reduces the particle multiplier from 0.04 to 0.025 and the cap from 60 to 30 on screens < 640px.
- A `visibilitychange` listener cancels the `requestAnimationFrame` loop when `document.hidden` is true and resumes it when the tab becomes visible again — saves battery/CPU when the user switches away.

### Particle system modes (`particleEffect`)
- `"stars"` — Original 2D mode: circles with velocity drift that wrap at screen edges, opacity-based twinkle (`0.8 + 0.2 * sin(t)`).
- `"comet"` — 3D starfield mode: particles have (x, y, z) coordinates projected to 2D via `FOCAL / z`. Moving toward viewer (z decreases), they grow and move outward from center. Semi-transparent overlay (`TRAIL_ALPHA = 0.3`) replaces `clearRect` for motion blur trails. Each comet is drawn as a 4-pointed asymmetrical star stretched along a `dirAngle` (radial from screen center), with elongation controlled by `stretch = min(1, radialDist / 0.4)` — particles near the viewing axis stay symmetrical, off-axis ones elongate to a comet. Each particle has a fixed `brightness` (no flicker) for natural variation. `baseSize` scales with `FOCAL / z` so close particles appear larger.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev with WebSocket server (presence bot in-process if env set) |
| `npm run build` | Next.js production build |
| `npm run start` | Production start (websocket-server.js) |

## Docker

- Single container, multi-stage build.
- `docker-entrypoint.sh` execs `websocket-server.js` in the foreground; `discord-presence.js` runs in-process.
- `docker-compose-example.yml` includes named volume for `visitors.db` and optional bind mounts for config/content.
- Traefik recommended as reverse proxy.
- `.dockerignore` includes node_modules, .next, .env, visitors.db.
