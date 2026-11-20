---
name: run-next-js-homepage
description: Run, start, launch, screenshot and drive the Next.js homepage and its admin panel (/admin builder, live preview, drag and drop). Use when asked to run the site or dev server, sign in to the admin panel, take a screenshot, test a UI change in a real browser, or drag widgets in the builder or preview.
---

Start the dev server (`websocket-server.js`) with a throwaway admin password and data folder, then drive it in headless Chromium with `.claude/skills/run-next-js-homepage/driver.mjs` (playwright-core: signs in, opens the builder, drags, screenshots).

All paths are relative to the repo root. Commands use bash.

## Prerequisites

- Node 26 (same major as the Dockerfile; tests need it too). `npm ci` done.
- A Chromium build in `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`. The driver uses the newest one there, or `CHROME=/path/to/chrome`.
- `playwright-core` is **not** a project dependency. Install it into the run folder, outside the repo:

```bash
RUN="${TMPDIR:-/tmp}/homepage-run"
mkdir -p "$RUN" && npm i --prefix "$RUN" playwright-core
```

## Run (agent path)

1. Start the server on port 3123. Use a throwaway `DATA_DIR` so the owner's draft, sessions and database are never touched. `.env` is still loaded (dotenv doesn't override variables that are set), so blank anything that logs in somewhere or sends pushes:

```bash
RUN="${TMPDIR:-/tmp}/homepage-run"
PORT=3123 HOST=127.0.0.1 DATA_DIR="$RUN/data" ADMIN_PASSWORD=testpass ADMIN_PASSWORD_HASH= APP_ROLE= \
  DISCORD_BOT_TOKEN= STEAM_API_KEY= NTFY_TOPIC= \
  nohup node websocket-server.js > "$RUN/server.log" 2>&1 &
timeout 120 bash -c 'until curl -s -o /dev/null http://127.0.0.1:3123/admin/login; do sleep 2; done' && echo up
```

2. Drive it:

```bash
# Palette widget dropped onto the preview, then moved with the preview's "⠿" handle.
# Discards the draft before and after. Prints "SMOKE OK" or exits 1.
node .claude/skills/run-next-js-homepage/driver.mjs smoke

# Screenshot any page as the signed-in admin: shot <path> <name>
node .claude/skills/run-next-js-homepage/driver.mjs shot "/?tab=gaming" site-gaming
```

Screenshots go to `$RUN/shots/<name>.png`. **Look at them.**

3. Stop it:

```bash
lsof -ti:3123 -sTCP:LISTEN | xargs -r kill
```

### Custom flows

`driver.mjs` exports `session()`. Write the script to a file (see Gotchas) and import it:

```js
import { session } from "/abs/path/to/repo/.claude/skills/run-next-js-homepage/driver.mjs";
const s = await session();                     // signed in
const frame = await s.openBuilder();           // the preview iframe's Frame
await s.drag(await s.paletteItem("Clock"), () => s.inPreview(frame, "start-notice", 0.95, 0.5)); // beside, right
console.log(await s.previewIds(frame, "start"), await s.shot("after"));
await s.discardDraft(); await s.close();
```

Helpers:
- `api(path, init)`: same-origin fetch with the session cookie. Draft save is `PUT /api/admin/config` with `{ config }`.
- `moveHandle(frame, id)`: hovers a preview widget and returns its handle's centre.
- `inPreview(frame, id, fx, fy)`: a point inside a preview widget, as fractions of its box.
- `errors`: page errors collected so far.

Env vars: `BASE_URL` (default `http://127.0.0.1:3123`), `ADMIN_PASSWORD` (default `testpass`), `RUN_DIR`, `CHROME`.

## Run (human path)

`npm run dev`, then open http://localhost:3000 and `/admin`. It uses the real `.env` and `data/`, so your edits land in the owner's draft.

## Test

```bash
npm test                  # unit, ~1s
npm run lint              # 3 known react-hooks warnings, 0 errors
npm run test:integration  # rebuilds .next: stop the dev server first
```

## Gotchas

- **Chromium aborts with `Socket path too long`** when `TMPDIR` is long (a session scratch dir): its singleton socket lives under `TMPDIR` and Unix socket paths max out at ~108 characters. The driver gives the browser `TMPDIR=/tmp` when yours is longer than 40 characters.
- **playwright-core version vs cached Chromium:** 1.65.1 expects build 1255. This machine had 1243, which works through `executablePath`, so the driver never relies on Playwright's own lookup.
- **First request after start can 404.** `next dev` recompiles right after the first page and answers one `/admin/login` with 404. The driver retries the sign-in page.
- **`goto('/admin#builder')` from `/admin` only changes the hash.** The panel keeps its old state, including a stale draft. `openBuilder()` reloads.
- **dnd-kit drags need real mouse steps:** press, a > 6px move, then the target. Palette buttons below the fold must be scrolled into view first. Otherwise the mouse just selects text (the whole page turns blue in the screenshot).
- **Measure drop targets after the drag starts** (pass `to` as a function). `inPreview` scrolls the preview, which moves the handle you were about to press.
- **Widgets change height as their data loads.** Coordinates taken early go stale. `inPreview` scrolls the widget to the centre and clamps the point inside the iframe.
- Element boxes inside the iframe (`frame.$(…).boundingBox()`) are already in page coordinates.
- The preview shows changes ~1 s after a drop (500 ms autosave + refresh). The driver waits 2.5 s.
- **A `bash` heredoc containing `$$` (Playwright's `frame.$$eval`) got blocked** by the agent's shell safety check. Write driver scripts with the file-writing tool, not heredocs.
- `homepage.json` in this repo is the widget showcase ("Lorem Ipsum"). Tab ids are `start`, `content`, `live`, `gaming`, `community`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `playwright-core not found in …` | `npm i --prefix "$RUN" playwright-core` with the same `RUN` (or set `RUN_DIR`). |
| `browserType.launch: Target page, context or browser has been closed` + `Socket path too long` | Long `TMPDIR`; fixed in the driver. If you launch Chromium yourself, pass `env: { ...process.env, TMPDIR: "/tmp" }`. |
| `page.fill: Timeout … input[type=password]` | Server not up, `ADMIN_PASSWORD` not set, or the cold-start 404. Check `$RUN/server.log`. |
| Draft turned into an empty "Homepage / Welcome" site | Fixed now: `PUT /api/admin/config` without `{ config }` answers 400. Discard with `s.discardDraft()`. |
| A drag does nothing, and the hint is `null` | The press missed the element (scrolled away). Re-measure it right before `drag()`. |
