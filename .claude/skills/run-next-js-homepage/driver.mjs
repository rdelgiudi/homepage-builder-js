// Drives the running site and admin panel in headless Chromium (playwright-core).
// Usage: see SKILL.md next to this file. Run with `node .claude/skills/run-next-js-homepage/driver.mjs <command>`.
//
// Env:
//   BASE_URL        default http://127.0.0.1:3123
//   ADMIN_PASSWORD  default testpass (must match the dev server's ADMIN_PASSWORD)
//   RUN_DIR         default $TMPDIR/homepage-run (or /tmp/homepage-run): playwright-core install + screenshots
//   CHROME          path to a Chromium binary; default = newest ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RUN_DIR = process.env.RUN_DIR || join(process.env.TMPDIR || "/tmp", "homepage-run");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3123";
const PASSWORD = process.env.ADMIN_PASSWORD || "testpass";
const SHOTS = join(RUN_DIR, "shots");

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), ".cache", "ms-playwright");
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1])) : [];
  for (const d of dirs) {
    const p = join(cache, d, "chrome-linux64", "chrome");
    if (existsSync(p)) return p;
  }
  throw new Error(`No Chromium in ${cache}. Set CHROME=/path/to/chrome, or run: node ${RUN_DIR}/node_modules/playwright-core/cli.js install chromium`);
}

function playwright() {
  const req = createRequire(join(RUN_DIR, "noop.js"));
  try {
    return req("playwright-core");
  } catch {
    throw new Error(`playwright-core not found in ${RUN_DIR}. Run: npm i --prefix "${RUN_DIR}" playwright-core`);
  }
}

/**
 * A signed-in browser session. Everything a custom script needs:
 *   const s = await session(); const frame = await s.openBuilder(); ...; await s.close();
 */
export async function session({ width = 1600, height = 1000 } = {}) {
  mkdirSync(SHOTS, { recursive: true });
  // Chromium puts a unix socket under TMPDIR and aborts ("Socket path too long") when that path
  // passes ~108 characters, which a long session TMPDIR does: give the browser a short one.
  const env = (process.env.TMPDIR || "").length > 40 ? { ...process.env, TMPDIR: "/tmp" } : process.env;
  const browser = await playwright().chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"], env });
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // A freshly started `next dev` can answer one 404 while it recompiles after the first page: retry.
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${BASE_URL}/admin/login`);
    if (await page.waitForSelector("input[type=password]", { timeout: 15000 }).catch(() => null)) break;
    if (attempt === 4) throw new Error(`No sign-in form at ${BASE_URL}/admin/login. Is the server up with ADMIN_PASSWORD set (and APP_ROLE not "public")?`);
  }
  await page.fill("input[type=password]", PASSWORD);
  await page.press("input[type=password]", "Enter");
  await page.waitForURL(/\/admin(#.*)?$/, { timeout: 30000 });

  const s = {
    page,
    errors,
    /** Same-origin fetch from the signed-in page (admin API calls need the session cookie + Origin). */
    api: (path, init) =>
      page.evaluate(
        async ([p, i]) => {
          const r = await fetch(p, i ? { ...i, headers: { "content-type": "application/json", ...(i.headers || {}) } } : undefined);
          return { status: r.status, body: await r.json().catch(() => null) };
        },
        [path, init]
      ),
    /** Throw the draft away (back to the published homepage.json). */
    discardDraft: () => s.api("/api/admin/config", { method: "DELETE" }),
    /** Opens the builder (a real reload) and waits for the preview iframe's widgets. Returns the iframe's Frame. */
    async openBuilder() {
      await page.goto(`${BASE_URL}/admin#builder`);
      await page.reload(); // goto that only changes the hash keeps the old panel state
      const frameEl = await page.waitForSelector("iframe[title='Site preview']");
      const frame = await frameEl.contentFrame();
      await frame.waitForSelector("[data-section-id]", { state: "attached", timeout: 60000 });
      await page.waitForTimeout(1500); // widgets load data and change height
      return frame;
    },
    /** Section ids as the preview shows them, per tab (`data-tab-id` / `data-section-id`, preview only). */
    previewIds: (frame, tabId) => frame.$$eval(`[data-tab-id='${tabId}'] > [data-section-id]`, (els) => els.map((e) => e.dataset.sectionId)),
    /**
     * Press on `from` (page coords), drag via a short move (dnd-kit needs > 6px) to `to`, optionally
     * release. `to` may be an async function: it is measured after the drag started, which matters
     * when measuring scrolls the preview (the start point would have moved).
     */
    async drag(from, to, { release = true } = {}) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 30, from.y + 15, { steps: 5 });
      if (typeof to === "function") to = await to();
      await page.mouse.move(to.x, to.y, { steps: 25 });
      await page.mouse.move(to.x + 1, to.y + 1, { steps: 2 });
      const hint = await page.locator(".adm-overlay-hint").textContent().catch(() => null);
      if (release) {
        await page.mouse.up();
        await page.waitForTimeout(2500); // 500ms autosave + preview refresh
      }
      return hint;
    },
    /** Centre of a palette button ("Add a widget"), scrolled into view first. */
    async paletteItem(label) {
      const item = page.locator(".adm-palette-item", { hasText: label }).first();
      await item.scrollIntoViewIfNeeded();
      const b = await item.boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    /** Page coordinates of a point in a preview widget (fx/fy = fraction of its box), clamped into the visible iframe. */
    async inPreview(frame, sectionId, fx = 0.5, fy = 0.5) {
      const el = await frame.$(`[data-section-id='${sectionId}']`);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(300);
      const b = await el.boundingBox(); // already in page coordinates
      const f = await (await page.$("iframe[title='Site preview']")).boundingBox();
      return { x: b.x + b.width * fx, y: Math.min(Math.max(b.y + b.height * fy, f.y + 20), f.y + f.height - 60) };
    },
    /** Hovers a preview widget and returns the centre of its "⠿ <name>" move handle. */
    async moveHandle(frame, sectionId) {
      const p = await s.inPreview(frame, sectionId);
      await page.mouse.move(p.x, p.y, { steps: 5 });
      const h = await page.locator(".adm-move-handle").boundingBox();
      return { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    },
    shot: async (name) => {
      const path = join(SHOTS, `${name}.png`);
      await page.screenshot({ path });
      return path;
    },
    close: () => browser.close(),
  };
  return s;
}

