# Project Overview

Next.js 15 + TypeScript + Tailwind CSS personal homepage built from one JSON config: 52 widget types (profile card, social icons, blog posts, Discord, Steam, Overwatch, GitHub, guestbook, reactions, polls, contact form, game recommendations, weather, feeds, YouTube, Twitch, Speedrun.com, TETR.IO, game servers, play history, …), seven site layouts, stream overlay pages, configurable backgrounds and canvas effects, real-time WebSocket updates, and an optional admin panel (`/admin`) with a drag-and-drop builder, live draft preview and publish.

## Architecture

- **Frontend**: Next.js 15 App Router (`src/app/`), React 19, Tailwind CSS
- **Backend**: Custom Node.js WebSocket server (`websocket-server.js`) — wraps Next.js, adds WebSocket on same port, in-process requires `discord-presence.js`
- **Presence Module**: `discord-presence.js` — Discord.js bot, exports `start()` / `onPresenceUpdate()` / `getCurrentPresence()`. Websocket-server calls `start()` to begin tracking, subscribes via `onPresenceUpdate()` to receive raw presence in-process (no localhost WS hop).
- **Single process per container**: `docker-entrypoint.sh` runs only `websocket-server.js` in the foreground; the presence bot runs in-process.
- **Admin panel**: `/admin` + `/api/admin/*`, same app. Exists only when `ADMIN_PASSWORD_HASH` (or plain `ADMIN_PASSWORD`) is set and `APP_ROLE` is not `public`. Recommended deployment is two containers from one image on **one hostname**: the reverse proxy sends the path prefixes `/admin` and `/api/admin` to the admin container and everything else to the public one (`APP_ROLE=public`); both share `DATA_DIR`, `src/config` and `src/content`.

## File Layout

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── favicon/route.ts     # Serves animated SVG favicon (fallback when no favicon set)
│   │   │   ├── github/route.ts      # GitHub repo data with 6h cache, 10m error cache
│   │   │   ├── markdown/route.ts    # Reads markdown from src/content/ at runtime, renders to HTML
│   │   │   ├── meme/route.ts        # Random meme from external API (NSFW/spoiler always filtered; popular mode supported)
│   │   │   ├── visitors/route.ts    # Total visitor counter (SQLite, write-behind queue)
│   │   │   ├── viewers/route.ts     # Live viewer count snapshot (reads globalThis.__serverSnapshots.getViewers)
│   │   │   ├── comments/route.ts    # Guestbook comments (SQLite, GET list + POST create; moderation-aware)
│   │   │   ├── reactions/route.ts   # Anonymous emoji reactions (SQLite, GET counts + POST/DELETE, broadcasts to all clients)
│   │   │   ├── poll/route.ts        # Poll results (GET) and voting (POST); SQLite poll_votes
│   │   │   ├── notify-test/route.ts # POST { ticket } → sends a test ntfy notification (ticket from /api/admin/notify-test)
│   │   │   ├── contact/route.ts     # Contact form POST → private `messages` row (rate limit, honeypot, block check)
│   │   │   ├── game-suggestions/    # GET public top list, POST a suggestion (app id checked with Steam); search/ = rate-limited Steam store search
│   │   │   ├── presence/route.ts    # Snapshot of current Discord presence (force-dynamic; reads in-memory server state)
│   │   │   ├── steam/route.ts       # Snapshot of current Steam data (force-dynamic; reads in-memory server state)
│   │   │   ├── overwatch/route.ts   # Snapshot of current Overwatch data (force-dynamic; reads in-memory server state)
│   │   │   ├── widgets/[type]/route.ts  # Data for widgets that show another site's data (dispatches to lib/widget-sources.ts)
│   │   │   ├── uploads/[name]/route.ts  # Public: serves an uploaded background image/video (immutable cache, byte ranges)
│   │   │   └── admin/               # Admin API — every handler wrapped in withAdmin() (except login)
│   │   │       ├── login/ logout/   # Session create / destroy
│   │   │       ├── config/route.ts  # GET published+draft, PUT save draft (strict), DELETE discard draft
│   │   │       ├── config/publish/  # POST: draft → homepage.json (revision kept)
│   │   │       ├── revisions/       # GET list, POST load one into the draft
│   │   │       ├── upload/          # Background media: GET list, POST multipart upload, DELETE
│   │   │       ├── content/         # Markdown files: list/read, PUT, DELETE, POST = render preview
│   │   │       ├── comments/        # GET list by status, POST bulk; [id] PATCH/DELETE; settings PUT
│   │   │       ├── messages/        # Inbox: GET list (unread/all, ?counts=1), POST bulk; [id] PATCH (read, blockAuthor)/DELETE
│   │   │       ├── suggestions/     # Game suggestions grouped by game: GET (new/all, ?counts=1), POST game action (read/unread/status/delete); [id] PATCH blockAuthor/DELETE
│   │   │       ├── notify-test/     # POST: single-use ticket for /api/notify-test
│   │   │       └── integrations/    # Which env vars are set (per container), shared-value mismatches, ntfy status, what is writable
│   │   ├── admin/
│   │   │   ├── layout.tsx           # Guard only: notFound() when admin is disabled
│   │   │   ├── (panel)/             # The panel's own chrome
│   │   │   │   ├── layout.tsx       # Wraps in .adm; imports admin.css
│   │   │   │   ├── loading.tsx      # Panel loading state (replaces the site skeleton under /admin)
│   │   │   │   ├── page.tsx         # /admin — redirects to /admin/login without a session; renders AdminApp
│   │   │   │   ├── login/page.tsx   # /admin/login
│   │   │   │   └── admin.css        # All admin styles, scoped under .adm
│   │   │   └── preview/page.tsx     # /admin/preview — SitePage rendered from the draft (session required); preview/[...page]/ = the draft's other pages, preview/posts/ = a blog post (PostView)
│   │   ├── globals.css
│   │   ├── layout.tsx               # Root layout (html/body + metadata only — shared by site and admin)
│   │   ├── loading.tsx              # Cold-load skeleton
│   │   ├── page.tsx                 # Homepage — <SitePage> with the published config (homepage.json read at runtime via fs)
│   │   ├── [...page]/page.tsx       # Every other page (`config.pages`, at /<address>, nested ones too): <SitePage> with pageView()
│   │   ├── overlay/                 # Stream overlay: [id]/page.tsx = one published widget, transparent (OBS Browser Source); loading.tsx renders nothing
│   │   └── posts/[...slug]/page.tsx # One blog post (lib/posts.ts) inside <SiteShell>; the slug is the file's path (folders allowed)
│   ├── components/
│   │   ├── OverlayView.tsx          # The overlay page's client part: one widget via TabSections, ?theme on <html>, ConfigSync
│   │   ├── SitePage.tsx             # SiteShell (page colour, background, effects, banner, counters, ConfigSync, ThemeSwitcher) + SitePage (the whole site from a config; used by / and /admin/preview, builds WidgetContext)
│   │   ├── PostView.tsx             # One blog post in the site's shell (used by /posts and the admin preview)
│   │   ├── SiteHeader.tsx           # Site name and/or logo + tagline (`top` / `bar` / `side` variants)
│   │   ├── Banner.tsx               # Top of every page: title, tab bar, light/dark switch (stacked or one row; scroll modes)
│   │   ├── TabStrip.tsx             # One scrolling row of tab buttons (tab bar, link in bio, one-page jump links)
│   │   ├── useBannerScroll.ts       # Banner hide/make-room state, publishes its height as `--banner-h` on <main>
│   │   ├── Tabs.tsx                 # Tab navigation (top bar or side column, mobile drawer, transitions)
│   │   ├── OnePage.tsx              # "onepage" layout: all tabs as sections, sticky jump bar with scroll-spy
│   │   ├── TabSections.tsx          # One tab's widgets as a stack or 12-column grid; renders via widgets/registry
│   │   ├── ConfigSync.tsx           # router.refresh() on WS {type:"config"} (live) or on postMessage from the admin panel (preview); preview: page/tab messages, keeps page links inside the preview
│   │   ├── BackgroundLayer.tsx      # Gradient / image / video / pattern layer + overlay; per-tab crossfade
│   │   ├── EffectsController.tsx    # Conditionally renders the particle effect, mouse trail and reaction flyer
│   │   ├── ParticleBackground.tsx   # Canvas effects: stars, comet
│   │   ├── AmbientEffects.tsx       # Canvas effects: snow, fireflies, constellation, aurora
│   │   ├── MouseTrail.tsx           # Canvas comet-style mouse trail (gradient line, no draw while stationary)
│   │   ├── ReactionFlyer.tsx        # Background layer that flies an emoji up the screen when anyone reacts (WebSocket subscriber, coalesce:false)
│   │   ├── FaviconAnimation.tsx     # Canvas-based animated favicon (hidden canvas → PNG data URL, self-healing)
│   │   ├── LanguagePicker.tsx       # Language picker (native select behind a small button); nothing with fewer than two languages
│   │   ├── LanguageSync.tsx         # <html lang>; remembers a `?lang=` from the address and cleans it
│   │   ├── ThemeSwitcher.tsx        # Light/dark toggle: floating (bottom right) or in the banner
│   │   ├── useTheme.ts              # Shared theme store: `dark`/`light` class on <html>, persisted in localStorage
│   │   ├── VisitorCounter.tsx       # Live viewer + total visitor counters (see "Visitor counters")
│   │   ├── DiscordServer.tsx        # Discord server widget (60s client-side cache)
│   │   ├── DiscordUser.tsx          # Discord user presence (WebSocket subscriber, mobile indicator)
│   │   ├── SteamStatus.tsx          # Steam profile & games with achievement progress
│   │   ├── OverwatchStatus.tsx      # Overwatch stats
│   │   ├── GitHubProjects.tsx       # GitHub repo cards (public API, no key needed)
│   │   ├── MemeWidget.tsx           # Random meme display
│   │   ├── MarkdownWidget.tsx       # Renders pre-rendered HTML from /api/markdown
│   │   ├── CommentsWidget.tsx       # Guestbook: post + list visitor comments (SQLite)
│   │   ├── ReactionsWidget.tsx      # Anonymous emoji reactions (toggle, visitor-hash keyed, rate-limited, GUI lock)
│   │   └── admin/                   # Admin panel client code (zod is allowed here — it is a separate route chunk)
│   │       ├── AdminApp.tsx         # Shell: top bar (status, undo/redo, discard, publish), nav, screens, resizable panels
│   │       ├── store.tsx            # AdminProvider/useAdmin: working config, undo history (typing grouped, see typing-history.ts), debounced draft autosave, publish
│   │       ├── typing-history.ts    # When typing ends an undo step: pause, leaving the field, every few words (pure, unit-tested)
│   │       ├── schemas.ts           # z.toJSONSchema() views of the config schema for the form generator
│   │       ├── SchemaForm.tsx       # Generic form generator (JSON Schema + `ui` hints → controls)
│   │       ├── Builder.tsx          # useBuilder(): dnd-kit outline (tabs, widgets, palette) + inspector
│   │       ├── PreviewPane.tsx      # iframe of /admin/preview, refreshed by postMessage; drop layer + marker for drops onto the page
│   │       ├── PagesPanel.tsx       # Pages: the site-map tree in the outline (unreachable pages, broken links, fixes) + page settings inspector
│   │       ├── useSiteMap.ts        # siteMap() of the working copy, with the links inside markdown files the widgets show
│   │       ├── preview-drop.ts      # Hit-testing the preview for drops: previewCandidates (DOM), pickTarget/sideFor/placeInList (pure, unit-tested)
│   │       ├── ConfigScreens.tsx    # Header & layout / Background / Effects, each for the whole site or one page's own settings (ScopeBar, Group, SiteOnly)
│   │       ├── LayoutControls.tsx   # LayoutPicker (site layout thumbnails) + SpanControl (widget width in a grid)
│   │       ├── LanguagesScreen.tsx  # Languages: original, translations, every text with its translation, markdown files
│   │       ├── ContentScreen.tsx    # Markdown files: language picker, folder tree (drag to move, rename/move, delete), editor + rendered preview
│   │       ├── MarkdownEditor.tsx   # Textarea with the formatting toolbar, shortcuts, image upload/paste/drop
│   │       ├── markdown-edit.ts     # Toolbar actions as pure text edits (unit-tested)
│   │       ├── content-tree.ts      # Folder tree, languageView() + drop targets for the Content screen (pure, unit-tested)
│   │       ├── CommentsScreen.tsx   # Moderation queue, settings, audit log
│   │       ├── InboxScreen.tsx      # Contact-form messages: unread/all, mark read, reply by email, block, delete
│   │       ├── SuggestionsScreen.tsx # Game suggestions per game: status (will play / played / dismissed…), read, block, delete
│   │       ├── OtherScreens.tsx     # Integrations, History
│   │       ├── LoginForm.tsx
│   │       └── api.ts               # fetch helper for /api/admin/*
│   ├── instrumentation.ts           # Next startup hook: recordEnvReport()
│   ├── config/
│   │   ├── homepage.json            # ALL site config (gitignored — copy from the showcase, or start empty)
│   │   └── homepage.showcase.json   # Every widget type with placeholder content plus example pages: home + /about use the site-wide settings, /projects and /colophon their own (together every settings group); the starting point to copy; unit-tested (all types, no unreachable pages, every settings group shown, no key zod would drop)
│   ├── content/                     # Runtime markdown, *.md (gitignored, not bundled)
│   ├── hooks/
│   │   └── useWebSocket.ts          # Singleton WebSocket hook (rAF-coalesced per type; supports `coalesce: false` for event streams like reaction flyers)
│   ├── lib/
│   │   ├── schema/
│   │   │   ├── config.ts            # Zod schema for homepage.json v2 — single source of truth for types + defaults
│   │   │   ├── migrate.ts           # v1 → v2 structural migration + id generation
│   │   │   └── parse.ts             # parseConfig() (lenient) / strictParseConfig()
│   │   ├── admin/
│   │   │   ├── auth.ts              # adminEnabled(), password check, sessions, CSRF, login throttle, withAdmin()
│   │   │   ├── password.js          # scrypt hash/verify (CommonJS — also loaded by websocket-server.js and scripts/admin-hash.js)
│   │   │   ├── store.ts             # SQLite: admin_sessions, admin_state (draft, settings), config_revisions, blocked_visitors, audit_log
│   │   │   └── publish.ts           # publishConfig() (atomic write + revision), getDraftConfig(), isWritable()
│   │   ├── config.ts                # mtime-cached homepage.json loader (uses parseConfig)
│   │   ├── db.ts                    # Shared better-sqlite3 connection (DATA_DIR/visitors.db, WAL); exports DATA_DIR
│   │   ├── visitor.ts               # visitor_id cookie + hashing helpers (shared by visitors/comments/reactions/poll)
│   │   ├── comments.ts              # comments table + moderation columns, moderation settings, initialStatus()
│   │   ├── messages.ts              # messages table (contact form), cleanText() (keeps newlines), isEmail(), messageCounts()
│   │   ├── notify.ts                # ntfy notices + buildNtfyRequest()/ntfyEnvSummary() — pure, unit-tested
│   │   ├── notify-admin.ts          # sendNotice()/notifyAdmin() (30/10 min cap, last result in admin_state), test-notification tickets
│   │   ├── env-report.ts            # Per-instance "which env vars are set" record in admin_state (written at startup), read by the Integrations screen
│   │   ├── url.ts                   # httpUrl() — pure, client-safe (re-exported by widget-data.ts)
│   │   ├── reactions.ts             # DEFAULT_EMOJIS constant shared by API + widget
│   │   ├── reaction-bus.ts          # broadcastReaction() — pushes a reaction to all WS clients via globalThis.__wssBroadcast
│   │   ├── background.ts            # backgroundLayer(): background.base → CSS variables/classes (pure); safeUrl()
│   │   ├── uploads.ts               # DATA_DIR/uploads: storeImage (sharp → WebP), storeVideo, resolveUpload, listUploads
│   │   ├── content.ts               # CONTENT_DIR, resolveContentFile()/resolveContentFolder() (plain paths, ≤ 4 folders deep), listContent() (recursive)
│   │   ├── markdown.ts              # Server-side markdown → HTML (marked), mtime-cached
│   │   ├── pages.ts                 # Pages: sitePages/pageView/withPageTabs/allSections, linkTarget/markdownLinks, siteMap() (reachability), retargetLinks — pure, unit-tested
│   │   ├── i18n/languages.ts        # Codes, names, which language a visitor gets, language folders of markdown files (pure, client-safe, unit-tested)
│   │   ├── i18n/texts.ts            # collectTexts / localize / carryTranslations / translationStatus, from the schemas' `translate` meta (zod: server + admin only)
│   │   ├── i18n/suggest.ts          # suggestTranslations(): what was decided for the same text elsewhere, or a nearly identical one (case, spacing, punctuation, emoji); pure
│   │   ├── i18n/organize.ts         # organizeContent(): moves the original markdown files into their language's folder on publish
│   │   ├── i18n/server.ts           # requestLanguage() (visitor), previewLanguage() (admin preview), presentLanguages()
│   │   ├── tab-slug.ts              # slugify, tabSlug(): a tab's `?tab=` address, the same in every language
│   │   ├── banner.ts                # What a layout makes of the banner settings: bannerOptions, ignoredBannerSettings, splitTabs (pure, unit-tested)
│   │   ├── layouts.ts               # LAYOUT_FEATURES: what each site layout does with tab settings; gridOptions, pinnedTabId, ignoredTabSettings, bottomNav
│   │   ├── widget-context.ts        # widgetContextFor(config): the WidgetContext (site + overlay)
│   │   ├── widget-data.ts           # cached(), getJson/getText, findSection(), htmlToText(), httpUrl(), WidgetError
│   │   ├── widget-sources.ts        # weather, chess, bluesky, github-activity, rss, mastodon, youtube, twitch, music, status fetchers (+ spreads gamingSources)
│   │   ├── gaming-sources.ts        # speedrun, tetrio, game-server, steam-rare, play-history sources + pure mappers (unit-tested)
│   │   ├── a2s.ts                   # Valve A2S_INFO over UDP (challenge handshake), parseA2SReply(), parseServerAddress()
│   │   ├── play-history.ts          # Reads play_sessions; summarizePlay() (per-day minutes in a time zone, top games) — pure, unit-tested
│   │   ├── game-suggestions.ts      # game_suggestions + suggested_games tables, Steam store search/appdetails lookups, topSuggested()
│   │   ├── media-sources.ts         # `media` widget: AniList (GraphQL), Letterboxd (RSS), Open Library (reading log) + pure mappers
│   │   └── posts.ts                 # Blog posts = dated markdown files in src/content/: listPosts(), getPost(), the `posts` widget source
│   ├── widgets/                     # Widget registry — one folder per section type (52 types)
│   │   ├── <type>/meta.ts           # Server-safe: zod options schema, label, icon, category, defaults, requiresEnv
│   │   ├── <type>/render.tsx        # Client: WidgetView { titled, frame, render(section, ctx) }
│   │   ├── embed/player.ts          # toPlayer(): link → player URL (kept in .ts so tests can import it)
│   │   ├── support/platforms.ts     # Support platforms: brand classes + supportUrl() (fixed host + validated username)
│   │   ├── socials/platforms.ts     # Social platforms (Simple Icons paths, brand hex, hosts) + detectPlatform/socialHref/resolveSocials; SocialLinks.tsx is shared with `profile`
│   │   ├── schedule/occurrences.ts  # upcoming(): weekly slots → next occurrences (pure, unit-tested)
│   │   ├── stats/count.ts           # parseCount/formatCount for the count-up (pure, unit-tested)
│   │   ├── meta.ts                  # Server-safe index: SectionSchema (discriminated union), widgetMetas
│   │   ├── registry.tsx             # Client index: renderSection(section, ctx)
│   │   ├── fields.ts                # Shared zod fields (base id/type/span, titleFields, frameField)
│   │   ├── shared.tsx               # Icon, SectionTitle, WidgetFrame, alignClass
│   │   ├── common.tsx               # For data widgets: Card, Notice, Skeleton, useWidgetData (optional refresh interval), DataCard, timeAgo
│   │   ├── posts.tsx                # PostList shared by mastodon + bluesky
│   │   ├── time.ts                  # Time-zone maths for clock + countdown (Intl only)
│   │   └── types.ts                 # WidgetMeta, WidgetView, WidgetContext
│   └── types/
│       ├── gray-matter.d.ts
│       └── quantize.d.ts
├── tests/
│   ├── register.mjs                 # Node module hooks: `@/` alias + extensionless imports
│   ├── unit/                        # config, security, widgets, tailwind (no network, no database)
│   ├── integration/                 # server.ts (starts the built server) + admin.test.ts, widgets.test.ts (HTTP tests)
│   └── fixtures/homepage.v1.json    # Original v1 config — proves old configs still load
├── scripts/admin-hash.js            # `npm run admin:hash` — prints an ADMIN_PASSWORD_HASH line
├── discord-presence.js              # Discord.js bot (in-process; exports start/onPresenceUpdate)
├── play-history.js                  # Game-session recorder (CommonJS, in-process): presence → play_sessions, opt-in via the config
├── websocket-server.js              # Custom Next.js server + WebSocket; Steam/Overwatch polling, presence enrichment, config file watch
├── docker-entrypoint.sh             # Execs websocket-server (presence runs in-process)
├── Dockerfile                       # Multi-stage (node:26 alpine): deps → builder → runner
├── docker-compose-example.yml       # Public + admin containers sharing one data volume
├── eslint.config.mjs                # ESLint 9 flat config
├── tailwind.config.ts               # `content` must list every folder with class names (incl. src/widgets)
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
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Twitch app credentials for the `twitch` widget (client-credentials token, cached until it expires) |
| `LASTFM_API_KEY` | Only for the `music` widget with `service: "lastfm"` (ListenBrainz needs no key) |
| `NTFY_TOPIC` | Optional: ntfy topic that gets a push for each new contact message, guestbook comment and game suggestion. Unset = off. Set on the public instance (it serves the visitor POSTs). |
| `NTFY_URL` / `NTFY_TOKEN` / `NTFY_CLICK` | ntfy server (default `https://ntfy.sh`), access token for a protected topic (Bearer), link opened when the notification is tapped (e.g. `https://example.com/admin`) |
| `NTFY_EVENTS` | Comma list of `message`, `comment`, `suggestion` to send; empty = all |
| `VISITOR_SALT` | Salt for visitor ID hashing |
| `DATA_DIR` | Directory for runtime-written state (default: `<cwd>/data`) |
| `ADMIN_PASSWORD_HASH` | Enables the admin panel at `/admin`. scrypt hash from `npm run admin:hash`. |
| `ADMIN_PASSWORD` | Plain-text alternative for local development; ignored when the hash is set. Neither set = the panel does not exist (404). |
| `APP_ROLE` | `public` disables the admin panel on this instance even with an admin password set. `admin` = normal, but the play-history recorder doesn't start (the admin half of the two-container setup, so only one process records into the shared database). Anything else / unset = normal. |

