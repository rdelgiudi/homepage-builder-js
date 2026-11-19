import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Client, startServer, type TestServer } from "./server";

const config = { version: 2, name: "Test", tabs: [{ id: "home", label: "Home", sections: [] }] };

type Cell = boolean | null | "na";
interface Row {
  name: string;
  cells: Cell[];
  mismatch?: boolean;
}

/** The two-container setup: both instances share one DATA_DIR, only the public one has the NTFY_* keys. */
describe("integrations check across two containers", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-shared-data-"));
  let pub: TestServer;
  let adm: TestServer;
  let admin: Client;
  /** A stand-in ntfy server that records what it receives. */
  const pushes: { auth?: string; body: Record<string, unknown> }[] = [];
  let ntfy: http.Server;

  before(async () => {
    ntfy = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        pushes.push({ auth: req.headers.authorization, body: JSON.parse(body) });
        res.end("{}");
      });
    });
    await new Promise<void>((r) => ntfy.listen(0, "127.0.0.1", r));
    const ntfyUrl = `http://127.0.0.1:${(ntfy.address() as { port: number }).port}`;
    pub = await startServer({
      env: { DATA_DIR: dataDir, APP_ROLE: "public", NTFY_TOPIC: "test-topic", NTFY_URL: ntfyUrl, NTFY_TOKEN: "tk", STEAM_API_KEY: "steamkey-x", STEAM_ID: "steamid-x", TWITCH_CLIENT_ID: "tw-1", VISITOR_SALT: "salt-a" },
      config,
    });
    adm = await startServer({ env: { DATA_DIR: dataDir, APP_ROLE: "admin", ADMIN_PASSWORD: "pw", STEAM_ID: "steamid-x", TWITCH_CLIENT_ID: "tw-2", VISITOR_SALT: "salt-b" }, config });
    admin = new Client(adm.url);
    assert.equal((await admin.request("/api/admin/login", { json: { password: "pw" } })).status, 200);
  });
  after(async () => {
    await pub?.stop();
    await adm?.stop();
    ntfy?.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("checks preview keys in both containers, ntfy only in the public one", async () => {
    const res = await admin.json("/api/admin/integrations");
    const status = res.status;
    const data = res.data as unknown as {
      columns: string[];
      publicReportedAt: number;
      widgets: { type: string; env: Row[] }[];
      general: Row[];
      notifications: { reported: boolean; valid: boolean; vars: Row[] };
    };
    assert.equal(status, 200);
    assert.deepEqual(data.columns, ["Public", "Admin"]);
    assert.ok(data.publicReportedAt > 0, "the public container reported at startup");

    const steam = data.widgets.find((w) => w.type === "steam")!;
    assert.deepEqual(steam.env.find((e) => e.name === "STEAM_API_KEY")!.cells, [true, false]);
    assert.equal(steam.env.find((e) => e.name === "STEAM_API_KEY")!.mismatch, false, "set in one only is not a mismatch");
    assert.equal(steam.env.find((e) => e.name === "STEAM_ID")!.mismatch, false, "same value in both");
    const twitch = data.widgets.find((w) => w.type === "twitch")!;
    assert.equal(twitch.env.find((e) => e.name === "TWITCH_CLIENT_ID")!.mismatch, true, "different values");

    const general = data.general;
    const salt = general.find((g) => g.name === "VISITOR_SALT")!;
    assert.deepEqual(salt.cells, [true, true]);
    assert.equal(salt.mismatch, true);
    assert.deepEqual(general.find((g) => g.name === "ADMIN_PASSWORD_HASH")!.cells, ["na", false]);

    assert.equal(data.notifications.reported, true);
    assert.equal(data.notifications.valid, true);
    assert.deepEqual(data.notifications.vars.find((v) => v.name === "NTFY_TOPIC")!.cells, [true]);

    // Nothing that looks like a value leaves the server.
    const text = JSON.stringify(data);
    for (const secret of ["test-topic", "salt-a", "salt-b", "steamkey-x", "steamid-x", "tw-1", "tw-2", "fingerprint"]) assert.ok(!text.includes(secret), secret);
  });

  it("sends a test notification from the public container with a single-use ticket", async () => {
    const ticket = async () => {
      const res = await admin.json("/api/admin/notify-test", { method: "POST" });
      assert.equal(res.status, 200);
      return res.data.ticket as string;
    };
    const send = (base: string, t: unknown) =>
      fetch(base + "/api/notify-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: t }) });

    assert.equal((await send(pub.url, "made-up")).status, 403);
    assert.equal(pushes.length, 0);

    const t = await ticket();
    const res = await send(pub.url, t);
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].auth, "Bearer tk");
    assert.equal(pushes[0].body.title, "Test notification");
    assert.equal(pushes[0].body.topic, "test-topic");

    assert.equal((await send(pub.url, t)).status, 403, "a ticket works once");

    // The admin container has no NTFY_* settings: it says so instead of pretending.
    const own = await send(adm.url, await ticket());
    assert.equal(own.status, 409);

    const after = await admin.json("/api/admin/integrations");
    assert.ok((after.data.notifications as { lastSent: number | null }).lastSent, "the send is visible to the panel");
  });

  it("needs an admin session for a ticket", async () => {
    assert.equal((await new Client(adm.url).json("/api/admin/notify-test", { method: "POST" })).status, 401);
  });
});
