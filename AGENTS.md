# Project Overview

Next.js 15 + TypeScript + Tailwind CSS homepage with Discord, Steam, Overwatch 2 status, and GitHub project cards. Tab-based UI with real-time WebSocket updates.

## Architecture

- **Frontend**: Next.js 15 App Router (`src/app/`), React 19, Tailwind CSS
- **Backend**: Custom Node.js WebSocket server (`websocket-server.js`) — wraps Next.js, adds WebSocket on same port
- **Presence Bot**: `discord-presence.js` — Discord.js bot that tracks user presence, pushes to WebSocket server via `ws://localhost:<port>`
- **Single container deploys both** — entrypoint runs presence bot in background, then execs websocket-server in foreground

## File Layout

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── github/route.ts      # GitHub repo data with 6h cache, 10m error cache
│   │   │   ├── markdown/route.ts    # Reads markdown from src/content/ at runtime
│   │   │   ├── meme/route.ts        # Random meme from external API
│   │   │   └── visitors/route.ts    # Visitor counter (SQLite)
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout, generateMetadata reads homepage.json
│   │   └── page.tsx                 # Homepage — reads homepage.json at runtime via fs
│   ├── components/
│   │   ├── DiscordServer.tsx        # Discord server widget
│   │   ├── DiscordUser.tsx          # Discord user presence (WebSocket subscriber, mobile indicator)
│   │   ├── SteamStatus.tsx          # Steam profile & games
│   │   ├── OverwatchStatus.tsx      # Overwatch 2 stats
│   │   ├── MemeWidget.tsx           # Random meme display
│   │   ├── MarkdownWidget.tsx       # Fetches from /api/markdown, renders react-markdown
│   │   ├── VisitorCounter.tsx       # Visitor count display
│   │   ├── GitHubProjects.tsx       # GitHub repo cards (public API, no key needed)
│   │   ├── Tabs.tsx                 # Tab navigation w/ header + icon + sections
│   │   ├── ParticleBackground.tsx   # Canvas floating particles
│   │   └── EffectsController.tsx    # Conditionally renders effects based on config
│   ├── config/
│   │   ├── homepage.json            # ALL site config: name, tagline, favicon, tabs
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md                 # Runtime markdown (not bundled)
│   │   └── about-example.md
│   ├── hooks/
│   │   └── useWebSocket.ts          # Singleton WebSocket hook
│   └── types/
│       ├── gray-matter.d.ts
│       └── quantize.d.ts
├── discord-presence.js              # Discord.js bot
├── websocket-server.js              # Custom Next.js server + WebSocket
├── docker-entrypoint.sh             # Starts presence bg, execs websocket-server
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
| `PRESENCE_PORT` | Internal WebSocket port for presence data (default: `3001`) |
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
| `favicon` | URL for favicon (optional, empty = default) |
| `titleGradient` | Array of CSS color stops for title gradient text; omit or empty = solid color |
| `taglineGradient` | Array of CSS color stops for tagline gradient; empty array or omit = inherits `titleGradient` |
| `backgroundColor` | Object with `light` and `dark` hex colors for page background (defaults: `#f3f4f6` / `#111827`) |
| `effects` | Object toggling visual effects — see Effects section below |
| `tabs` | Array of tab objects |

### Effects Config:

