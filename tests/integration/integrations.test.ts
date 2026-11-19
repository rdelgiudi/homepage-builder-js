import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

  before(async () => {
    pub = await startServer({
      env: { DATA_DIR: dataDir, APP_ROLE: "public", NTFY_TOPIC: "test-topic", STEAM_API_KEY: "k", VISITOR_SALT: "salt-a" },
      config,
    });
    adm = await startServer({ env: { DATA_DIR: dataDir, APP_ROLE: "admin", ADMIN_PASSWORD: "pw", VISITOR_SALT: "salt-b" }, config });
    admin = new Client(adm.url);
    assert.equal((await admin.request("/api/admin/login", { json: { password: "pw" } })).status, 200);
  });
  after(async () => {
    await pub?.stop();
    await adm?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("checks preview keys in both containers, ntfy only in the public one", async () => {
    const { status, data } = await admin.json("/api/admin/integrations");
    assert.equal(status, 200);
    assert.deepEqual(data.columns, ["Public", "Admin"]);
    assert.ok(data.publicReportedAt > 0, "the public container reported at startup");

    const steam = (data.widgets as { type: string; env: Row[] }[]).find((w) => w.type === "steam")!;
    assert.deepEqual(steam.env.find((e) => e.name === "STEAM_API_KEY")!.cells, [true, false]);

    const general = data.general as Row[];
    const salt = general.find((g) => g.name === "VISITOR_SALT")!;
    assert.deepEqual(salt.cells, [true, true]);
    assert.equal(salt.mismatch, true);
    assert.deepEqual(general.find((g) => g.name === "ADMIN_PASSWORD_HASH")!.cells, ["na", false]);

    assert.equal(data.notifications.reported, true);
    assert.equal(data.notifications.valid, true);
    assert.deepEqual((data.notifications.vars as Row[]).find((v) => v.name === "NTFY_TOPIC")!.cells, [true]);

    // Nothing that looks like a value leaves the server.
    const text = JSON.stringify(data);
    for (const secret of ["test-topic", "salt-a", "salt-b", '"k"']) assert.ok(!text.includes(secret), secret);
  });
});