### homepage.json — content config (no secrets), **config v2**:

| Field | Description |
|---|---|
| `version` | `2`. A file without `version` is treated as v1 and migrated in memory (see "Config schema, validation and migration"). |
| `name` | Site title (HTML `<title>`, page h1) |
| `tagline` | Page subtitle, also used as `<meta name="description">` |
| `favicon` | URL for favicon (optional, empty/omit = auto-generated animated gradient ring using `titleGradient` colors) |
| `postAuthor` | Default blog post author, shown on posts without their own front matter `author` (empty = none). Site-only, edited under Header & layout → Blog posts; reaches the widget as `WidgetContext.postAuthor`. |
| `titleGradient` | Array of CSS color stops for title gradient text; omit or empty = solid color |
| `taglineGradient` | Array of CSS color stops for tagline gradient; empty array or omit = inherits `titleGradient` |
| `banner` | `{ title, logo?, logoDark?, logoHeight, showTagline, arrangement, titlePosition, tabsPosition, fullWidth, scroll, themeSwitch, languagePicker, phone? }` — the top of every page. See "Banner". |
| `layout` | `{ site, bentoColumns, masonryColumns, fullWidth, pinnedTab?, mobileNav, sectionHeadings }` — site shell: `"tabs"` (default), `"sidebar"`, `"onepage"`, `"bento"`, `"linkinbio"`, `"masonry"`, `"profile"`; `bentoColumns` (2–4, default 2) = widgets per row in bento; `masonryColumns` (2–3, default 3); `fullWidth` (bento/masonry, default false) = no page width cap; `pinnedTab` (profile) = id of the tab shown as the column; `mobileNav` (`menu` \| `bottom`) = phones' tab navigation; `sectionHeadings` (default `true`) = tab names above each one-page section. All `showIf` on `site` in the panel. See "Site layouts and the grid". |
| `background` | `{ base, overlay, effect, surface }` — what fills the page (solid / gradient / image / video / pattern), a readability overlay, the particle effect, and how see-through the header, tab bar and cards are. See "Background" below. |
| `counters` | `{ viewers, visitors }` — toggles for the bottom-left counters (both default `true`) |
| `effects` | Object toggling visual effects — see Effects section below |
| `languages` | `{ original, detect, translations: [{ code, enabled, texts }] }` — the original language and the translations (site-wide). See "Languages". |
| `pages` | More pages: `[{ id, slug, title, description?, tabs, settings? }]`, each at `/<slug>` with its own tabs (same shape as the top-level `tabs`). `settings` = the page's own `header` (name, tagline), `titleColors`, `banner`, `layout`, `counters`, `background`, `effects` (each group whole, replacing the site's for that page); the favicon is shared. See "Pages". |
| `homeSettings` | The homepage's own settings groups, where it differs from the site's (same shape as a page's `settings`). |
| `tabs` | The homepage's tabs. Array of tab objects: `{ id, label, icon?, invertDark?, layout: "stack" \| "grid", sections: [...] }`. Every section also accepts `span` (1–12, grid width). Every tab and section has an `id` (unique across the file; auto-derived on load when missing). |

### Effects Config:

| Field | Type | Default | Description |
|---|---|---|---|
| `gradientBorders` | boolean | `true` | Animated gradient border + subtle scale on hover for link cards, buttons, GitHub project cards, Steam "View Profile", and Meme "New Meme" |
| `tabTransitions` | boolean | `true` | Smooth crossfade when switching tabs |
| `customScrollbar` | boolean | `true` | Thin rounded scrollbar styling |
| `progressGradient` | boolean | `true` | Gradient fill on the Discord music progress bar and the Steam achievement bars; `false` = plain solid bars (no animation, no sparkles) |
| `progressGradientColors` | string[] | `titleGradient` fallback | Custom gradient color stops for the progress bars; falls back to `titleGradient` colors, then to a default blue→purple→pink gradient |
| `progressAnimation` | boolean | `true` | The Discord music bar's gradient slowly shifts |
| `progressSparkles` | boolean | `true` | Sparkle particles at the Discord music bar's current position (+ the burst on track change) |
| `widgetFrame` | boolean | `false` | Animated gradient frame around widget sections using title gradient colors — every widget whose view has `frame: "wrap"` or `"self"` (all except header, text, links, divider). Can be overridden per section with a `widgetFrame` field on the section object. |
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
- **discord-user** — Discord user presence (WebSocket subscriber, shows phone icon on mobile); music bar: `progressColorMode` (`site` | `custom`) + `progressColors` (used for `custom`), tri-state `progressAnimation` / `progressSparkles` (unset = the `effects.*` value). See "Progress bar gradient + sparkles"
- **steam** — Steam profile & games (includes achievement progress for recent and top games); `showRecent` / `showTop` toggle the two game rows; `progressColorMode` + `progressColors` for the achievement bars (same as `discord-user`) and tri-state `progressAnimation` (no sparkles)
- **overwatch** — Overwatch competitive stats
- **markdown** — Renders `content/<file>.md` via `/api/markdown?file=<file>`
- **meme** — Random meme from external API (supports `popular` flag; NSFW/spoiler always filtered server-side)
- **github** — GitHub project cards (repos: [{ owner, repo, label?, note? }])
- **comments** — Guestbook widget (repos: none; optional `limit` for max comments fetched, default 50). Posts via `/api/comments`, lists newest-first.
- **reactions** — Anonymous emoji reactions (repos: none; optional `emojis` array overriding `DEFAULT_EMOJIS`). Toggle per emoji keyed by `visitor_hash`; a new reaction broadcasts `{type:"reaction", emoji}` to all clients for the background flyer (`effects.reactionFlyer`).
- **image** — Image or gallery (`images: [{ src, alt?, caption?, link? }]`, `columns` 1–4, `shape`). `src` accepts uploads (`/api/uploads/…`) or http(s) URLs.
- **embed** — YouTube / Vimeo / Spotify / SoundCloud player from a normal link (`url`).
- **clock** — Live clock for a `timezone`; optional `place`, `hour12`, `showDate`, `showDifference`.
- **countdown** — Time left until `target` (`YYYY-MM-DDTHH:mm`, wall time in `timezone`); `label`, `doneText`.
- **weather** — Open-Meteo current weather + 3-day forecast (`latitude`, `longitude`, `place` label, `units`, `showForecast`).
- **rss** — Latest items of an RSS/Atom feed (`url`, `limit`, `showDates`).
- **github-activity** — Contribution heatmap (`username`).
- **mastodon** — Latest posts (`instance`, `account`, `limit`).
- **bluesky** — Latest posts (`handle`, `limit`).
- **chess** — Ratings (`site`: `lichess` | `chesscom`, `username`).
- **skills** — Badges (`items: [{ label, icon?, level? }]`).
- **timeline** — Ordered events (`items: [{ title, date?, text? }]`).
- **quote** — `quotes: [{ text, author? }]`; several = a random one per visit (first one on the server render).
- **divider** — `style` (`line` | `dots` | `space`), `size`. No title, no frame.
- **poll** — `question`, `options` (strings), `results` (`after` | `always`). Votes in SQLite via `/api/poll`.
- **contact** — Private contact form (`intro`, `askEmail`: `optional` | `required` | `hidden`, `buttonText`, `successText`). Messages land in the admin **Inbox**.
- **now** — "Now" card: `items: [{ icon?, label, text, url? }]`, `updated` (`YYYY-MM-DD`, shown as "Updated 3 days ago" after mount).
- **faq** — `items: [{ question, answer }]`, `openFirst`. Native `<details>`.
- **support** — Brand-coloured buttons: `items: [{ platform, username, label? }]` (`kofi`, `github`, `patreon`, `buymeacoffee`, `liberapay`, `paypal`, `opencollective`).
- **buttons** — 88×31 button wall (`items: [{ image, label, url? }]`, `pixelated`) + optional webring (`ringName`, `ringHome`, `ringPrev`, `ringNext`, `ringRandom`).
- **youtube** — Latest uploads (`channel`: `@handle` or `UC…` id, `limit`, `hideShorts`, `layout`: `grid` | `list`). Public channel RSS, no key.
- **twitch** — Live status (`username`, `hideOffline`). Needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET`.
- **music** — Recently played (`service`: `listenbrainz` | `lastfm`, `username`, `limit`, `showCovers`).
- **status** — Service status board (`services: [{ label, url, icon? }]` max 20, `showLatency`, `linked`).
- **speedrun** — Speedrun.com personal bests (`username`, `sort`: `place` | `recent`, `limit`, `levels`).
- **tetrio** — TETR.IO profile: Tetra League rank/TR/APM/PPS + 40L, Blitz, Quick Play records (`username`, `showRecords`).
- **game-server** — Minecraft (Java/Bedrock via mcsrvstat.us) and Source/A2S server status (`servers: [{ label, protocol, address, icon? }]` max 10, `showPlayers`, `showAddress`).
- **steam-rare** — Rarest unlocked Steam achievements by global unlock rate (`limit`, `scanGames` = most-played games looked through, `layout`, `header`: `profile` = avatar + name + View Profile | `none`). Needs `STEAM_API_KEY` + `STEAM_ID`.
- **play-history** — Heatmap of hours played per day, recorded from Discord presence (`months`, `timezone`, `showGames`, `showRecent`, `hideGames`). Needs the Discord bot.
- **game-shelf** — Game covers/list (`items: [{ title, appid?, image?, url?, status?, rating? 1–5, note? }]`, `layout`: `covers` | `list`, `columns`, `groupBy`: `none` | `status` | `custom`, `groupStyle`: `line` (one sideways-scrolling row per group) | `wrap`, `groupOrder`). Status groups: fixed order/headings in `SHELF_GROUPS` (`widgets/game-shelf/groups.ts`), status badges hidden. Custom groups: each item's free-text `group`, matched case-insensitively (heading = first spelling), `groupOrder` names first, the rest in first-appearance order, no group → "Other" last; badges stay. Both pure functions are unit-tested.
- **play-with-me** — Live "up for a game?" card from Discord + Steam status (`availability`: `auto` | `open` | `busy`, `note`, `games`, `showSteam`, `showDiscord`, `joinLink`).
- **game-suggest** — Visitors search Steam and suggest a game (`intro`, `askName`, `buttonText`, `successText`, `showList`). Suggestions land in the admin **Suggestions** screen.
- **profile** — Profile card: `avatar` (upload/URL), `avatarShape`, `name`, `pronouns`, `location`, `bio`, `layout` (`centered` | `side`), `card`, plus `socials` (same items as the socials widget) and its `style`/`colors`/`size`.
- **socials** — Row of social links: `items: [{ url, platform: "auto" | <platform>, label? }]`, `style` (`icons` | `buttons`), `colors` (`brand` | `mono`), `size`. See "Social links".
- **projects** — Portfolio cards: `items: [{ title, description?, image?, url?, linkLabel?, source?, tags, status?, year? }]`, `layout` (`cards` | `list`), `columns` 1–3.
- **notice** — Coloured banner: `tone` (info/success/warning/danger/neutral), `icon?`, `title?`, `message`, `linkText?`/`linkUrl?`, `until` (datetime in `timezone`, hidden afterwards), `dismissible` (localStorage, keyed by section id + a hash of the text). Untitled, unframed. The text field is `message`, not `text`: `renderSection` treats any section with `text` as having a title row.
- **schedule** — Weekly slots `items: [{ label, icon?, days: ["mon"…], time: "HH:mm", duration (min, 0 = none), url? }]` in the owner's `timezone`; after mount the next week's occurrences are listed in the visitor's own zone with "Live now" / "in 3 h" (`occurrences.ts`). The server renders the plain configured times.
- **media** — "Watching / reading": `service` (`anilist` | `letterboxd` | `openlibrary`), `username`, `kind` (anime/manga, AniList), `list` (`current` | `finished` | `planned`; Letterboxd is always the diary), `limit`, `layout` (`covers` | `list`), `columns`, `showRatings`.
- **stats** — Big numbers: `items: [{ value, label, icon? }]`, `columns`, `style` (`cards` | `plain`), `gradient` (title gradient), `countUp` (from 0 when scrolled into view; the final value is in the server HTML and for reduced motion).
- **posts** — Blog post list (`limit`, `tag`, `layout` `list` | `cards`, `showSummary`, `showReadingTime`, `showAuthor`). See "Blog posts".

## Critical Gotchas

### Config schema, validation and migration
- `src/lib/schema/config.ts` (zod) is the **only** place config types and defaults are defined. Never re-declare config interfaces in components and never write `?? default` for a config value in a consumer — `getConfig()` returns a fully-defaulted `HomepageConfig`. Fields carry `.meta({ title, description, ui })` — these are the labels/hints the admin panel's form generator will read, so add them to every new field.
- `parseConfig(raw)` = `migrateConfig` → per-section and per-tab validation → top-level validation. It is deliberately **lenient**: an invalid/unknown section or tab is dropped and reported in `warnings` (logged as `[Config]`), so one typo doesn't blank the site. If the top level fails (`config: null`), `config.ts` keeps serving the last good config. A save path that must not lose data has to treat warnings as errors.
- `config.ts` records the mtime even when a load fails, so a broken file is logged once, not on every request.
- **v1 → v2** (`migrate.ts`): `backgroundColor` → `background.base`; `effects.particleBackground` / `effects.particleEffect` → `background.effect.type` (`false` → `"none"`); ids generated. The user's on-disk `homepage.json` is never rewritten by the loader. New schema changes should be **additive** (new optional fields / enum members); anything else needs a version bump and a new step in `migrateConfig`.
- **Generated ids** are `slug(label)` for tabs and `<tabId>-<type>` for sections, de-duplicated with `-2`, `-3`… Explicit ids are reserved first. They are stable across loads for an unchanged file, but for an id-less (v1) file reordering two sections of the same type swaps their ids. The `?tab=` URL param still uses `slugify(label)`, not `tab.id`.

### Pages (`pages` + `src/app/[...page]` + `src/lib/pages.ts`)
- **Model**: the homepage is the top-level `tabs`; `pages[]` are the others (`{ id, slug, title, description?, tabs }`), additive in config v2. In `lib/pages.ts` the homepage is the page with id `""` and slug `""` (`HOME`). `pageView(config, id)` = the config with that page's tabs as `tabs` (everything else shared) and `withPageTabs()` writes them back: the site (`/[page]` renders `<SitePage config={pageView(...)} onPage>`), the preview and the builder all use it, so layouts, the profile column (`pinnedTab` points at a homepage tab, so other pages have no column), backgrounds and `?tab=` work the same on every page. `onPage` makes the site name link to `/` (posts pass `homeHref` too).
- **Addresses** (`PageSchema.slug`, rules in the zod-free `lib/schema/page-address.ts` because `lib/pages.ts` is in the site's client bundle): one to `MAX_PAGE_DEPTH` (3) lowercase levels, `about` or `about/colophon` (`PAGE_SLUG`, each level `PAGE_SEGMENT`), stored as the full path. `isReservedSlug()` judges the **first** level: anything starting with `admin` or `api` (the proxy routes by path **prefix**, so `/adminfoo` would reach the admin container) plus `posts`, `overlay`, `ws`. Both routes are catch-alls (`[...page]`) that join the levels and look the address up in lower case. Unknown addresses are soft 404s (status 200 under the root `loading.tsx`).
- **Nested pages**: a page is "under" another when its address starts with that page's address + `/` (`parentAddress()`); there is no separate parent field, so the URL is the structure. The page inspector edits **Under** (a page, or the top level; never itself, a page under it, or anything that would push its sub-pages past the depth limit) plus its own last level. `moveAddress()` changes an address and moves the pages under it along (`about/x` → `info/x`), retargeting widget links to every moved address; the inspector checks that none of the new addresses is taken. Deleting a page leaves the pages under it at their addresses (the confirm says so). `linkTarget()` resolves relative links like a browser (`new URL(href, <page address>)`: `colophon` on `/about/x` = `about/colophon`) and only counts address-shaped paths up to the depth limit. The Pages tree in the outline follows **addresses** (`/about/colophon` under About, whatever links to it; a page whose parent address has no page sits under the nearest page above it, or at the top). Where it is linked from is independent: nesting creates no link, and reachability is still judged by links only.
- **Parsing**: `parseConfig` drops invalid sections/tabs **per page** and invalid or repeated-address pages (a typo on a page never blanks the site); `ensureIds` gives pages (`page-<slug>`) and their tabs/sections ids, reserving every explicit id across all pages first; `strictParseConfig` rejects duplicate ids across everything and repeated addresses.
- **Everything that looks a section up searches every page**: `findSection` (data widgets, polls, contact, game suggestions), the overlay page, `play-history.js` (plain JSON: `pages[].tabs[]` by hand), the Content screen's "in use" + rename, the move handle, the overlay link's "live" check, the revisions summary, the post page's Back link (`allSections`, `sitePages`, `mapSections`). A new reader of `config.tabs` must decide whether it means "the homepage" or "every page".
- **Linking pages**: `linkHref()` (`lib/url.ts`) = http(s) **or** a same-site path (`/page-2`, `/?tab=x`; never `//host` or `/\host`), used by the link fields of notice, projects, now, schedule, buttons, game shelf and image (`httpUrl` stays strict: the server's fetchers rely on it). `opens(href)`: same-site pages open in the same tab, other sites and `/api/` files in a new one. The Links widget keeps any `url` (mailto: etc.) but uses `opens()` too.
- **Site map** (`siteMap(config, fileLinks, ownHosts)`, pure): edges = string values under link-like keys (`url`, `linkUrl`, `link`, `href`, nested lists included) plus the links in the markdown files that Markdown widgets show (`markdownLinks`: inline, reference definitions, `href=`, autolinks; read through the admin API by `useSiteMap`, cache cleared by the Content screen). Until those files are read, `useSiteMap` returns `checking: true` with no unreachable/broken pages (the Pages panel says "Checking links…", Publish waits): showing the half-done result made pages linked only from markdown flash as unreachable. A re-read after a file save keeps the previous complete answer meanwhile; a change in *which* files are used, or in the languages, counts as unchecked (the lists are rebuilt). Files are found by `contentCandidates` on the client, from the list of files on disk: the server resolves names with its copy of the draft, which is half a second behind. Every translation visitors can choose is checked on its own with its own markdown files (`translationLinks()`): only what is wrong there and not in the original is reported, as "Only in Italian" in the banner, the Pages panel and the Publish question; `linkTarget()` maps an address to a page (strips `?`/`#`, relative `page-3`, full URLs on the admin's own host count). Breadth-first from home → `reachable`, `unreachable`, `parent` (the page each one is first reached from), `broken` (links to pages that don't exist). Links inside blog posts don't count (posts aren't pages).
- **Editor**: the outline starts with **Pages** (`PagesOutline`): the address tree (unreachable pages marked in place: ⚠, warning border), then "can't be reached from the homepage" (each with "Linked only from X, which can't be reached either" / "No page links here" and **Link it from Home**: adds an item to the homepage's first tab's Links widget, or a new one), then broken links (click = open that widget). The gear opens `PageInspector` (title/description form, address, linked from / links to, delete). Changing the address goes through `retargetLinks()` (link fields in the draft follow); markdown files are only listed, because they are live immediately while the new address only exists after Publish. The same warning is a banner on every screen, and Publish asks first while pages are unreachable. "The site warns" = the editor: visitors never see it.
- **A page's own settings** (`PageSettingsSchema`: `header` (name, tagline), `titleColors` (the two gradients), `banner`, `layout`, `counters`, `background`, `effects`; `pages[].settings`, `homeSettings` for the homepage). Each group is all or nothing — present = it replaces the site's group for that page, missing = the site's — on purpose: a block is then either "uses the site's" or "has its own", never a field-by-field mix. On the site, `header` and `titleColors` are top-level fields (`name`, `tagline`, `titleGradient`, `taglineGradient`), on a page nested objects: `groupValue()` / `withSiteGroup()` hide that difference (`pages.ts`). Only the favicon stays site-only. A page's own name is also its `<title>` suffix; `/` has its own `generateMetadata` for the homepage's. `pageView()` merges them, so the site, the preview and the builder (its grid follows the page's own layout) all apply them; `/` and `/admin/preview` render `pageView(config, HOME)` too. `withPageSetting(config, id, group, value | undefined)` sets/removes one group and drops an empty `settings`/`homeSettings` key. The lenient parser drops only an invalid **group** (that page then uses the site's), never the page or the site. A widget move takes the grid rules of the source page's own layout.
- **Settings UI** (`ConfigScreens.tsx`): a sticky `ScopeBar` on the Header & layout / Background / Effects screens (the first was called "Site" before pages could have their own settings; `#site` still opens it): **Whole site** or **One page** (+ page picker). "One page" is always the page the builder and preview show (`builder.page`; picking another page there calls `builder.openPage`), so what you edit is what you see. Per group (`Group`): whole site = the site's values, a warning when the previewed page has its own (so changes won't show there), and the pages that have their own; one page = "uses the site's" + **Give <page> its own <group>** (starts from a copy) or the page's own values (accent left border, "Only <page>" tag) + **Use the site's <group> again**. Site-only blocks (`SiteOnly`, now only the favicon) say "The same on every page" in page scope. The profile column picker lists the edited page's tabs (`TabChoices` context in `SchemaForm`). Pages with own settings get an "own look" tag in the Pages tree. All of it is in the draft (undo, preview, publish) like any other edit.
- **Moving widgets between pages**: `moveSection(sectionId, toTabId)` is site-wide (a tab id says which page): one `updateSite`, the grid row it leaves closes up (`removeFromGrid` with the *source* page's grid rules), then the builder opens the target page. The inspector's select lists every page's tabs (`optgroup` per page), and page rows in the Pages tree are droppables (`page:<id>`, `PAGE_DROP`): a dragged widget — outline row/tile, preview handle — or a palette item goes to the end of that page's first tab (a page without tabs says to add one).
- **Builder scoping**: `useBuilder` edits one page: `config` is `pageView(site, pageId)` and `update` wraps `updateSite` with `withPageTabs` (synchronously — typing grouping reads `window.event`). New ids (`uniqueId`, `newSection`, duplicate, add tab/page) are always checked against the **whole** site (`allIds`), or the strict save rejects the draft.
- **Preview across pages**: `PREVIEW_TAB` carries `page` (ConfigSync navigates to `/admin/preview/<slug>`); `PREVIEW_SHOWN` reports `{ page, tab }` (also on every pathname change), so following a link inside the preview opens that page in the builder. In preview mode ConfigSync intercepts clicks on same-site page links and on blog posts (`/posts/…` → `/admin/preview/posts/…`; the live post page shows the published config and the visitor's language, so it looked untranslated and without a picker) (capture phase, before `next/link`) and keeps them under `/admin/preview` — the live page would show the published version, and in the split deployment isn't the admin container. `shownSlug` is `<page>|<tab>`. `PreviewPane.goingTo`: after sending the preview to a page, reports about another page are ignored until it arrives (10 s cap) — a slow first compile otherwise made the builder jump back. Messages sent while the iframe is still loading are lost, so the preview posts `PREVIEW_READY` once per **document load** (module flag `announcedReady`, not per mount: ConfigSync remounts on every page change, and re-announcing made the panel send its own page back, undoing a link just followed) and the panel re-sends its page and tab. After every page change inside the preview ConfigSync calls `router.refresh()` once, because a draft saved while the navigation was in flight refreshed the old page. `/admin/preview/[page]` renders a placeholder, **not** `notFound()`, for a page that isn't in the draft yet: a new page is opened before its 500 ms autosave, and Next keeps a not-found boundary until the address changes, so the refresh after the save couldn't replace it.
- **WebSocket gotcha this caused**: Next.js adds its own `'upgrade'` listener to the custom server on the first request it handles (dev hot reload goes through it) and ends the socket of any upgrade whose path matches a route. With the root `[page]` route, `/ws` matches, so every visitor's WebSocket was closed right after we accepted it (close 1006; caught by `overlay.test.ts`'s viewer count). `websocket-server.js` therefore wraps `server.on`/`addListener`: any `'upgrade'` listener other than its own `onUpgrade` never sees `/ws`, and `onUpgrade` handles **only** `/ws`. Don't "simplify" this into removing Next's listener: passing hot-reload upgrades to `app.getUpgradeHandler()` alone never completes their handshake in `next dev`, and since a browser opens one WebSocket to a host at a time, `/ws` then never connects either (0 viewers, no live data) — the production integration tests can't see that.
- Page addresses are lowercase-only, so the routes look `/Page-2` up in lower case, and `linkTarget()` does the same; only address-shaped names count as page links (`/cv.pdf` is a file, not a missing page).

### Admin panel: where the guards are
- "Admin enabled" = (`ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD` set) **and** `APP_ROLE !== "public"`. It is checked in three places on purpose: `websocket-server.js` answers a plain 404 for `/admin*` and `/api/admin*` before Next.js sees the request; `src/app/admin/layout.tsx` calls `notFound()`; every API handler is wrapped in `withAdmin()` (404 disabled / 403 cross-site write / 401 no session). **There is no middleware** — a new admin route is unprotected unless it is exported as `withAdmin(...)`. `login/route.ts` is the one handler that can't use the wrapper and repeats the enabled + same-origin checks itself.
- The server-level 404 exists because a page-level `notFound()`/`redirect()` under a `loading.tsx` boundary is streamed with HTTP 200 (the body is the not-found/redirect, but the status is already sent).
- **Password storage**: `src/lib/admin/password.js` (scrypt, format `scrypt:N:r:p:salt:hash`, base64url — no `$`/`=` so it needs no escaping in `.env` or compose files). It is deliberately plain CommonJS because three things load it: `auth.ts`, `websocket-server.js` (startup validation) and `scripts/admin-hash.js` (the generator behind `npm run admin:hash`). If `ADMIN_PASSWORD_HASH` is set it always wins, and a malformed hash fails closed (no sign-in) instead of falling back to the plain password. `websocket-server.js` logs a warning at startup when plain `ADMIN_PASSWORD` is used in production, and an error when the hash is malformed.
- CSRF: writes require `Sec-Fetch-Site: same-origin`, or (when the browser doesn't send it, e.g. plain-HTTP non-localhost) an `Origin` whose host equals `X-Forwarded-Host`/`Host`. A reverse proxy in front of the admin container must pass the host through. `curl` needs `-H "Origin: http://host:port"`.
- The session cookie is `Secure` only when the request arrived over HTTPS (`X-Forwarded-Proto` or the URL), so plain-HTTP LAN access works.
- Sessions live in SQLite (`admin_sessions`, token stored hashed), so they survive restarts and are shared by containers on the same `DATA_DIR`. The login throttle is in-memory per process.
- `/api/admin/integrations` reports only *whether* env vars are set. Never return their values from any route.

### Everything admin lives under `/admin` and `/api/admin` — keep it that way
- The supported deployment routes **only those two path prefixes** to the admin container; every other request on the hostname (`/`, `/_next/*`, `/ws`, `/api/*`) goes to the public container, where admin is off. So anything that needs an admin session or the draft must be served from under one of the two prefixes. This is why the draft preview is the route `/admin/preview` and not a query param on `/`.
- The session cookie is set twice, with `Path=/admin` and `Path=/api/admin` (`setSessionCookie` in `auth.ts`, raw `Set-Cookie` headers because `NextResponse.cookies` keeps one cookie per name). The browser therefore never sends the token to the public container. Don't widen it to `Path=/`.
- Consequences of the split: admin pages load their JS/CSS (`/_next/...`) from the **public** container, so both containers must run the same build; the preview's widgets get their data (`/api/presence`, `/api/steam`, `/ws`, …) from the public container, so the admin container needs no integration keys in this setup (it does if it is opened directly on its own port).
- `src/app/admin/layout.tsx` is only the "admin enabled" guard. The panel's wrapper and CSS are in the `(panel)` route group so that `/admin/preview` renders as the plain site.

### Draft, preview and publish
- Three states: **published** = `src/config/homepage.json` on disk; **draft** = one row in `admin_state` (`config.draft`); **working copy** = React state in `components/admin/store.tsx`. The store autosaves the working copy to the draft 500ms after the last change (`PUT /api/admin/config`), and deletes the draft when the working copy equals the published config again — "has a draft" always means "differs from live".
- Draft saves and publish use `strictParseConfig` (nothing dropped, duplicate ids rejected). An invalid working copy is simply not saved: the issues are shown in a banner and Publish is disabled. The lenient `parseConfig` is only for reading files and old drafts.
- `store.tsx` keeps `{ config, past, future, group }` in **one** state value so updates are pure (Strict Mode double-invokes updaters — don't call another setState inside one). `serverDraft` (ref) mirrors what the server holds so no-op saves are skipped; saves are chained on one promise so they never overlap or reorder.
- **Typing is grouped into undo steps** (`store.tsx` `typingStep()`, rules pure in `components/admin/typing-history.ts`, unit-tested). An `update()` made while an `input` event is being handled (`window.event`) and focus is in a text-like field (text, number, color, range inputs, textareas; not checkboxes, selects or buttons) joins that field's current step: the config is replaced and no undo entry is added (`doc.group` = the step id of the newest entry). A step ends after 1.5 s without typing, on any `focusout`, on undo/redo, on any non-typing edit, and in bigger fields (textareas, or text over 60 characters) every 4 words, right after the space. The word under the caret doesn't count when a step starts. It is detected in the store, so form controls and the ~20 `update()` callers need nothing; an async edit (an upload that finishes) never joins a typing step because no `input` event is being handled then.
- **Preview** = the real page: `/admin/preview` renders `SitePage` (the same component `/` uses) from the draft, and redirects to the sign-in page without a valid admin session. The admin panel embeds it in an iframe and, after each successful draft save, posts `PREVIEW_REFRESH`; `ConfigSync` inside the iframe calls `router.refresh()`. `{ type: PREVIEW_TAB, tab }` makes the preview show the tab selected in the builder. `Tabs.tsx` and `ConfigSync` build tab URLs from `window.location.pathname`, never a hard-coded `/`, so tab switches inside the preview stay on `/admin/preview`.
- The preview iframe must stay mounted across the Builder/Site/Background/Effects screens — `AdminApp` keeps `<PreviewPane>` at the same position in the tree for all four. Moving it inside a per-screen component would reload the iframe on every screen switch.
- **Publish** (`publishConfig`): stores the previous file content in `config_revisions` (last 50), writes a temp file and renames it over `homepage.json` (falls back to an in-place write if the file itself is a mount point), then clears the draft. The loader notices via mtime; `websocket-server.js` polls the file with `fs.watchFile` (2s) and broadcasts `{ type: "config" }`, on which `ConfigSync` refreshes every open page. This works across containers because it is driven by the file, not by an in-process call — hand edits trigger it too.
- Because the tab list can now change under a mounted page, `Tabs.tsx` clamps `activeTab`/`mountedTab` to the current length (`activeIndex`/`mountedIndex`) — index with those, not the raw state.
- Restoring a revision only loads it into the draft; nothing goes live without Publish.
- Markdown files (Content screen), comment moderation and the Inbox are **not** part of the draft — they apply immediately.

### Admin forms are generated from the schema
- `components/admin/schemas.ts` converts the zod schemas with `z.toJSONSchema(schema, { io: "input" })`; `SchemaForm` walks the result. A control is chosen from the JSON Schema type plus the `ui` hint set via `.meta({ ui })`: `color`, `gradient` (string array as color stops), `textarea`, `icon`, `tristate` (optional boolean: unset = inherit), `content-file` (dropdown of every markdown file under `src/content/`, grouped by folder), `emoji-list`, `time` (HH:mm picker). `.meta({ labels: { value: "Name" } })` gives enum values display names. An array of enum values (e.g. weekdays) renders as toggle buttons. Enums with ≤ 5 options render as a segmented control; bounded numbers get a slider; arrays of objects get a collapsible list editor.
- "Optional" = not in `required` and no `default`. Clearing an optional string/array/boolean **removes the key** rather than storing `""`/`[]`/`false`.
- `id`, `version` and any `const` property (a section's `type`, `background.base.type`) are never rendered. Don't hide keys by name beyond that — `background.effect.type` is a real, editable field.
- Adding a field with `.meta({ title, description })` to a schema is all it takes for it to appear in the panel. Text the owner writes also needs `translate: true` (or `"name"`, see "Languages").

### Builder drag and drop
- One `DndContext` with prefixed ids: `tab:<id>`, `sec:<id>`, `new:<widget type>` (palette), plus the droppable `section-list`. `onDragEnd` branches on the prefixes: tab→tab reorders tabs; sec→sec reorders within the open tab; sec→tab moves the widget to that tab; new→sec inserts before it; new→tab / new→list appends.
- The custom collision detection restricts a dragged tab to tab targets and otherwise prefers `pointerWithin` over `closestCenter`.
- `PointerSensor` has a 6px activation distance so a click on a row still selects it. Rows are draggable as a whole; there is no separate handle. The inspector's "Move to tab" select is the non-drag alternative.
- New ids come from `uniqueId()` (`<tabId>-<type>`, de-duplicated across the whole config). A tab's id never changes when it is renamed.
- **Grid view** (grid tabs and the bento layout; a Grid/List toggle in the outline head): the tab's widgets as a 12-column mini grid that packs exactly like the site (CSS grid, no `dense`). Tiles are `useDraggable` (`sec:<id>`, so dropping on a tab still moves it) **and** `useDroppable` (`cell:<id>`), plus `grid-end` below the grid. The drop side comes from the pointer (`activatorEvent` + `delta`; keyboard drags fall back to the element's centre): outer 30% left/right = beside, otherwise top/bottom half = new full-width row above/below the target's row.
- Row logic is pure in `components/admin/grid-layout.ts` (unit-tested in `tests/unit/grid-layout.test.ts`): `packRows` (CSS greedy wrap), `fitRow` (proportional integer spans summing to 12, min 3 — lowered for hand-made rows of 5+), `placeInGrid` (removes the item first, so moves within a row work), `removeFromGrid` (widens the rest of the row). Every row an operation touches sums to 12 so the rows below keep their packing; new rows are span 12 (also in bento, where an unset 6 would pull the next widget up); spans equal to the layout default are stored as no `span`. A row holds at most 4 widgets: "beside" a full row is refused — red edge + red hint in the drag overlay while hovering, a floating toast after the drop, and the `DragOverlay` drop animation carries the widget back (`dropAnimation` is only set for a refused drop).
- The drop's result is computed against the current config **outside** the updater (for the warning), then recomputed inside one pure `update()` — one undo step, Strict-Mode safe. Delete, "Move to tab" and Duplicate in grid tabs go through the same functions (the source row is refilled; a duplicate goes beside the original, or below it when the row is full).
- **Rows** (grid view): the outline renders one 12-column grid per row (from `packRows`, identical to the site's wrapping), each with a slim handle on rows of 2+ widgets. The handle selects the row (`selection.kind === "row"`, identified by any member's id — rows have no id). The row inspector and the widget inspector (when the widget shares a row) show `RowEditor` (`LayoutControls.tsx`): segments per widget, dividers to drag (arrow keys when focused), presets from `rowPresets(n)`, "One per row" (`splitRow`). Widths always total 12 (`moveDivider` only trades between two neighbours, min `minSpanFor(n)`; `setRowSpans` refuses anything else), so editing a row never re-packs the rows below. A divider drag keeps the widths in local state and commits once on release = one undo step. A hand-made row that doesn't fill 12 is shown scaled to 12 (`fitRow`) with a note. A widget alone in its row still gets the single-widget `SpanControl`.
- **Dropping onto the preview**: palette widgets and outline rows/tiles can be dropped straight onto the page in the preview. `useBuilder()` returns `dnd(children)`, and `AdminApp` wraps the **whole** work area of all four draft screens in it (one `DndContext`; wrapping only the builder screen would change the preview's place in the tree and remount the iframe). `PreviewPane` is the droppable `preview`; while a widget is dragged it puts a transparent `.adm-drop-layer` over the iframe, because an iframe swallows the pointer events the drag needs. The collision detection never picks `preview` as the "closest" target, only when the pointer is on it.
  - The iframe is same-origin, so the panel reads the page's layout directly: in the preview only (`WidgetContext.preview`, set by `SitePage`), `TabSections` puts `data-tab-id` on each tab's widget container and `data-section-id` on each widget's wrapper. `previewCandidates(doc)` collects their boxes (an empty tab = its container as an "end of tab" target; zero-size widgets are skipped). `pickTarget` takes the widget under the pointer, else the nearest one. The **target tab comes from the DOM**, not the builder's open tab: one page shows every tab, and the profile layout shows the column tab too.
  - "Beside" is offered only when that container is a grid with more than one column **right now** (computed `grid-template-columns`), so Phone mode and narrow columns get above/below only. Grid tabs then go through `placeInGrid` (same rules, refusals and toast as the outline); stack / masonry / column tabs through `placeInList`. A widget from another tab leaves it in the same `update()` (one undo step).
  - Mid-drag, the wheel lands on the `DragOverlay` under the pointer, so a window `wheel` listener scrolls the preview instead, and the pointer near the preview's top or bottom edge auto-scrolls it. Scrolling re-runs the hit test from the last pointer position.
  - After a drop the builder opens the target tab, but sets `shownSlug` first: `PreviewPane` posts `PREVIEW_TAB` only when the slug differs from what the preview is known to show. Otherwise the one-page preview would scroll away from the widget that was just placed. An "Adding…" marker stays until the next saved draft (≈ 500 ms autosave + refresh).
  - **Moving from the preview**: pointer events that start inside the iframe can't drive the panel's `DndContext`, so `PreviewPane` reads the iframe's own `pointermove` (same-origin) to find the widget under the pointer and floats a `MoveHandle` pill over it in the panel (builder screen only, `editable`). The handle is a `useDraggable` with id `move:<id>` (dnd-kit needs unique ids and the outline row is already `sec:<id>`); the builder maps it to `sec:<id>` (`dragId`) and from there it is an ordinary widget drag: onto the preview, the outline grid/list or a tab row. A click (under the 6px activation distance) selects the widget. `draggedItem` therefore searches **every** tab, and each drop path goes through `moveInto()`, which takes the widget out of whichever other tab held it in the same edit. The handle stays mounted during its own drag (it is the drag's source); the `DragOverlay` gets a `min-width`, because dnd-kit sizes it like the small pill.
- **The builder follows the preview**: `Tabs` (a tab click, the drawer, the bottom bar) and `OnePage` (jump bar and scroll-spy) call `reportPreviewTab(slug)` (`ConfigSync.tsx`), which posts `{ type: PREVIEW_SHOWN, tab }` to the parent only inside `/admin/preview`'s iframe. Neither reports its first render (it is tab 0 before `?tab=` is applied). `PreviewPane` accepts only messages from its own iframe; the builder records the slug in `shownSlug` before opening that tab, so nothing is sent back (no echo, no one-page jump). It is ignored while something is being dragged, so edge auto-scrolling a one-page preview doesn't swap the outline mid-drag.
- The toast is `position: fixed` on purpose: an in-flow message that disappears when the next drag starts shifts the tiles under the pointer mid-drag. Grid tiles have no keyboard drag (plain droppables have no keyboard coordinates); the List view is the keyboard route. Stack tabs show a hint in the inspector pointing to the tab's "Arrange widgets → Grid".

### Comment moderation
- `src/lib/comments.ts` owns the `comments` table: it adds `status` (`pending`/`approved`/`rejected`, default `approved` so pre-existing rows stay visible), `visitor_hash`, `edited_at`, `moderated_at` via `ALTER TABLE` when missing.
- Moderation settings (`mode: "off" | "pre"`, `holdWords`) are stored in the database (`admin_state` key `comments.moderation`), **not** in `homepage.json`, so they apply immediately and are shared by the public and admin containers. `initialStatus()` decides a new comment's status: `pre` → pending; otherwise pending only if name/body contains a held word (case-insensitive substring).
- Public `GET /api/comments` returns approved comments plus the requesting visitor's own pending ones, flagged `pending: true` (the widget shows "Awaiting approval — only you can see this"). `status` and `visitor_hash` never leave the server on the public route; the admin list exposes only the first 8 hex chars as an author tag.
- Blocking is by `visitor_hash` (`blocked_visitors`): a blocked visitor's `POST` gets 403. It is a cookie-based id, so it stops casual repeat offenders, not a determined one. Comments older than the moderation columns have no hash and can't be blocked.
- Every moderation action is written to `audit_log` (`comment.*`); the Comments screen shows the latest 30.
- The pending badge in the admin nav is polled every 30s (not pushed), because the admin and public sites may be different processes.

### Site layouts and the grid
- `layout.site` picks the shell, all assembled in `SitePage.tsx`; `PAGE_WIDTH` there maps each layout to its page column width (full Tailwind class names — don't build them dynamically, Tailwind can't see computed names).

  | Layout | Width | How it is built |
  |---|---|---|
  | `tabs` | 870px | `SiteHeader` + `Tabs` (top bar) |
  | `sidebar` | 1180px | `Tabs nav="side"`: from `md` up a sticky 230px left column with `SiteHeader variant="side"` + vertical nav; the top header and tab bar are `md:hidden`. Below `md` it is identical to `tabs` (compact bar + drawer). |
  | `onepage` | 870px | `OnePage`: every tab rendered as a `<section>` (all widgets mounted at once), sticky horizontally scrollable jump bar, `IntersectionObserver` scroll-spy. `?tab=<slug>` scrolls to that section. Section headings optional (`layout.sectionHeadings`). |
  | `bento` | 1280px | `Tabs`; every tab is a grid, `layout.bentoColumns` widgets per row (default span `12 / bentoColumns`) unless a widget has its own `span`. |
  | `linkinbio` | 480px | `Tabs` with `hideNavIfSingle` — no navigation when there is one tab. Every tab is a stack (the column is too narrow for a grid). |
  | `masonry` | 1280px (`fullWidth`: none) | `Tabs`; `TabSections` renders `.section-masonry` (CSS `column-count`, `break-inside: avoid`): 1 column, 2 from a 600px container, `masonryColumns` (3) from 960px. Spans and the tab's stack/grid don't apply. Reading order runs down each column; a widget whose height changes live can move columns (acceptable; switch to round-robin flex columns if it gets bad). |
  | `profile` | 1240px | `Tabs` with `column`: the tab `layout.pinnedTab` (`pinnedTabId()`: only if it exists and another tab is left; unset = no column) is removed from the tab bar and rendered as a stack in a sticky 300px `<aside>` beside the content (`md:sticky`, own scroll when taller than the window; above the content on phones). The tab bar stays full width above both. Its own background/arrange are ignored (panel says so; outline badge "column"); selecting it in the builder doesn't move the preview (`tabSlug` ""). |
- **What a layout does with each tab's settings is one table: `LAYOUT_FEATURES` in `src/lib/layouts.ts`** (pure, unit-tested in `tests/unit/layouts.test.ts`): `arrange` (`choice` = the tab's own stack/grid, `grid` = bento, `stack` = link in bio, `masonry`), `tabBackground` (off in one page), `tabNav` (`multiple` = labels only shown with 2+ tabs: one page, link in bio), `tabBar` (built on `Tabs`, so `mobileNav` applies — not one page), `pinnedColumn` (profile). `arrangeOf(options, tab, pinnedId)` is the per-tab result (the pinned tab is always a stack). `gridOptions(layout)` → `{ arrange, defaultSpan }` is what `SitePage` passes down and what the builder uses (`isGridTab`); `ignoredTabSettings()` gives the tab inspector the fields to hide (via `SchemaForm`'s `hide` prop — values stay in the config, so switching back restores them) and the one-line reasons it shows instead. A new layout = one row there; never special-case `layout.site` in a component again.
- **The grid responds to its own column, not the window**: `TabSections` wraps a grid tab in `.section-grid-wrap` (`container-type: inline-size`) and `.section-grid` becomes 12 columns at `@container (min-width: 640px)`. So the sidebar's content column at medium window widths stays one widget per row. Note the container makes the wrapper a containing block for `position: fixed` descendants — widget popups must portal to `body` (the Steam popup does).
- **Bottom tab bar on phones** (`layout.mobileNav: "bottom"`, `bottomNav()`): `Tabs` hides the top compact bar below `md` and renders a fixed bottom `<nav>` (icon over label, scrolls sideways with the open tab kept in view; the drawer code path is untouched and simply never opens). `SiteShell` sets `data-bottom-nav` on `<main>`; `globals.css` then pads the page end and lifts every `.site-fixed-bottom` element (the counters, the theme switch) by `--bottom-nav-h` (60px + `env(safe-area-inset-bottom)`). A new fixed bottom element needs that class. `viewport-fit=cover` is deliberately not set (it would push content under the notch elsewhere), so the safe-area inset is 0 on most phones.
- **Scrolling button rows** (`useScrollStrip` in `components/useScrollStrip.ts` + `.scroll-strip` in `globals.css`): the one-page jump bar and the desktop tab bar. When the buttons don't fit, the row scrolls sideways, keeps the `aria-current` button in view (scrolling the row only — never `scrollIntoView`, which would scroll the page; positions from bounding boxes, so it doesn't matter whether the row is the buttons' offsetParent), fades the edge(s) with more beyond (`--fade-l` / `--fade-r`), hides its scrollbar (`!important`: `html.custom-scrollbar *` is more specific and brought it back), has side padding for the hovered tab's growth (else the end tab of a right-aligned or split row made it scroll), and `overflow-y: hidden` so hover-scaled tabs add no vertical scroll. The tab bar's row is a flex item, so it needs `min-w-0` — without it it refused to shrink and ran out of the 480px link-in-bio column on the right. Link in bio uses this one row of small tabs at **every** width, phones included (`uniformNav` in `LAYOUT_FEATURES`: no menu button/drawer, no bottom bar — `bottomNav()` is false — so its navigation looks the same on phone and PC; header and gutters still follow the normal sizes).
- **Centring is `.is-centered`** (`justify-content: safe center`, plain `center` first as a fallback; `.is-right` likewise with `safe flex-end`): centred while it fits, starting at the left when it overflows (plain `center` pushes the first buttons out of reach). **Don't write `justify-[safe_center]`**: Tailwind 3 has no arbitrary values for `justify-content` and silently generates nothing (that is how the one-page bar ended up left-aligned on desktop).
- **Tab layout** (`tab.layout`): `stack` (one widget per row) or `grid`. `TabSections` renders both for every site layout. The grid is CSS `.section-grid` in `globals.css`: one column below `md`, 12 columns from `md`, each cell `grid-column: span var(--span, 12)`. The span is passed as a CSS variable because inline styles can't be responsive. Rows are auto-height and items keep DOM order (no `grid-auto-flow: dense`) — widgets have intrinsic, animated heights, so there is deliberately no x/y/height placement.
- `span` (1–12) lives in `base()` (`widgets/fields.ts`), so every section type has it. It is ignored in a stack. Unset = the layout's default (12 in a grid tab, `12 / bentoColumns` in bento).
- The `Tabs` transition logic (three-phase fade, `transitioning` guard, mobile drawer) is unchanged and shared by `tabs`/`sidebar`/`bento`/`linkinbio`; only the navigation chrome differs via props. `OnePage` has no tab state at all.
- One-page scroll-spy details: a clicked section stays highlighted for the duration of the smooth scroll (`jumpUntil`), and reaching the end of the page highlights the last section, because a short last section can never reach the observer band.
- **Tailwind scans `src/widgets/` too** (`tailwind.config.ts`). Any new folder that contains class names must be added to `content`, or its classes are silently purged — the HTML still looks right in a diff, only the CSS is missing.
- Admin: the Header & layout screen's `LayoutPicker` replaces the generated control for `layout.site`; the layout's own options (`bentoColumns`, `sectionHeadings`, `showIf` on `site`) are a `KeyForm` under it with `site` hidden. `span` is in `SchemaForm`'s hidden keys and edited with `SpanControl` (a 12-cell bar to click/drag, presets, "use the default") in the builder's inspector, shown only where a grid applies (`isGridTab`: a grid tab, or every tab in bento; never in link in bio); outline rows then show a `n/12` badge.

### Banner (`banner.*`, `Banner.tsx`)
- **One component for every page**: `Tabs` and `OnePage` render `<Banner>` themselves (the tab bar is part of it; `SiteShell ownBanner`), `SiteShell` renders it for pages without tabs (blog posts, a page with no tabs yet). `SitePage` (server) prepares `BannerSetup` = resolved options + the `SiteHeader` element. The defaults render exactly the banner from before it had settings (checked by pixel comparison in all seven layouts, desktop and phone).
- **Phones' own settings** (`banner.phone`, optional): a whole second set (`BannerOptionsSchema`, no nesting) used below `md` (`PHONE_QUERY`); all or nothing like the page settings groups, so a field it leaves out is the schema default, not the other set's value. Unset = one set for every screen. `bannerOptions()` returns `{ options, phone? }`; `Banner` server-renders both with `max-md:hidden` / `md:hidden` and, once the width is known (`usePhone`, null while hydrating), keeps only the visible one mounted. Only the `active` one may write `--banner-h` / `--banner-shown`. Code that needs the set in JS (`OnePage.scrollTo`) picks it with `PHONE_QUERY`. The floating theme switch is shown per screen kind (`FloatingThemeSwitch`). The sidebar column always uses the wide set. In the panel the set being edited **is** the preview's Desktop/Phone switch (`device` in `AdminApp`), so you see what you edit; `ignoredBannerSettings(layout, set, screens)` hides fields per set.
- **What a layout ignores** is `LAYOUT_FEATURES[site].banner` (`full` / `stacked` / `column`) → `bannerOptions()` (site) and `ignoredBannerSettings()` (panel: hidden fields + notes). `Banner` never looks at `layout.site`.
- **Stacked + `tabs`** (default): the title scrolls with the page, only the bar is sticky. **Stacked + `hide`/`all`**: title and bar share one sticky wrapper with `.bg-tab-bar` (so the blur covers both). **One row**: the row is the sticky element; with `tabs` the title makes room once scrolled (`data-away` on `.banner-row`): on wide screens its width collapses (grid `1fr` → `0fr`), on phones the open tab's name replaces it. Its **height never changes**: a sticky element that shrinks moves the page under it and flips the state back.
- One row on phones: menu button + title; bottom tab bar → the row scrolls away (`max-md:static`); one page → its jump strip is a second line (`data-banner-keep`), and with `tabs` the sticky `top` is minus the first line's height. A centered title splits the tabs (`splitTabs`), so two `TabStrip`s exist.
- `hide` returns on keyboard focus through `has-[:focus-visible]`, not `focus-within` (a clicked tab keeps the focus and the banner would never hide again).
- **`--banner-h`** on `<main>` = height of the stuck part (0 when nothing sticks), used by one-page `scroll-mt` and the scroll-spy band; **`--banner-shown`** = the same but 0 while `hide` has it out of sight, used by the profile column. One-page anchors need the first one (a jump up brings the banner back); a jump down in `hide` mode drops the margin itself (`scrollTo`). Anything else that must stay clear of the banner reads it; don't hard-code the bar's height.
- `setElement` must be passed as the ref itself: an inline ref callback that sets state loops forever.
- **Theme switch**: several `ThemeSwitcher`s can be mounted (tab bar + title on phones with the bottom bar, the sidebar column (beside its title) + phone banner), so the theme is one module-level store (`useSyncExternalStore`).
- Custom rules in `globals.css` come after Tailwind's utilities, so `.banner-*` must not set `display` on an element that uses `md:hidden` (except inside a media query).
- Logos go through `safeUrl()`; their height is an inline variable (`--logo-h`), capped in the bar by `.site-logo.is-bar`.

### Languages (`languages`, `src/lib/i18n/`)
- **A translation belongs to a text in a place**: `texts[place][text] = { to?, same?, check? }`, where the place is the widget / tab / page / site plus the field without list positions (`section:my-links.items.label`, `tab:home.label`, `site.name`). The same text elsewhere is a separate decision, because it may mean something else there: what was decided elsewhere is only **offered** ("Same here", `suggestTranslations()` in `suggest.ts`, also for nearly identical texts), never applied. Positions in lists are not part of the key (items have no ids; an index would silently attach a translation to another item after a reorder), so moving a widget or reordering keeps everything. Fields that must match each other share a place through `translateAs` (game shelf `groupOrder` and `items.group`). Read and write only through `entryOf` / `withEntry` (`Object.hasOwn`: a text can be "constructor").
- **Shorthand** for hand-written files: `texts: { "Home": "Inizio" }` (and lists `same` / `check` of texts) = every place that has the text now. `migrateConfig` collects it under the place `*` and `expandShared()` gives it out when a config is parsed; what is used nowhere goes to `(unused)` and is only offered. The panel store runs `expandShared` before every edit, so a panel that stayed open across a code update can't mix the two shapes.
- **Which fields are text** is `translate: true` in the field's zod `.meta()`; one marker drives the site (`localize`) and the panel (`collectTexts`). `translate: "name"` = translatable, but usually a name (site name, project titles, tools, places, people): such a text is never "missing" but "to check" until the owner translates it or ticks "Doesn't translate" (any other text can be ticked too; `same: true`, per language). Ticked texts count as done and are shown in the original. The list's filters (Missing, To check, Done) split the rows of `translationStatus()` with no overlap (`state`: missing, name + edited, done). `translate: "labels"` = the text is also a key (poll options: votes are stored by them; a notice's title and message: dismissals are): the field stays as it is and the translation goes into `<key>Labels`. A unit test fails for a new widget string field that is neither marked nor listed there as "not text". Strings without letters aren't listed.
- `localize(config, code)` takes the **whole** config, before `pageView()`; it never runs in the client (zod), the server passes translated props. Looking sections up (`findSection`, votes, overlays by id) always uses the original config. Cached per config object and language.
- **A tab's address never changes with the language**: `localize` sets `sourceLabel` on tabs it translates, and everything that needs the `?tab=` slug uses `tabSlug(tab)`, never `slugify(tab.label)`. The builder works on the original, so it may use the label.
- **Editing the original** (`carryTranslations`, called in the admin store's `update`, so it is in the same undo step): where a text is gone from a place and the same position holds one that is new to that place, its decision moves to the new text with `check: true` ("To check" in the panel). Reorders, moves and deletes change nothing.
- **Which language** (`requestLanguage`): `?lang=`, then the `lang` cookie (path /), then `Accept-Language` when `detect`, then the original. No path prefixes on purpose: the page catch-all, reserved addresses, proxy prefixes, site map and preview links all assume bare addresses. The picker sets the cookie and calls `router.refresh()`; `<main lang>` is in the server HTML, `<html lang>` follows on the client (the root layout is shared with the English panel).
- **Present languages** = the original + every `enabled` one, whatever is translated so far (`presentLanguages`). Fewer than two = no picker. The panel shows "N missing" (`translationStatus().count.missing`) in a language's row, and a ⚠ on the Languages tab while a language visitors can choose has any (counts in its tooltip); each missing text has its own badge in the list. The place is `banner.languagePicker` (per page, per phone/wide set): `banner` (`BannerControls`, beside the theme switch), four floating corners (`.lang-float`: above the counters / theme switch / bottom tab bar, below a stuck banner) or `footer`.
- **Preview**: its own cookie `preview_lang` (path /admin), set by `PreviewPane`; it can show a language visitors don't get yet. The Languages screen translates into the language the preview shows (`lang` in `AdminApp`). The preview's own picker reports with `PREVIEW_LANGUAGE`.
- **Markdown files: one folder per language** (`en/blog/hello.md`, `it/blog/hello.md`). A file's **name** never has the language in it: the config, post slugs, the file dropdown and "in use" all use `blog/hello.md`, and `contentCandidates(name, languages, lang)` is the only place that knows where it may be: the translation, the original's folder, no folder (with one language: before the original's folder), then any other language of the site. So a file that isn't in a language folder still works, no translation = the original file, and after swapping the main language with a translation the files only the other language has are still shown. `findContentFile` finally tries any common language's folder (original changed by hand, or a read-only folder).
  - `contentLanguages(languages, published.original)` (panel and admin routes only) adds `previous`: while the draft changes the original, its files are still in the published one's folder. Without it the draft looked for them in a folder that only exists after Publish. `findContentFile()` (server) and `contentPlace()` (path on disk → name + code) are the two ways in; never build such a path by hand.
  - `organizeContent()` runs in the **publish route**, after the config is written: with at least one translation it moves every original into the original's folder (never over an existing file, never out of a folder named like a common language, too-deep files stay); if `original` changed (also with no translations, but not when the old one became a translation), that folder is renamed. Back to one language moves nothing. A failure (read-only content) is a warning in the panel, not a failed publish. Config and files are never out of step, because reading works in both layouts.
  - A folder named like a common language the site doesn't have counts only for files that have an original (`it/about.md` is live as soon as the panel creates it, before Italian is published; a folder just called `it` stays a folder).
  - **The Content screen never shows the language folders**: `languageView()` (`content-tree.ts`, pure, unit-tested) turns what is on disk into one tree of names for the language chosen in its picker (shown with more than one language), each file being the language's `own` or `missing` (`shownIn` = the language shown instead, opened with its text; saving creates it at `saveTo`). Files and folders are added, moved and deleted in the original only, for every language at once; where saving writes is fixed when a file is opened. Languages found on disk that the site doesn't have stay in the picker, so no file is out of reach; originals hidden behind another of the same name are listed with a delete button.
  - A path may be one folder deeper than `MAX_FOLDER_DEPTH` when it starts with a language-shaped folder.
  - `/api/markdown?lang=` and `/api/widgets/posts?lang=` take the language in the URL (responses are cached by URL; `ctx.lang`, unset for the original). Admin `GET content?file=` also accepts a name (the site map reads links that way). Translations are not posts of their own; a version's front matter is merged over the first version with a date (not the summary), `draft: true` in a translation = not used yet, in the original = the post is hidden. Renaming, moving or deleting an original (or a folder of them) takes its translations along.
- **Not translated**: text built into widgets ("No posts yet.", "viewing now", form labels, error messages) and data from other sites. The overlay follows only its own `?lang=`.
- Right-to-left languages: paragraphs get their own direction (`main[data-rtl]`), the layout isn't mirrored (`dir=rtl` would break the full-bleed `ml-[calc(50%-50vw)]` bars).

### Admin panel: resizable side panels
- The builder's left panel and inspector (and the single left panel on Site/Background/Effects) are resized with `Resizer` dividers in `AdminApp.tsx`; widths are applied as an inline `grid-template-columns` on `.adm-work` and remembered in `localStorage` (`admin.panelWidths`, read after mount to avoid a hydration mismatch).
- Limits: 240–760px per panel, and the preview always keeps at least 320px. Double-click or `Home` resets; arrow keys resize (Shift = larger steps).
- The divider uses pointer capture so a drag keeps working while the pointer is over the preview iframe (an iframe otherwise swallows the move events).
- Below 1000px the panels stack and the dividers are hidden.

### Data widgets (weather, rss, github-activity, mastodon, bluesky, chess, youtube, twitch, music, status)
- Flow: the widget (client) calls `/api/widgets/<type>` → `widgetSources[type]` in `src/lib/widget-sources.ts` → the outside service → a trimmed result (only the fields the widget shows). Everything goes through `cached()` (in-memory, per key): success TTLs are 15 min weather, 30 min rss/chess/youtube, 10 min mastodon/bluesky, 2 min twitch/music, 1 min status, 3 h github-activity (24 h for a YouTube handle → id); failures are cached 5 minutes; concurrent requests share one fetch.
- **Nothing polls.** Data is fetched only when a visitor's widget asks, so "no viewers → no outbound queries" holds without touching the idle-pause logic in `websocket-server.js`.
- **Never fetch a URL taken from the request.** Sources with a fixed host (weather, chess, bluesky, github-activity) take strictly validated values from the query string. Sources whose host the site owner typed (rss, mastodon, status), and sources that spend the owner's API key (twitch, music — otherwise anyone could look up any account on that quota), take a **section id** and read the address from the config via `findSection()` — otherwise the endpoint would be an open proxy. `findSection` looks in the published config first, then the admin draft, so the panel's preview works before publishing. Those widgets still add the address to their request URL as an ignored param (`u=` / `k=`) only so the URL changes — and the widget refetches — when the setting changes.
- Errors meant for the widget are `WidgetError` (message shown as-is, in the interface's voice: say what to fix). Anything else is logged with `[Widgets]` and shown as a generic line.
- `github-activity` has no key-less API; it parses the public calendar fragment GitHub's own profile page loads (`/users/<name>/contributions`): `data-date` / `data-level` on the cells, counts from the matching `<tool-tip for="…">`. If GitHub changes that markup the widget shows "could not be read" — the parser in `widget-sources.ts` is the one place to fix.
- `rss` uses a small regex parser (RSS `<item>` and Atom `<entry>`), not an XML library. Titles are plain text (`htmlToText`); links pass `httpUrl()` so only http(s) reaches the browser.
- Text from other sites (posts, feed titles) is always rendered as React text, never `dangerouslySetInnerHTML`. Mastodon's HTML is flattened with `htmlToText`; a post with a content warning shows only the warning.
- `embed`: `toPlayer()` maps a link to that site's own player URL for four known hosts and nothing else; the iframe is sandboxed. YouTube uses `youtube-nocookie.com`.
- `countdown` sizes itself with a **container query** (`.countdown` in `globals.css`, the project's first): numbers scale with the widget's own width (`cqi`) and labels shorten to days/hrs/min/sec below 300px, because a grid column can be far narrower than the window, so `sm:` breakpoints don't help there.
- `clock` / `countdown` render the time only after mount (server and client HTML must match); the countdown's `target` is wall time in the widget's `timezone`, converted with `zonedTimeToMs`.
- `poll`: votes in `poll_votes` (primary key `poll_id` + `visitor_hash`, so one vote per visitor, replaced on re-vote), keyed by **option text** — renaming an option starts it from zero, removed options' votes are ignored. The poll must exist in the config (`findSection`) for votes to be accepted.
- Client-side building blocks are in `src/widgets/common.tsx`: `useWidgetData(url | null)` + `DataCard` handle "not set up yet" / loading / error so each widget only writes its success state. `Card` uses `bg-white dark:bg-[#2b2d31]`, which is already in the card-opacity selector list.
- The admin palette groups widgets by `meta.category` (`PALETTE_GROUPS` in `Builder.tsx`); a new category needs an entry there. New form hints: `date`, `datetime`, `timezone`, `time`.

### Contact form and Inbox (`contact` section + `/api/contact` + `/api/admin/messages`)
- `POST /api/contact` is public (served by the public container); the message is stored in `messages` (`src/lib/messages.ts`, same `visitors.db`) and read only through the admin routes, so both containers see it via the shared `DATA_DIR`. A message is accepted only for a `contact` section that exists (`findSection`), so a site without the widget accepts nothing.
- Abuse limits: one message per visitor hash per 30s, **plus** a global cap (30 per 10 min across everyone — a fresh cookie is a fresh visitor, so the per-visitor limit alone doesn't stop a flood), `isBlocked()` (the same `blocked_visitors` table as comments — blocking from either screen blocks both), and a honeypot field `website` that is answered with 201 but never stored.
- Use `cleanText()` from `messages.ts`, not `comments.ts`'s `sanitize()`: `sanitize` strips `\n`, which a message needs.
- The admin nav's Inbox badge is polled every 30s together with the comments badge (`messages?counts=1`). Only deletions and blocks are audited (`message.*`); marking read is not.
- **ntfy notifications** (`src/lib/notify.ts`): see "Admin notifications (ntfy)".
- Message text is rendered as React text everywhere (the widget never shows messages back; the Inbox uses `white-space: pre-wrap`).

### New data widgets (youtube, twitch, music, status)
- **youtube**: `@handle` is resolved to a `UC…` id once per day by reading the channel page (canonical link / `externalId`) with the `SOCS=CAI` cookie so the EU consent interstitial doesn't hide it; the feed is `youtube.com/feeds/videos.xml?channel_id=…` parsed by `parseYouTubeFeed()` (not `parseFeed`, which drops `yt:videoId`/`media:*`). Shorts are recognised by a `/shorts/` link. Thumbnails are built as `i.ytimg.com/vi/<id>/mqdefault.jpg` (16:9).
- **twitch**: the app access token lives in a module variable until a minute before `expires_in`; a 401 from Helix clears it. Missing env → a `WidgetError` naming the variables. With `hideOffline` the widget draws its own title row and frame (`titled: false`, `frame: "self"`) so nothing at all is left on the page while offline.
- **music**: ListenBrainz (`playing-now` + `listens`) or Last.fm (`user.getrecenttracks`, `LASTFM_API_KEY`). Covers come from the Cover Art Archive only for valid MBIDs; Last.fm's grey-star placeholder image is dropped. No `requiresEnv` on the meta, because ListenBrainz needs nothing.
- **status**: like rss, the request carries only the section id (`u=` is ignored); addresses come from the config. It uses its own `fetch` (`redirect: "manual"`, 8s timeout, body cancelled) instead of `getJson`/`getText`, because a non-2xx answer is a result, not an error, and the cached function never throws. `serviceState()`: <400, 401 and 403 = up, other 4xx = degraded, 5xx / no answer = down. Only `{ state, code, ms }` per service is returned. The owner can point it at LAN addresses on purpose; the section (addresses included) is serialized into the page, so the field description says they are public.
- `useWidgetData(url, refreshMs)` re-fetches on that interval while the document is visible (twitch and music 2 min, status 1 min). A failed refresh keeps the data already shown. This is client polling only while someone is looking, so "no viewers → no outbound queries" still holds.
- Uploaded images are re-encoded with `sharp(input, { animated: true })`, so animated GIF/WebP uploads (88×31 buttons) keep their frames.
- `src/lib/url.ts` holds `httpUrl()` so client widgets can sanitize config links without importing `widget-data.ts` (which pulls in the config loader).

### Gaming widgets (speedrun, tetrio, game-server, steam-rare, play-history, game-shelf, play-with-me)
- Sources live in `src/lib/gaming-sources.ts` and are spread into `widgetSources`, so they go through `/api/widgets/<type>` and `cached()` like the other data widgets. TTLs: speedrun 30 min, tetrio 10 min, game-server 1 min, steam-rare 6 h (each game's achievements 12 h), play-history 5 min.
- **Fixed hosts** (speedrun, tetrio) take a validated username from the query. **game-server** takes a section id (`findSection`), because the owner types the addresses and A2S sends UDP to them; **steam-rare** takes a section id because it spends `STEAM_API_KEY`.
- **A2S** (`src/lib/a2s.ts`): only A2S_INFO (one packet). Modern servers first answer `0x41` + a 4-byte challenge that must be appended to a resent request; the parser ignores split (`0xFFFFFFFE`) packets. 3 s timeout, DNS resolved first so IPv6 hosts work. Player count = players − bots.
- **mcsrvstat.us** gets the address exactly as typed: it resolves Minecraft SRV records only when no port is given (`2b2t.org` is online, `2b2t.org:25565` is not), so never append a default port for Minecraft. A2S does get the default 27015.
- **mcsrvstat.us** returns a MOTD with HTML entities in `clean` (decoded) and a base64 `icon`; only a `data:image/png;base64,` icon under 30 kB is passed on. Player names are filtered to plain characters.
- **steam-rare**: `GetOwnedGames` (with `include_appinfo`) → the `scanGames` most-played games that have stats → per game `GetPlayerAchievements` (unlocked only) plus `IPlayerService/GetGameAchievements/v1?appid=&language=english` (no key, undocumented but what Steam's own achievement pages use): names, descriptions **including hidden ones**, icon file names (→ `steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/<appid>/<file>`) and `player_percent_unlocked`, mapped by `fromGameAchievements()`. If it fails, it falls back to `GetGlobalAchievementPercentagesForApp` + `GetSchemaForGame`, which omit hidden descriptions. Percentages come back as **strings** — always `Number()` them. 4 games in flight at once. A private "Game details" setting shows a clear error. The `profile` header's name/avatar come from `GetPlayerSummaries`, cached separately for 1 h (`steam-rare:player`); if that fails the header falls back to the trophy badge. Hidden achievements (spoilers) are covered (lock icon, game + rarity only, "Show hidden achievement") unless `showHidden`. The card copies the Steam widget's surface/header/section styling (no progress bars — the percentage is the rarity); achievements under 10% get the `.rare-ring` (rotating gold conic gradient via the registered `--rare-angle` property, plus a shine sweep; stills under `prefers-reduced-motion`) in `globals.css`.
- **TETR.IO** (`ch.tetr.io/api/users/<name>` + `/summaries`): league `rank` `"z"` = unranked this season, `standing: -1` = no global rank; Quick Play altitude is under `zenith.record` or, outside the current week, `zenith.best.record`. TETR.IO and Speedrun.com block some image requests (Speedrun.com covers sit behind a Cloudflare challenge; TETR.IO rejects headless browsers), so their `<img>`s fall back to an initial on `onError` — don't remove that.
- **game-shelf** is static (no endpoint). Cover tiles show the title, stars and note on a dark fade: stars always, title and note (up to 8 lines) on hover / keyboard focus. Hover zooms the cover 1.1× and raises it (`z-10`) over its neighbours; one-line rows have extra padding (`py-3 px-2`) because a scroll container clips anything that overflows it, and their caption has `mt-3` so the zoomed cover doesn't cover it. One-line group rows print the title under the cover instead, so they pass `hoverTitle={false}`. Covers try the owner's image, then `store_item_assets/steam/apps/<appid>/library_600x900.jpg`, then `header.jpg` (both plain paths still work for new games), then a title tile.
- **play-with-me** is client-only: it subscribes to the existing `presence` and `steam` WS messages and fetches `/api/presence` + `/api/steam` on mount. Logic is in `widgets/play-with-me/status.ts` (pure, unit-tested). In `auto`, Discord online from the phone only (`clientStatus.mobile` without `desktop`/`web`) is the `mobile` state ("Probably away, on my phone", green phone icon) — Steam online doesn't override it, since that can be the Steam phone app; idle on the phone stays plain `away`. `fetchSteamData` passes `gameid` and `lobbysteamid` for the opt-in `steam://joinlobby` link — **never** `gameserverip`.

### Play history recorder (`play-history.js` + `src/lib/play-history.ts`)
- `websocket-server.js` starts `play-history.js` (CommonJS — it can't use `db.ts`) when the Discord bot env vars are set. It opens its **own** better-sqlite3 connection to `DATA_DIR/visitors.db` (same path logic as `db.ts`, WAL, `busy_timeout`) and registers a **separate** `onPresenceUpdate` callback — not inside `processRawPresence`, whose idle skip would stop recording while nobody is on the site (a local write costs nothing).
- **One recorder per database**: it is not started when `APP_ROLE=admin`. The example compose gives the admin container the Discord keys (for the preview), and two recorders on the same `visitors.db` would insert overlapping rows for the same game (double-counted hours) and close each other's open sessions on startup.
- **Opt-in**: it records only while the *published* `homepage.json` contains a `play-history` section (re-read when the mtime changes); removing the widget closes open sessions. The draft doesn't count.
- `play_sessions(game, started_at, ended_at, open)`: a row per Discord "Playing" activity (type 0) while status ≠ offline. Open rows get `ended_at = now` every 60 s (heartbeat), so after a crash a session ends at its last heartbeat; on startup all rows are closed. A new session is back-dated to Discord's start time (≤ 12 h) but never before the game's last recorded `ended_at`, so restarts don't double-count. Rows older than 400 days are deleted on startup.
- The reader (`summarizePlay`) splits sessions at local midnight in the widget's `timezone` (invalid → UTC), ignores sessions < 2 min (launcher flicker), applies `hideGames` (case-insensitive; still recorded), and reports "playing now" only for open rows with a heartbeat < 3 min old. Levels: ≥1 min, ≥1 h, ≥2 h, ≥4 h.
- `play-history.js` must be listed wherever the other root CommonJS files are: `Dockerfile` (runner `COPY`), `eslint.config.mjs` (CommonJS block) and `tests/integration/server.ts` (`LINKED`).

### Game recommendations (`game-suggest` + `/api/game-suggestions` + `/api/admin/suggestions`)
- Search: `GET /api/game-suggestions/search?id=<section>&q=` → Steam `storesearch` (no key), only for a `game-suggest` section on the site (so it isn't an open search proxy). Terms 2–60 chars, cached 1 h per term — but an **empty** answer only 2 min, because during a Steam search outage `storesearch` answers every term with `{"total":0,"items":[]}` and HTTP 200 (no error to detect; `appdetails` keeps working). `cached()` takes a TTL function for this; soundtracks/artbooks filtered out. Limits: 30 searches/min per visitor hash (a first search sets the `visitor_id` cookie) and 60 *uncached* searches/min overall. The widget debounces 350 ms and aborts stale requests.
- Submit: `POST /api/game-suggestions { id, appid, name?, note?, website? }`. The client sends **only the app id**; the server checks it with `appdetails` (`type === "game"`, cached 24 h) and stores Steam's title — never a title from the request. Honeypot `website` (201, nothing stored), `isBlocked()` (same `blocked_visitors` as comments/messages), 1 per visitor per 20 s + 30 per 10 min overall — counted **before** the Steam lookup, so invalid app ids can't be used to hammer the store (whose `appdetails` the Steam widget's name lookup also uses) — `cleanText()` for name (40) and note (300).
- Tables (`src/lib/game-suggestions.ts`): `game_suggestions` (one row per visitor per game, `UNIQUE(appid, visitor_hash)`; suggesting again replaces the note and marks it unread, answered with `again: true`) and `suggested_games` (title + owner status `open | planned | playing | played | dismissed`).
- `GET /api/game-suggestions?id=` is the public top 10 (only when the section has `showList`); dismissed games never appear, and only `appid/title/status/count` leave the server.
- Admin: the **Suggestions** screen groups by game; status, read/unread and delete act on the game, block/delete on one suggestion. Its nav badge is polled every 30 s with the comments/inbox badges. Deletes and blocks are audited (`suggestion.*`).

### Integrations screen across two containers (`env-report.ts`)
- `src/instrumentation.ts` is compiled for the edge runtime too. The Node-only import must stay inside `if (process.env.NEXT_RUNTIME === "nodejs") { await import(...) }` — written as an early `return` instead, webpack keeps better-sqlite3 in the edge bundle and **every request in `next dev` answers 500** ("Can't resolve 'fs'"); `next build` and the integration tests don't notice.
- Each instance writes `admin_state` key `env.report.<role>` (`public` / `admin` / `all`) at startup from `src/instrumentation.ts` (Next's `register()` hook — it runs under the custom server too, covered by `tests/integration/integrations.test.ts`): a boolean per known env var, `ntfyEnvSummary()`, and `fingerprints` for the shared vars (`sharedEnvNames()` = widget keys + `VISITOR_SALT`): HMAC-SHA256 (16 hex) keyed with a random secret created once in `admin_state` (`env.fingerprintKey`, `INSERT OR IGNORE` so two containers starting together agree). Keyed because plain hashes of short ids (Steam id, battle tag) could be reversed by guessing. **Never values; fingerprints never leave the server** — the route returns only a `mismatch` boolean.
- `/api/admin/integrations` on an `APP_ROLE=admin` instance shows two columns: Public (from that report, so it's as of the public container's last start) and Admin (live). Widget keys (`requiresEnv` + `optionalEnv`) and `VISITOR_SALT` are checked in both, and when set in both their fingerprints are compared ("different in the two containers"); `ADMIN_PASSWORD_HASH` only in Admin; `NTFY_*` once, in whichever instance sends (Public when split). Single container (`all`) = one column from its own env.
- `optionalEnv: [{ name, note }]` on a widget meta lists keys that add something but aren't required (music → `LASTFM_API_KEY`, play-with-me → Discord/Steam); shown neutral, not red, when unset. A new env var a widget reads belongs in `requiresEnv` or `optionalEnv`, or the screen won't list it.

### Admin notifications (ntfy)
- Pure part (`notify.ts`: notice wording, `buildNtfyRequest`, `ntfyEnvSummary`) is separate from `notify-admin.ts` (sending, database) so unit tests can import it — `db.ts` can't load there.
- `notifyAdmin(notice)` posts to ntfy fire-and-forget (5 s timeout, failures logged as `[Notify]`, never affect the response). Called by `/api/contact` (`messageNotice`), `/api/comments` (`commentNotice`, title says "awaits approval" when held) and `/api/game-suggestions` (`suggestionNotice`, Steam's title, "again" for a repeat) — each only **after the row is stored**, never for honeypot, blocked or rate-limited requests.
- JSON publish (POST to the server root, `topic` in the body), not the `Title:` header style — header values must be ASCII and visitor names often aren't. Text is cut to 400 characters.
- A process-wide cap of 30 pushes per 10 min across all kinds, because the guestbook has no global rate limit (a fresh cookie is a fresh visitor). Over the cap, pushes are dropped and logged once.
- Env-only (`NTFY_TOPIC`, `NTFY_URL`, `NTFY_TOKEN`, `NTFY_CLICK`, `NTFY_EVENTS`), not `homepage.json`: the topic is effectively a secret on public ntfy.sh, and `homepage.json` sections are serialized into the page.
- The last send result (`lastSent` / `lastError`) is stored in `admin_state` (`notify.status`), so the Integrations screen shows it whichever container sent.
- **Test button** (Integrations → Notifications): the admin container may lack `NTFY_*` and the public one can't see the admin session, so the panel gets a single-use ticket from `POST /api/admin/notify-test` (random, stored hashed in `admin_state` `notify.testTicket`, 60 s, one at a time) and posts it to the **public** route `POST /api/notify-test`, which the proxy sends to the public container. That route consumes the ticket, sends a fixed `testNotice` (ignores `NTFY_EVENTS`, counts toward the cap) and waits for ntfy's answer (`sendNotice`), so the panel shows a real error. This is the one admin-triggered action outside `/admin`/`/api/admin` — it needs no session, only the ticket, and can only send that fixed text. With the admin container opened on its own port, the request reaches the admin container, which answers 409 if it has no `NTFY_TOPIC`.
- Integration tests blank all `NTFY_*` vars so a developer's `.env` can't push from test runs.

### Stream overlay (`/overlay/<section id>`)
- One widget of the **published** config (`getConfig()` only — never `findSection()`, which falls back to the admin draft and would leak unpublished widgets by id), rendered by `OverlayView` through `TabSections` (same title row, frame and `widgetContextFor(config)` as the site) with `ConfigSync`, so publishing refreshes an open overlay. No `SiteShell`: no page colour, header, counters, effects or theme switch.
- Transparent from the first byte: the page emits `<style>html,body{background:transparent!important}</style>` in its server HTML, and `src/app/overlay/loading.tsx` renders nothing (otherwise the root skeleton would stream into OBS first; the root loading screen still appears in the flight data, for client navigation, not in the markup).
- `?theme=light|dark` (default dark) toggles the `dark` class on `<html>` without touching the visitor's saved theme; `?title=0` removes the section's `text`/`icon` keys (not blanks them: `renderSection` draws a title row for any section with a `text` key, with the brand logo when there is no icon). `robots: noindex`.
- The builder's widget inspector shows the address with a copy button ("Use as a stream overlay"), or "Publish first" for widgets that aren't live yet.

### Social links (`socials`, `profile`)
- `src/widgets/socials/platforms.ts` lists ~60 platforms with Simple Icons path data (`simple-icons` package, CC0; imported by name so only those icons are bundled, about 24 kB gzipped). Brands Simple Icons doesn't ship (LinkedIn, Xbox, Nexus Mods) get a short text `glyph` in their colour.
- A link must be http(s) or an e-mail address (`socialHref`, which turns `me@x.y` into `mailto:`); anything else is dropped. `platform: "auto"` matches the host (and its subdomains) against each platform's `hosts`; an unknown host with a `/@name` path is taken as Mastodon, a `/rss`/`/feed`-style path as RSS, everything else as "website" (globe icon).
- Icon colour on a brand background is white unless the colour is very light (`contrastOn`, luminance > 0.5). Links get `rel="me"` for Mastodon verification.

### Widget brand logos (`src/widgets/brands.ts`)
- `WIDGET_BRANDS` maps a widget type that shows exactly one service to that service's Simple Icons logo (Steam, Discord, Twitch, YouTube, Mastodon, Bluesky, GitHub, Reddit for `meme`, RSS). `<WidgetIcon type fallback>` (`widgets/BrandIcon.tsx`) draws it, or the emoji fallback for anything not in the map.
- Used in the admin palette, outline rows, drag overlay, inspector header and Integrations table, and on the site by `SectionTitle`: a titled widget with **no icon of its own** (unset or `""`) shows its logo; a set icon always wins. `twitch` draws its own title row, so it passes `type` to `SectionTitle` too.
- Logos keep their brand colour; near-black ones (Steam, GitHub, luminance < 0.03) use `currentColor` so they stay visible in dark mode. Don't recolour or alter them otherwise (brand guidelines). Multi-service widgets (chess, music, media, game-server, embed, support) and services with no Simple Icons logo (Overwatch, Speedrun.com, TETR.IO, Minecraft, Open-Meteo, ListenBrainz) keep their emoji on purpose — don't draw look-alike logos.

### Media log (`media` + `src/lib/media-sources.ts`)
- Fixed hosts and no keys, so the request carries a validated username (like chess): AniList GraphQL (`postJson()` in `widget-data.ts`), Letterboxd `/<user>/rss/` (diary only; list entries without `letterboxd:filmTitle` are skipped), Open Library `/people/<user>/books/<shelf>.json` (covers from `covers.openlibrary.org`). Cached 30 min per service/user/list.
- AniList answers "no such user" and "private" with 404 and some unknown names with 500; Open Library answers a private log with 403 — each is turned into a message that says what to fix. Goodreads was dropped: its RSS answers 404 for every account.

### Blog posts (`posts` + `/posts/[...slug]` + `src/lib/posts.ts`)
- A post is any markdown file under `src/content/` (folders included) whose front matter has a `date` (`YYYY-MM-DD`; gray-matter turns an unquoted date into a `Date`, `postDate()` handles both). `title`, `summary` (else an excerpt of the body), `tags`, `author` (else the site's `postAuthor`; the fallback is applied where it is shown — the post page with `getConfig()`, the widget via `ctx.postAuthor` — so the preview follows the draft) and `draft: true` are optional. Files without a date stay plain content for the markdown widget. They are edited in the admin **Content** screen like any other file and are live immediately (not part of the draft).
- The page is `/posts/<path without .md>` (`blog/2026/hello.md` → `/posts/blog/2026/hello`, a catch-all route; top-level posts keep their old URLs), served by the public container; the slug goes through `resolveContentFile()`, which checks every part. It renders inside `SiteShell` (same background, header, effects as the site) at 870px; "Back" links to the first tab that has a `posts` widget.
- Unknown slugs call `notFound()`. Under the root `loading.tsx` that is streamed with status 200 (same reason as the admin 404 in `websocket-server.js`), so a missing post is a soft 404.

### Widget registry (`src/widgets/`)
- Adding a widget = `src/widgets/<type>/meta.ts` + `render.tsx`, then one line each in `widgets/meta.ts` (`SectionSchema` + `widgetMetas`) and `widgets/registry.tsx` (`views`). The `views` map is typed against `SectionType`, so a missing renderer is a compile error.
- **`meta.ts` must stay server-safe and `render.tsx` must only `import type` from it.** `registry.tsx` is pulled into the client bundle through `TabSections.tsx`; a runtime import of a meta file would ship zod to the browser. Conversely the config loader imports `widgets/meta.ts` on the server, so meta files must never import React components.
- `renderSection` owns the shared chrome: the icon + text title row (`view.titled`, uses `titleFields`) and the gradient frame (`view.frame`: `wrap` = shell wraps the body, `self` = widget draws its own frame from `ctx.framed`, `none`). `ctx.framed` is `section.widgetFrame ?? effects.widgetFrame`.
- Site-wide values reach widgets through one `WidgetContext` object built in `SitePage.tsx` — add a field there instead of threading new props through `Tabs` / `OnePage` / `TabSections`.
- The widget components themselves still live in `src/components/`.

### Runtime data lives in `DATA_DIR`
- Everything the app writes goes under `DATA_DIR` (default `<cwd>/data`, `/app/data` in Docker), exported from `src/lib/db.ts`: `visitors.db` (+ `-wal`/`-shm`; visitors, comments, reactions, poll votes, contact messages, game suggestions, play sessions, admin sessions/draft/revisions/audit log) and `uploads/` (background media). New writable state belongs there too, so one read-write volume persists it. `homepage.json` is the exception — it lives in `src/config/`.
- On first `getDb()`, if `DATA_DIR/visitors.db` doesn't exist but the old `<cwd>/visitors.db` file does, it is copied with `VACUUM INTO` (consistent snapshot including un-checkpointed WAL; original left untouched).

### `HOST` vs `HOSTNAME`
- `HOSTNAME` is a standard Unix env var set to the machine's hostname (e.g. `bazzite`). **Do not use it** as a config key.
- The bind address env var is called `HOST`.

### Mobile navigation (Tabs)
- **Breakpoint:** Tailwind `md` (768px). Below `md`, the horizontal tab bar (`hidden md:flex`) is replaced by a compact sticky bar showing the active tab's label + icon (left) and a hamburger toggle (right).
- **HamburgerButton:** a 3-bar button that morphs into an X via CSS transforms (`rotate-45` / `opacity-0` / `-rotate-45` on the three spans) when `menuOpen`. Tapping toggles the slide-in side drawer. Defined as a small component in `Tabs.tsx` and reused in the bar.
- **Drawer slide:** slides in from the **right** (`absolute right-0`, `transition-transform duration-300 ease-out`, `translate-x-full → translate-x-0`). It is always rendered but toggled via `opacity-100` + `pointer-events-auto` vs `opacity-0 pointer-events-none` so the transform transition actually plays (conditional mount would skip the animation).
- **drawer.top / drawer.bar:** top and height of the menu button's row (`barRef`, inside `Banner`), captured when the menu opens; the top is applied as the overlay's `top` (`fixed inset-x-0 bottom-0`, `top: drawerTop`). This makes the menu **start level with the tab bar** — when the page is scrolled to the top (title header visible) the menu drops down below the title instead of covering it; when scrolled (title hidden) the sticky bar is at `0` so the menu starts at the viewport top.
- **Close button stays visible:** the tab bar is `sticky top-0 z-50`, above the `z-40` drawer, so its morphing X (right side, same side as the menu) is always in view. The drawer list is padded by that row's height so the first item clears it (with a logo in one row it is taller than 48px).
- **Closing:** tap the X, tap the backdrop, or press `Escape`. Opening sets `document.body.style.overflow = "hidden"` (restored on close) to lock scroll. The open state is `menuOpen`; `handleTabClick` also closes it.
- **No horizontal scroll:** `<main>` has `overflow-x-clip` (NOT `overflow-x-hidden`, which would break `position: sticky`). This safely clips the `w-screen` full-bleed tab bar that would otherwise overflow by the scrollbar width without breaking the sticky bar or fixed overlays.
- Widgets already avoid horizontal overflow: GitHub cards stack vertically (`space-y-3`), Overwatch grids use `grid-cols-2` → `sm:` scaling, and Discord/Steam rows use `flex-shrink-0` + `min-w-0` + `truncate`.
- The page header is also compact on mobile: `text-3xl md:text-5xl` title, `text-base md:text-xl` tagline, and `px-4 md:px-8` gutters.

### homepage.json is runtime, not bundled
- Read via `fs.readFileSync` in `src/lib/config.ts` (mtime-cached; re-parsed, migrated and validated only when the file's mtime changes).
- `getConfig()` is used by `src/app/page.tsx`, `src/app/layout.tsx` (metadata), `/api/favicon`, `findSection()` and the admin routes; `/admin/preview` renders the draft instead.
- `export const dynamic = "force-dynamic"` prevents static prerendering.
- Allows editing without rebuild; can be volume-mounted in Docker.

### Background (`background.*`)
- **Layer order**, all inside `<main>`'s stacking context: main's own `bg-page` colour (`base.light`/`base.dark`) → `BackgroundLayer` (`-z-20`) → particle canvas (`-z-10`) → content. The page colour is therefore always underneath (and is what shows while an image or video loads).
- **`base` is one flat object for every type** (`solid`, `gradient`, `image`, `video`, `pattern`); fields that don't belong to the chosen `type` are ignored. Flat on purpose: switching type in the admin panel keeps the other types' values, and the form generator needs no union support — each field carries `.meta({ showIf: { type: [...] } })` and `SchemaForm` hides it otherwise.
- `src/lib/background.ts` `backgroundLayer(base)` is pure and returns CSS **variables** (`--bg-image-light` / `--bg-image-dark`, size, repeat, position) consumed by `.bg-layer` in `globals.css`; `html.dark .bg-layer` switches the image, so the theme toggle needs no JS. Gradients can't be transitioned, which is why a tab's own background (`tab.background`, same schema as `base`) is **crossfaded with two layers** in `BackgroundLayer` (old one kept 700ms under the new one's fade-in). The open tab is read from `?tab=`; the one-page layout passes no overrides.
- Only `/api/uploads/...` and plain `http(s)` URLs are ever put inside `url(...)` (`safeUrl`). Don't interpolate a config string into CSS any other way.
- `overlay.dim` is a `bg-page`-coloured sheet over the layer (darkens in dark mode, lightens in light mode); `overlay.blur` is a plain `filter: blur()` on the layer itself (plus a slight scale to hide soft edges) — not a backdrop filter.
- A video is muted/looped/`playsInline`; with `prefers-reduced-motion` it is paused so the poster shows.
- **Effects** (`effect.type`): `stars`/`comet` are `ParticleBackground`; `snow`/`fireflies`/`constellation`/`aurora` are `AmbientEffects`. Both take `density`, `speed` and an optional `color`, keep the canvas transparent (`clearRect`, never a painted backdrop — that would hide the layer beneath), cut the particle count on phones, pause while the tab is hidden and recolour on theme change. Aurora renders at 20% resolution and is stretched (cheap, and soft for free); its colours default to the title gradient. `AmbientEffects` draws one still frame under `prefers-reduced-motion`.
- **Surfaces** (`surface`): `header` (0–100) drives `--surface-header`, read by `.bg-header` (the name/tagline band) and `.bg-tab-bar` (always 90% of it, as before); `blur` is the tab bar's backdrop blur. `main` and the mobile drawer keep the opaque `.bg-page`. `cards` (20–100) sets `data-card-opacity` on `<main>`, and one rule in `globals.css` overrides Tailwind's `--tw-bg-opacity` for the neutral surface classes (grey scale, white, and the Discord-style card colours listed there). Brand colours, fully round elements and hover states stay solid. **A new neutral card colour must be added to that selector list** to follow the setting.

### Background uploads
- `POST /api/admin/upload` (multipart, field `file`). Images are decoded and re-encoded to WebP with sharp (max 2560px, metadata dropped) — never stored as sent, so the stored file is guaranteed to be an image; SVG is refused. Videos (MP4/WebM, checked by signature) are stored as sent. Limits: 20 MB / 60 MB.
- Files go to `DATA_DIR/uploads/<first 20 hex of sha256>.<ext>`; same content → same name. They are served by the **public** route `/api/uploads/[name]` (name must match the hash pattern; `immutable` caching; byte ranges, which Safari needs for video). In the two-container setup the admin container writes them and the public one serves them from the shared data volume.
- The Background screen lists uploads and only lets unused ones be deleted ("in use" = the URL appears in the live config or the draft).
- A reverse proxy in front of the admin container may cap request bodies below these limits; the panel reports a 413 as such.

### Page colour is solid; gradients are a separate layer
- `main` uses the solid `.bg-page` colour; a gradient background is a separate layer above it (see "Background").
- CSS `transition: background-color 500ms ease` animates solid colors smoothly.
- Gradients (`background-image`) cannot be transitioned in CSS — they would pop instantly.
- The animated gradient effect is applied only to text via `background-clip: text`.

### Pulse glow uses CSS variable for color
- `@keyframes pulse-glow` uses `--glow-color` CSS variable (default: Discord green).
- Set `style={{ '--glow-color': 'rgba(...)' } as React.CSSProperties}` to customize per element.
- Steam applies blue glow for Online, green glow for In Game. Discord uses default green.
- Available via `animate-pulse-glow` class.

### Markdown files are runtime, not bundled
- API route `/api/markdown` reads `src/content/` via `fs.readFileSync` at request time. The `file` param goes through `resolveContentFile()` (`src/lib/content.ts`), which accepts only `/`-separated plain names (each part starts with a letter or digit, so no `.`/`..`/hidden parts; no backslashes, empty parts or leading `/`; at most `MAX_FOLDER_DEPTH` = 4 folders; no folder named `*.md`) — never build a content path from user input any other way. `resolveContentFolder()` is the same for folders and never returns the content folder itself (that is what keeps `DELETE ?folder=` from emptying it). `listContent()` lists only names those two accept.
- **Content screen** (`/api/admin/content`): GET = `{ files, folders }`; PUT `{ file, content }` (creates the file's folders) or `{ folder }`; PATCH `{ from, to }` renames/moves a file or a folder, refuses an existing target (409), a folder into itself, or contents that would end up too deep, and answers `moved: [{ from, to }]` for every file. The panel then points the draft's Markdown widgets at the new names (one undo step); the live site keeps the old names until Publish, which the message says. DELETE `?file=` or `?folder=` (recursive). All file changes are live immediately, as before.
- **Editor toolbar** (`MarkdownEditor.tsx`): headings, bold/italic/strike/code, link, image (address or upload; pasting or dropping an image file uploads it), lists, checklist, quote, code block, table, divider, and "Post details" (front matter with today's date). Shortcuts Ctrl/⌘+B, I, K, S. Each action is a pure edit from `markdown-edit.ts`, applied with `document.execCommand("insertText")` so the textarea's own undo keeps working (fallback `setRangeText` + `onChange`); toolbar buttons `preventDefault` on mousedown so the textarea keeps its selection. Content isn't part of the draft, so the panel's Undo/Redo doesn't apply here.
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
- `animate-gradient-bar` class: horizontal gradient shifted via `gradient-shift` 3s animation (stopped under `prefers-reduced-motion`). Omitted when animation is off (the gradient is then drawn at `100%` size, not moving).
- **Resolution** is one pure function, `progressStyle(section, ctx)` in `src/widgets/progress.ts` (client-safe, unit-tested, shared with Steam), called in the widget's `render.tsx`; the components get the result and don't look at the config. Per section: `progressColorMode` `site` (default) follows `effects.progressGradient`, `custom` forces the gradient on with the section's `progressColors` (there is no per-section "off"; a solid bar comes only from `effects.progressGradient: false`). Colors: section's `progressColors` (custom only) → `effects.progressGradientColors` → `titleGradient` → default blue→purple→pink (an empty array counts as unset). `progressAnimation` / `progressSparkles` are tri-state (`ui: "tristate"`, like `widgetFrame`): unset = `effects.progressAnimation` / `effects.progressSparkles`. A solid bar has neither. The shared schema fields are `progressColorsField` / `progressEffectFields` (= `progressAnimationField` + sparkles) in `widgets/fields.ts`.
- Solid bar: `bg-[#5865F2]` (Discord blurple) on Discord, `#66c0f4` (Steam blue) on Steam.
- Bar fills set `backgroundImage` + `backgroundSize`, never the `background` shorthand: React re-sets only changed style keys, and re-setting the shorthand (new colors) resets `background-size`, which froze the animation.
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
- `package.json` overrides pin patched transitive deps: `undici@^6.29.1` (discord.js) and `postcss: "$postcss"` (forces Next's nested `postcss@8.4.31` up to the patched direct dependency `^8.5.32`). The former `glob` / `rimraf` overrides were removed with the move to ESLint 9, which no longer pulls either package in.

### Visitor counters (`counters.*`, `VisitorCounter.tsx`)
- The two counters are fetched independently (`POST /api/visitors`, `GET /api/viewers`); either can be switched off without affecting the other. Never collect them into one array and destructure by position — that was a bug: with visitors off, the viewers response was read as the visitor count.
- The effect re-runs when a counter is switched on or off by a live config refresh. Re-posting `/api/visitors` is harmless (one row per visitor).
- **The live viewer count must be subscribed to from mount**, not after the first fetch. The page shares one WebSocket (`useWebSocket`), and `ConfigSync` opens it immediately; the server sends `{ type: "viewers" }` only when a connection opens, closes or identifies. A subscriber that joins later misses that message and keeps the fetch's value, which was taken before this page's own connection existed (shows "0 people viewing" on a first visit). `gotLiveViewers` stops the initial fetch from overwriting a newer pushed count.
- Viewers are counted per visitor hash (`viewerHashes` in `websocket-server.js`); connections without a `visitor_id` cookie all share one `undefined` key, so several brand-new visitors count as one until they identify.
- **Stream overlays aren't viewers**: `useWebSocket` connects with `/ws?overlay=1` on `/overlay/*` pages; the server keeps those sockets in `overlaySockets` (never in `viewerHashes`, `identify` ignored) and subtracts `overlayCount` in the `/api/viewers` snapshot — both count paths. They stay in `wss.clients`, so an open overlay keeps its data refreshing (it counts for the idle pause). Covered by `tests/integration/overlay.test.ts`.

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

### Idle pause (no viewers → no outbound queries)
- `websocket-server.js` treats "someone is on the site" as `wss.clients.size > 0` (any open WebSocket).
- With no clients, `refreshSteam`, `refreshSteamAchievements`, `refreshOverwatch` and Discord presence enrichment (`processRawPresence`) return early via `skipWhileIdle(tag)`. The first skip sets `idlePaused` and calls `discord-presence.setPaused(true)`, which skips the 30s `fetchUserPresence` poll (the `clientReady`/`shardReady` fetches still run, so a status change missed during a gateway disconnect is caught promptly and `lastSeen` stays accurate). Discord gateway events keep updating `userPresence` in memory (they're pushed, so they cost no requests). Enrichment is deferred with `presencePendingWhileIdle`.
- On the next `connection`, `resumeFromIdle()` runs the `resumeHandlers`: `setPaused(false)` (triggers an immediate member fetch), enriches the latest deferred presence, and refreshes Steam, achievements and Overwatch right away. The intervals themselves are never cleared, so they just start doing work again.
- **Warm-up exception**: each refresh runs once at startup even with no viewers (guarded by `steamData` / `overwatchData` / `enrichedData` being null, and `achievementsWarmed`), so the first visitor gets a snapshot from `/api/*` instead of an empty widget.
- A reload that reconnects before the next interval tick never pauses, so short gaps don't cause churn.

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
- **One builder, `achievementsSnapshot()`** (cache → `{ total, unlocked, recent }` for the games shown), used by the steam broadcast, the on-connect message and the `/api/steam` snapshot (`getSteam` merges it in, so a widget that mounts later still gets achievements). `refreshSteamAchievements()` broadcasts when that snapshot differs from `steamData.achievements` — **not** by comparing fetch results with the cache: `fetchSteamAchievements()` writes the cache itself, so that comparison was always "unchanged", nothing was broadcast and `/api/steam` served no achievements (progress showed only intermittently, e.g. after a new WS connection).
- `steamData.achievements` is a `Record<number, { total, unlocked, recent }>` keyed by appid.
- On new client connection, achievement data is included in the initial steam message.
- `SteamStatus.tsx` displays a thin gradient progress bar + "X/Y unlocked" below each game card.
- Hover popup uses `createPortal` to `document.body` (escapes parent `overflow-hidden` clipping) with `position: fixed`. A `useEffect` listens to `scroll` (capture phase) and `resize` events to recalculate `popupRect` via `getBoundingClientRect`, keeping the popup pinned to the game card during scrolling.
- Popup has `min-w-[220px]` and shows "Playtime" and "Achievements" subsection titles, a larger progress bar with percentage, and up to 3 recent achievements (icon + name).
- Both achievement bars (card + popup) use the same color settings as the Discord music bar (`progressStyle()` in `widgets/progress.ts`, including `effects.progressGradient: false` → solid). The gradient animation applies too (tri-state `progressAnimation` on the steam section, unset = `effects.progressAnimation`; `animate-gradient-bar` + `backgroundSize: 200% 100%`, one `BarLook` shared by card and popup). Sparkles don't: the steam schema has only `progressAnimationField`, not `progressEffectFields`.

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
- `/app/data` (`DATA_DIR`) holds `visitors.db` and `uploads/` — `docker-compose-example.yml` mounts the named volume `homepage_data` there to persist it. (Older setups mounted a volume at `/app/visitors.db`; that data needs to be copied into the new volume by hand.)
- `src/config/` and `src/content/` can be bind-mounted at runtime for live config edits without rebuild.

### Comments guestbook (`comments` section + `/api/comments`)
- Comments are stored in the **same** `data/visitors.db` SQLite file as the visitor counter, in a `comments` table (`id`, `name`, `body`, `created_at`, plus the moderation columns `status`, `visitor_hash`, `edited_at`, `moderated_at` — see "Comment moderation"). The shared connection lives in `src/lib/db.ts` (WAL mode); both `/api/visitors` and `/api/comments` call `getDb()` so there is exactly one connection per process.
- `src/lib/visitor.ts` holds the shared `visitor_id` cookie logic (name, salt, hashing, parsing) used by both routes for identification and rate-limiting.
- **POST `/api/comments`**: body `{ name, body }` (both trimmed, required). Server validates name ≤ 40 chars, body ≤ 500 chars, strips control characters (`\u0000-\u001f`, `\u007f`), and rate-limits per hashed `visitor_id` to one post / 5s. A new `visitor_id` cookie is set if absent. Returns `201` with the created row.
- **GET `/api/comments?limit=N`**: returns the most recent `N` comments newest-first (`ORDER BY id DESC`), `limit` clamped to 1–200 (default 50).
- **XSS safety**: `CommentsWidget` renders `name` and `body` as plain React text (`whitespace-pre-wrap break-words`) — never `dangerouslySetInnerHTML` — so user input cannot inject markup. All length/clamp limits are re-enforced server-side, not just client-side.
- New comments are published immediately unless moderation holds them (pre-moderation mode, held words) and blocked visitors can't post — see "Comment moderation". The per-visitor rate limit applies either way.
- The `comments` view uses `frame: "wrap"`, so `renderSection` (`widgets/registry.tsx`) applies `widgetFrame`/`widgetFrameWidth` like for other widgets. The section title (`icon`/`text`) renders above the frame, consistent with `discord-user`/`steam`/etc.

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
- The `reactions` view uses `frame: "wrap"`, so `widgetFrame`/`widgetFrameWidth` apply like for other widgets.

### Gradient widget frame stacking
- `.gradient-frame::before` needs `z-index: 1` and `.gradient-frame` needs `isolation: isolate` because Next.js `Image fill` uses `position: absolute`, putting it in the same stacking level as the `::before`. Without these, the image renders on top of the gradient border at the left/right edges of full-width content like the Discord banner.
- When `widgetFrame` is enabled on a `discord-user` section, DiscordUser receives a `framed` prop. When `framed`, it removes its own inner `border` (redundant with the gradient frame) and adds `paddingTop: var(--gf-width, 2px)` so the widget's background creates a clean gap between the gradient border and the full-width banner at the top.

### `framed` prop on DiscordUser
- `DiscordUser` accepts a `framed` boolean prop. When `true`: no `border` classes applied, and `paddingTop: var(--gf-width, 2px)` added via inline style. The CSS variable cascades from the `.gradient-frame` wrapper which sets `--gf-width`.
- Passed from `widgets/discord-user/render.tsx` as `framed={ctx.framed}` (`ctx.framed` = `section.widgetFrame ?? effects.widgetFrame`).
- The loading skeleton, error fallback, and main render all handle `framed` identically.

### Meme widget frame wraps only the image, not the whole widget
- The `meme` view uses `frame: "self"`: `renderSection` does not wrap it; `widgets/meme/render.tsx` passes `widgetFrameEnabled={ctx.framed}`, `widgetFrameWidth`, `widgetFrameGradient` to `MemeWidget`.
- When enabled, the `gradient-frame` class and CSS variables are applied only to the image container `<div>`, leaving the title, metadata, and "New Meme" button outside the framed area.

### Meme API always filters NSFW, and de-duplicates via client history
- `/api/meme` fetches a batch of 50 from `meme-api.com`, then **always** filters out `nsfw` and `spoiler` memes before returning anything — this runs in both default and `popular` modes, so NSFW can never be served.
- **Default mode** (`popular` not set): the safe batch is shuffled and returned as a `memes` array; the client picks a random entry that is not in the 30-entry `historyRef` (falling back to a full reset when the pool is exhausted). The `meme` section's `popular` flag (default `false`) controls this.
- **Popular mode** (`popular: true`): the safe batch is sorted by `ups` descending and the top 30 returned as `memes`; the client walks the list, showing the highest-`ups` entry not already in `historyRef`, so rerolling advances to the next most-popular unseen meme instead of looping the same few.
- `MemeWidget` keeps the loading placeholder (`imgLoaded` state) until the `<img>` `onLoad` fires, so the new meme is only revealed once the browser has actually downloaded it.
- The title is rendered as a link to the meme's Reddit `postLink` (new tab).

### ParticleBackground must only render once
- `ParticleBackground` is rendered conditionally by `EffectsController` (when `background.effect.type` in `homepage.json` is not `"none"`).
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

### Particle system modes (`background.effect.type`)
- `"stars"` — Original 2D mode: circles with velocity drift that wrap at screen edges, opacity-based twinkle (`0.8 + 0.2 * sin(t)`).
- `"comet"` — 3D starfield mode: particles have (x, y, z) coordinates projected to 2D via `FOCAL / z`. Moving toward viewer (z decreases), they grow and move outward from center. Semi-transparent overlay (`TRAIL_ALPHA = 0.3`) replaces `clearRect` for motion blur trails. Each comet is drawn as a 4-pointed asymmetrical star stretched along a `dirAngle` (radial from screen center), with elongation controlled by `stretch = min(1, radialDist / 0.4)` — particles near the viewing axis stay symmetrical, off-axis ones elongate to a comet. Each particle has a fixed `brightness` (no flicker) for natural variation. `baseSize` scales with `FOCAL / z` so close particles appear larger.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev with WebSocket server (presence bot in-process if env set) |
| `npm run build` | Next.js production build (also lints `src/` and type-checks everything, tests included) |
| `npm run start` | Production start (websocket-server.js) |
| `npm run admin:hash` | Ask for a password and print the `ADMIN_PASSWORD_HASH=...` line for `.env` |
| `npm run lint` | ESLint over the whole repo (`eslint.config.mjs`) |
| `npm test` | Unit tests (`tests/unit`, ~1s, no network, no database) |
| `npm run test:integration` | Production build, then HTTP tests against the built server (`tests/integration`, ~20s). Rebuilds `.next`, so don't run it while `npm run dev` is up. |

## Linting
- ESLint 9 flat config in `eslint.config.mjs`: `next/core-web-vitals` + `next/typescript` through `FlatCompat`, plus a CommonJS block for the plain Node files (`websocket-server.js`, `discord-presence.js`, `scripts/**`, `src/lib/admin/password.js`) where `require` is allowed. `next lint` is not used (deprecated, removed in Next 16).
- `eslint-config-next` is pinned to the same version as `next`. Don't move it to 16 without moving Next.
- Unused names: a leading `_` marks a deliberately unused argument or variable, and `const { a, ...rest }` may drop `a`.
- **`next build` runs ESLint over `src/` only and fails on errors there** (warnings only print); the Docker image build runs `next build`, so such an error breaks the image. Lint errors in `websocket-server.js`, `discord-presence.js`, `scripts/` or `tests/` do **not** fail the build (checked) — only `npm run lint` reports them, so run it before committing.
- Lint is clean (0 warnings). An effect that must run on mount (or on one prop) but call a render-scope function reads that function through a "latest ref" (`fooRef.current = foo` in an effect without deps, then `fooRef.current()`): MemeWidget (loads on mount and again when `popular` changes) and ReactionsWidget. Adding the function as a dependency instead would re-run the effect on every state change (MemeWidget would load meme after meme). React 19.2's `useEffectEvent` is the proper tool, but the `eslint-plugin-react-hooks` 5.2 that `eslint-config-next` 15 ships has it switched off, and overriding the plugin to 6.x breaks ESLint (`eslint-config-next` extends `plugin:react-hooks/recommended` in the old config format, which 6.x serves as flat config). Switch to `useEffectEvent` together with Next 16.
- An `<img>` instead of `next/image` needs a disable comment with the reason (external hosts that aren't in `next.config.ts`, tiny icons).

## Testing
- Needs the same Node major as the Dockerfile (26): the setup relies on Node stripping TypeScript types by default and on `module.registerHooks`, and older versions fail with unhelpful errors.
- Node's built-in runner (`node --test`), no test framework. Node 26 strips TypeScript types itself; `tests/register.mjs` adds what Next.js normally provides: the `@/` alias and extensionless imports (`./meta` → `./meta.ts`), inside `src/` and `tests/`.
- **What tests can import:** `.ts` and `.js` only — Node can't run JSX, so nothing reachable from a test may import a `.tsx` file. Logic worth testing that lives in a component goes into a `.ts` file next to it (e.g. `widgets/embed/player.ts`, `parseFeed` / `parseContributions` in `lib/widget-sources.ts`). No TypeScript-only runtime syntax either (enums, parameter properties, namespaces).
- **No SQLite in unit tests:** `db.ts` loads better-sqlite3 with `require()`, which doesn't exist in the ES-module scope Node uses for `.ts` files. Code that touches the database is covered by the integration tests instead (or takes its inputs as parameters, like `initialStatus(name, body, settings)`).
- The `MODULE_TYPELESS_PACKAGE_JSON` warning is silenced in the scripts. Don't add `"type": "module"` to `package.json` to get rid of it — that would turn `websocket-server.js` and the other CommonJS files into ES modules and break them.
- `src/config/homepage.showcase.json` must contain **every widget type** (on any of its pages) and pass `strictParseConfig` (`tests/unit/config.test.ts`): a new widget fails the tests until a section of it is added there. Its example pages must all be reachable from its homepage with no links to missing pages (the same `siteMap()` the editor uses, markdown files read from disk); `/colophon` is linked only from `showcase-pages.md` on `/about`, on purpose. The homepage and `/about` have no own settings (they show the site-wide ones); `/projects` (own name, title colors, one-row banner, Bento, effects, counters) and `/colophon` (own background, Link in bio, title colors, counters) together use every `PAGE_SETTING_GROUPS` entry, which a test enforces. Another test walks the raw file and fails on any key strict parsing drops: zod strips unknown keys silently (that is how `text`/`icon` on untitled Markdown and Quote widgets, and a misspelled gradient key, went unnoticed). There is no other example config: the README tells people to copy the showcase. Its markdown files are `src/content/en/showcase-*.md` (one also in `it/` and `pl/`), committed through a `.gitignore` exception (exceptions must come *after* `/src/content/*`, and a file in an ignored folder needs the folder un-ignored first). Live widgets use well-known public accounts (torvalds, @NASA, bsky.app, Niftski…); anything needing keys shows its "not set up" state.
- `tests/fixtures/homepage.v1.json` is the original v1 example (from before config v2). Keep it as is: it is what proves old configs still load.
- **Integration tests** (`tests/integration/server.ts`; `admin.test.ts`, `widgets.test.ts`, `languages.test.ts`) start the built `websocket-server.js` in production mode in a temp folder with symlinks to `.next`, `node_modules` etc., their own `homepage.json`, content and `DATA_DIR`, on a free port. Every integration env var is set to an empty string so the real `.env` (dotenv never overrides a set variable) can't log the Discord bot in. Node's `fetch` keeps no cookies and sends no `Origin`; the `Client` helper does both. Limits to keep in mind when adding tests: 8 failed sign-ins per server start, one comment per visitor per 5s, one poll vote per visitor per second, one contact message per visitor per 30s (30 per 10 min in total), one game suggestion per visitor per 20s (30 per 10 min). Valid suggestions and searches need Steam, so the tests only cover the paths that don't reach it.
- Tests are type-checked by `tsc` and by `next build` (tsconfig includes `**/*.ts`), so **a type error in a test fails the production and Docker build**. Use `@/` imports, not `.ts` extensions.
- `tests/unit/tailwind.test.ts` fails when a folder with `.tsx` files is missing from Tailwind's `content` list (the Phase 0 regression where widget styles were silently dropped).

## Docker

- One image, multi-stage build; started once or twice (public + admin).
- `docker-entrypoint.sh` execs `websocket-server.js` in the foreground; `discord-presence.js` runs in-process.
- `docker-compose-example.yml` runs two containers from the image for one hostname: `homepage` (public, `APP_ROLE=public`, config/content mounted `:ro`, `NTFY_*`) and `homepage-admin` (`APP_ROLE=admin`, config/content writable, `ADMIN_PASSWORD_HASH`), sharing the `homepage_data` volume. Both merge the `x-preview-env` anchor (Discord, Steam, Overwatch, Twitch, Last.fm keys) so the admin preview has live data even when the admin container is opened on its own port; `HOST`/`VISITOR_SALT` are set per service. `NTFY_*` stays public-only (visitor posts go there). Compose can only `<<:`-merge into map-style `environment:`, so both services use `KEY: value`, not `- KEY=value`. The proxy routes `/admin` and `/api/admin` to `homepage-admin`. Publishing needs `src/config` writable in the admin container.
- Traefik recommended as reverse proxy.
- `.dockerignore` includes node_modules, .next, .env, visitors.db.