| Field | Type | Default | Description |
|---|---|---|---|
| `particleBackground` | boolean | `true` | Floating canvas particles with star-like twinkle, adapts to light/dark mode |
| `gradientBorders` | boolean | `true` | Animated gradient border + subtle scale on hover for link cards, buttons, GitHub project cards, Steam "View Profile", and Meme "New Meme" |
| `tabTransitions` | boolean | `true` | Smooth crossfade when switching tabs |
| `customScrollbar` | boolean | `true` | Thin rounded scrollbar styling |
| `progressGradient` | boolean | `true` | Animated gradient fill on music activity progress bar + tiny sparkle particles at the current position |
| `progressGradientColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the progress bar; falls back to `titleGradient` colors, then to a default blue→purple→pink gradient |
| `widgetFrame` | boolean | `false` | Animated gradient frame around widget sections (discord-server, discord-user, steam, overwatch, markdown, meme, github) using title gradient colors. Can be overridden per section with a `widgetFrame` field on the section object. |
| `widgetFrameWidth` | number | `2` | Border width in pixels for the widget gradient frame |

### Tab sections types:

- **header** — Big title with icon
- **text** — Paragraph with icon, optional `align` (left/center/right)
- **links** — Row of link cards (items: label, url, icon, invertDark)
- **buttons** — Action buttons (items: label, url, icon, style: primary/secondary)
- **discord-server** — Discord server widget (uses DISCORD_SERVER_ID)
- **discord-user** — Discord user presence (WebSocket subscriber, shows phone icon on mobile)
- **steam** — Steam profile & games
- **overwatch** — Overwatch 2 competitive stats
- **markdown** — Renders `content/<file>.md` via `/api/markdown?file=<file>`
- **meme** — Random meme from external API
- **github** — GitHub project cards (repos: [{ owner, repo, label?, note? }])

## Critical Gotchas

### `HOST` vs `HOSTNAME`
- `HOSTNAME` is a standard Unix env var set to the machine's hostname (e.g. `bazzite`). **Do not use it** as a config key.
- The bind address env var is called `HOST`.
- `PRESENCE_WS` URL must use `localhost`, not `HOST` (which is `0.0.0.0` — not a valid connect address).

### homepage.json is runtime, not bundled
- Read via `fs.readFileSync` in `src/app/page.tsx` and `src/app/layout.tsx`.
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
- Not imported/bundled.

### GitHub API caching
- `/api/github` fetches repo data server-side and caches successfully in-memory for 6 hours.
- Failed fetches are cached for 10 minutes to avoid hammering GitHub on retries.
- Error cards still render with repo name/note and a "Failed to load" message.

### Tab transitions are sequential
- `Tabs.tsx` uses a 3-phase transition: fade out → wait → swap content → next frame → fade in.
- A `transitioning` ref prevents double-clicks during the animation.
- Configurable via `enableTransitions` prop from `effects.tabTransitions` in homepage.json.

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
- 6 sparkle particles at the current position: 3 white/purple/pink dots (up-right burst via `sparkle` keyframe), 2 blue/light-purple (up-left burst via `sparkle-alt`), 1 tiny white dot filling gaps. Staggered delays 0–0.85s, looping every 1.6–1.8s.
- Progress percentage extracted as `progressPct` local variable to keep fill width and sparkle position aligned.
- **Diminish on track change**: When a new song starts (crossfade), the progress bar fill gets `transition: width 0.5s ease-out` and the sparkle container gets `transition: left 0.5s ease-out` so both smoothly animate from the old position to the new (usually ~0%). Normal per-second ticks have `transition: none` to avoid lag.
- **Burst sparkles**: During crossfade, 6 additional one-shot burst particles (`sparkle-burst` / `sparkle-burst-alt` keyframes, 0.6–0.7s ease-out, not `infinite`) explode outward from the progress position for an intense spark effect as the bar shrinks.

### Activity card layout
- Card is `h-20` (80px) with `p-2` (8px), so content area is 64px.
- Activity image is `w-16 h-16` (64px square), filling the entire content area height.
- Card uses `flex items-start` so text aligns to top; image stays anchored to top via fixed `h-16`.
- Images use `object-contain` to show the entire asset without cropping, preserving aspect ratio inside the square container.
- All text elements (name, details, state) use `truncate` for `text-overflow: ellipsis` — text never wraps.
- Text that overflows gets `...` instead of changing the image's square shape.

### npm overrides
- `package.json` overrides `undici@^6.27.0` to fix high-severity vulns without breaking `discord.js`.

### Docker build requires native modules
- `better-sqlite3` and `sharp` need `build-base` + `python3` (already in Dockerfile).

### WebSocket data flow
1. `discord-presence.js` connects to Discord Gateway, receives presence events.
2. Pushes JSON via WebSocket client to `ws://localhost:PRESENCE_PORT`.
3. `websocket-server.js` relays to all connected browser clients.
4. React components (`DiscordUser`, `SteamStatus`, `OverwatchStatus`) subscribe via `useWebSocket` hook.

### Mobile presence detection
- `discord-presence.js` passes `clientStatus` from Discord's API.
- `websocket-server.js` forwards it to the browser in enriched presence data.
- `DiscordUser` shows a phone icon (Discord's own SVG path) when status is mobile-only.
- Status text appends " · On Mobile" when mobile-only.

### Docker persistence
- `visitors.db` is ephemeral in the container — `docker-compose-example.yml` mounts a named volume to persist it.
- `src/config/` and `src/content/` can be bind-mounted at runtime for live config edits without rebuild.

### Gradient widget frame stacking
- `.gradient-frame::before` needs `z-index: 1` and `.gradient-frame` needs `isolation: isolate` because Next.js `Image fill` uses `position: absolute`, putting it in the same stacking level as the `::before`. Without these, the image renders on top of the gradient border at the left/right edges of full-width content like the Discord banner.
- When `widgetFrame` is enabled on a `discord-user` section, DiscordUser receives a `framed` prop. When `framed`, it removes its own inner `border` (redundant with the gradient frame) and adds `paddingTop: var(--gf-width, 2px)` so the widget's background creates a clean gap between the gradient border and the full-width banner at the top.

### `framed` prop on DiscordUser
- `DiscordUser` accepts a `framed` boolean prop. When `true`: no `border` classes applied, and `paddingTop: var(--gf-width, 2px)` added via inline style. The CSS variable cascades from the `.gradient-frame` wrapper which sets `--gf-width`.
- Passed from `Tabs.tsx` as `framed={section.widgetFrame ?? widgetFrame}`.
- The loading skeleton, error fallback, and main render all handle `framed` identically.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev with WebSocket server, no presence bot |
| `npm run dev:full` | Both dev server + presence bot |
| `npm run presence` | Presence bot only |
| `npm run build` | Next.js production build |
| `npm run start` | Production start (websocket-server.js) |
| `npm run docker` | `docker compose up --build` |

## Docker

- Single container, multi-stage build.
- `docker-entrypoint.sh`: starts discord-presence.js in background, then exec websocket-server.js in foreground.
- `docker-compose-example.yml` includes named volume for `visitors.db` and optional bind mounts for config/content.
- Traefik recommended as reverse proxy.
- `.dockerignore` includes node_modules, .next, .env, visitors.db.