// --- CLI ---

const commands = {
  /** shot [path] [name]: screenshot any page as the signed-in admin (default /admin#builder). */
  async shot(path = "/admin#builder", name = "shot") {
    const s = await session();
    await s.page.goto(BASE_URL + path);
    if (path.includes("#")) await s.page.reload();
    await s.page.waitForTimeout(3000);
    console.log("screenshot:", await s.shot(name));
    console.log("page errors:", s.errors);
    await s.close();
  },
  /** smoke: palette drop onto the preview, then a move with the preview's handle; discards the draft before and after. */
  async smoke() {
    const s = await session();
    await s.discardDraft();
    const frame = await s.openBuilder();
    const tab = await frame.$eval("[data-tab-id]", (e) => e.dataset.tabId);
    const before = await s.previewIds(frame, tab);
    console.log(`tab ${tab}:`, before.join(", "));
    console.log("screenshot:", await s.shot("smoke-1-builder"));

    const hint = await s.drag(await s.paletteItem("Divider"), () => s.inPreview(frame, before[0], 0.5, 0.15));
    const afterAdd = await s.previewIds(frame, tab);
    console.log("drop hint:", hint);
    console.log("after palette drop:", afterAdd.join(", "));
    console.log("screenshot:", await s.shot("smoke-2-added"));

    const last = afterAdd[afterAdd.length - 1];
    const moveHint = await s.drag(await s.moveHandle(frame, last), () => s.inPreview(frame, afterAdd[0], 0.5, 0.15));
    const afterMove = await s.previewIds(frame, tab);
    console.log("move hint:", moveHint);
    console.log("after moving", last + ":", afterMove.join(", "));
    console.log("screenshot:", await s.shot("smoke-3-moved"));

    const ok = afterAdd.length === before.length + 1 && afterMove.indexOf(last) < afterAdd.indexOf(last);
    await s.discardDraft();
    console.log(ok ? "SMOKE OK" : "SMOKE FAILED", "| page errors:", s.errors);
    await s.close();
    if (!ok) process.exitCode = 1;
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd = "smoke", ...args] = process.argv.slice(2);
  if (!commands[cmd]) {
    console.error(`Unknown command "${cmd}". Commands: ${Object.keys(commands).join(", ")}`);
    process.exit(2);
  }
  await commands[cmd](...args);
}
