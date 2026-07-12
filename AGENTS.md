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
│   │   │   ├── meme/route.ts        # Random meme from external API
│   │   │   └── visitors/route.ts    # Visitor counter (SQLite, write-behind queue)
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout, generateMetadata reads homepage.json
│   │   ├── loading.tsx              # Cold-load skeleton
│   │   └── page.tsx                 # Homepage — reads homepage.json at runtime via fs
│   ├── components/
│   │   ├── DiscordServer.tsx        # Discord server widget (client-side cache)
│   │   ├── DiscordUser.tsx          # Discord user presence (WebSocket subscriber, mobile indicator)
│   │   ├── SteamStatus.tsx          # Steam profile & games
│   │   ├── OverwatchStatus.tsx      # Overwatch 2 stats
│   │   ├── MemeWidget.tsx           # Random meme display
│   │   ├── MarkdownWidget.tsx       # Renders pre-rendered HTML from /api/markdown
│   │   ├── VisitorCounter.tsx       # Visitor count display
│   │   ├── GitHubProjects.tsx       # GitHub repo cards (public API, no key needed)
│   │   ├── Tabs.tsx                 # Tab navigation w/ header + icon + sections
│   │   ├── ParticleBackground.tsx   # Canvas floating particles
│   │   ├── EffectsController.tsx    # Conditionally renders effects based on config
│   │   └── FaviconAnimation.tsx     # Canvas-based animated favicon (hidden canvas → PNG data URL)
│   ├── config/
│   │   ├── homepage.json            # ALL site config: name, tagline, favicon, tabs
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md                 # Runtime markdown (not bundled)
│   │   └── about-example.md
│   ├── hooks/
│   │   └── useWebSocket.ts          # Singleton WebSocket hook (rAF-coalesced)
│   ├── lib/
│   │   └── config.ts                # mtime-cached homepage.json loader
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
| `widgetFrame` | boolean | `false` | Animated gradient frame around widget sections (discord-server, discord-user, steam, overwatch, markdown, meme, github) using title gradient colors. Can be overridden per section with a `widgetFrame` field on the section object. |
| `widgetFrameWidth` | number | `2` | Border width in pixels for the widget gradient frame |

### Tab sections types:

- **header** — Big title with icon
- **text** — Paragraph with icon, optional `align` (left/center/right)
- **links** — Row of link cards (items: label, url, icon, style: primary/secondary, invertDark; optional: text, icon, invertDark for section title)
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
5. `useWebSocket` coalesces messages per `type` within a `requestAnimationFrame` tick, so a burst of updates results in a single React render per subscriber.

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

### Meme widget frame wraps only the image, not the whole widget
- `MemeWidget` accepts `widgetFrameEnabled`, `widgetFrameWidth`, `widgetFrameGradient` props directly (not wrapped by `maybeWrapFrame`).
- When enabled, the `gradient-frame` class and CSS variables are applied only to the image container `<div>`, leaving the title, metadata, and "New Meme" button outside the framed area.

### ParticleBackground must only render once
- `ParticleBackground` is rendered conditionally by `EffectsController` (based on `effects.particleBackground` in `homepage.json`).
- It must **not** also be rendered unconditionally in `src/app/layout.tsx` — doing so produces two canvas elements animating on top of each other, doubling GPU/CPU cost.
- `EffectsController` is the single source of truth for when the particle background is active.

### Default favicon animation
- When `favicon` is empty/omitted in `homepage.json`, the page uses a canvas-based animated favicon that draws a conic-gradient ring using `titleGradient` colors.
- A hidden `<canvas>` (32×32) renders each frame via `requestAnimationFrame`, converts to a PNG data URL via `canvas.toDataURL("image/png")`, and sets it as `link[rel*="icon"].href` — the same technique as the GeeksForGeeks favicon animation article.
- A server-side SVG fallback (`/api/favicon`) is set as the initial favicon via metadata, so a favicon exists during SSR before the canvas JS hydrates.
- The gradient sweeps continuously as the `startAngle` parameter of `createConicGradient` advances per frame. The first color is duplicated at position `1.0` to prevent a hard seam at the gradient wrap point.
- The `FaviconAnimation` client component receives `titleGradient` as a prop from the server layout. Falls back to `["#60a5fa", "#a78bfa", "#f472b6"]` if no gradient is configured.

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
