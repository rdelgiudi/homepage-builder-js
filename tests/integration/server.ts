/**
 * Starts the built app (websocket-server.js in production mode) in a throwaway folder, so a
 * test never reads the real .env, config, content or database. Run `next build` first —
 * `npm run test:integration` does.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "../..");
/** Linked into the throwaway folder; everything else there is the test's own. */
const LINKED = [".next", "node_modules", "package.json", "next.config.ts", "websocket-server.js", "discord-presence.js"];

export interface TestServer {
  url: string;
  dir: string;
  configPath: string;
  stop: () => Promise<void>;
  log: () => string;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer(options: { env: Record<string, string>; config: unknown; content?: Record<string, string> }): Promise<TestServer> {
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) throw new Error("No production build. Run `npm run build` (or `npm run test:integration`).");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-test-"));
  for (const name of LINKED) fs.symlinkSync(path.join(ROOT, name), path.join(dir, name));
  fs.mkdirSync(path.join(dir, "src/config"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/content"), { recursive: true });
  const configPath = path.join(dir, "src/config/homepage.json");
  fs.writeFileSync(configPath, JSON.stringify(options.config, null, 2));
  for (const [name, text] of Object.entries(options.content ?? {})) fs.writeFileSync(path.join(dir, "src/content", name), text);

  const port = await freePort();
  // Every integration is switched off explicitly: dotenv never overrides a variable that
  // is already set, even to "", so nothing from a .env file can reach the test server.
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: path.join(dir, "data"),
    DISCORD_SERVER_ID: "",
    DISCORD_USER_ID: "",
    DISCORD_BOT_TOKEN: "",
    STEAM_API_KEY: "",
    STEAM_ID: "",
    OVERWATCH_BATTLE_TAG: "",
    TWITCH_CLIENT_ID: "",
    TWITCH_CLIENT_SECRET: "",
    LASTFM_API_KEY: "",
    VISITOR_SALT: "test-salt",
    ADMIN_PASSWORD: "",
    ADMIN_PASSWORD_HASH: "",
    APP_ROLE: "",
    ...options.env,
  };

  let output = "";
  const child: ChildProcess = spawn(process.execPath, ["websocket-server.js"], { cwd: dir, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", (d) => (output += d));
  child.stderr!.on("data", (d) => (output += d));

  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((r) => child.once("exit", r));
      child.kill("SIGKILL");
      await exited;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  };

  const deadline = Date.now() + 60000;
  for (;;) {
    if (child.exitCode !== null) {
      await stop();
      throw new Error(`Server exited during startup:\n${output}`);
    }
    try {
      if ((await fetch(url + "/api/viewers")).ok) break;
    } catch {}
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`Server did not start within 60s:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { url, dir, configPath, stop, log: () => output };
}

/** A tiny cookie jar, since Node's fetch keeps none (and sends no Origin header). */
export class Client {
  private cookies = new Map<string, string>();
  private base: string;
  private origin: string | null;
  // No parameter properties: Node's type stripping can't run them.
  constructor(base: string, origin: string | null = base) {
    this.base = base;
    this.origin = origin;
  }

  async request(pathname: string, init: { method?: string; json?: unknown; headers?: Record<string, string>; body?: BodyInit } = {}) {
    // Headers passed in win, so a test can send a foreign Origin on purpose.
    const headers: Record<string, string> = { ...(this.origin ? { Origin: this.origin } : null), ...init.headers };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    let body = init.body;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const res = await fetch(this.base + pathname, { method: init.method ?? (body === undefined ? "GET" : "POST"), headers, body, redirect: "manual" });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (/max-age=0/i.test(cookie) || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async json(pathname: string, init: Parameters<Client["request"]>[1] = {}) {
    const res = await this.request(pathname, init);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data, text };
  }
}
