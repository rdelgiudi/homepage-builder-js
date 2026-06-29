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
│   │   │   ├── markdown/route.ts    # Reads markdown from src/content/ at runtime
│   │   │   ├── meme/route.ts        # Random meme from external API
│   │   │   └── visitors/route.ts    # Visitor counter (SQLite)
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout, generateMetadata reads homepage.json
│   │   └── page.tsx                 # Homepage — reads homepage.json at runtime via fs
│   ├── components/
│   │   ├── DiscordStatus.tsx        # Discord server widget
│   │   ├── DiscordUser.tsx          # Discord user presence (WebSocket subscriber, mobile indicator)
│   │   ├── SteamStatus.tsx          # Steam profile & games
│   │   ├── OverwatchStatus.tsx      # Overwatch 2 stats
│   │   ├── MemeWidget.tsx           # Random meme display
│   │   ├── MarkdownWidget.tsx       # Fetches from /api/markdown, renders react-markdown
│   │   ├── VisitorCounter.tsx       # Visitor count display
│   │   ├── GitHubProjects.tsx       # GitHub repo cards (public API, no key needed)
│   │   └── Tabs.tsx                 # Tab navigation w/ header + icon + sections
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
| `tabs` | Array of tab objects |

### Tab sections types:

- **header** — Big title with icon
- **text** — Paragraph with icon, optional `align` (left/center/right)
- **links** — Row of link cards (items: label, url, icon, invertDark)
- **buttons** — Action buttons (items: label, url, icon, style: primary/secondary)
- **discord** — Discord server widget (uses DISCORD_SERVER_ID)
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
