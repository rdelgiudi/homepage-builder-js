import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/admin/password";
import { Client, startServer, type TestServer } from "./server";

const PASSWORD = "integration test password";
const v1 = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../fixtures/homepage.v1.json"), "utf-8"));
const content = { "about.md": "# About\n\nHello from the test." };
const ADMIN_PATHS = ["/admin", "/admin/login", "/admin/preview", "/api/admin/config"];

async function assertNoAdmin(server: TestServer) {
  for (const p of ADMIN_PATHS) {
    assert.equal((await fetch(server.url + p, { redirect: "manual" })).status, 404, p);
  }
  const login = await new Client(server.url).request("/api/admin/login", { json: { password: PASSWORD } });
  assert.equal(login.status, 404, "POST /api/admin/login");
  assert.equal((await fetch(server.url + "/")).status, 200, "the public site still works");
}

describe("admin panel switched off", () => {
  let server: TestServer;
  after(() => server?.stop());

  it("does not exist without an admin password", async () => {
    server = await startServer({ env: {}, config: v1, content });
    await assertNoAdmin(server);
  });

  it("does not exist with APP_ROLE=public, even with a password", async () => {
    await server.stop();
    server = await startServer({ env: { ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD), APP_ROLE: "public" }, config: v1, content });
    await assertNoAdmin(server);
  });
});

describe("admin panel switched on", () => {
  let server: TestServer;
  let admin: Client;

  before(async () => {
    server = await startServer({ env: { ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) }, config: v1, content });
    admin = new Client(server.url);
  });
  after(() => server?.stop());

  describe("signing in", () => {
    it("refuses the API without a session", async () => {
      assert.equal((await admin.json("/api/admin/config")).status, 401);
    });

    it("refuses a wrong password", async () => {
      const res = await admin.json("/api/admin/login", { json: { password: "wrong" } });
      assert.equal(res.status, 401);
      assert.equal(res.data.error, "Wrong password.");
    });

    it("refuses a sign-in from another site, or with no origin at all", async () => {
      const evil = new Client(server.url, "https://evil.example");
      assert.equal((await evil.request("/api/admin/login", { json: { password: PASSWORD } })).status, 403);
      const none = new Client(server.url, null);
      assert.equal((await none.request("/api/admin/login", { json: { password: PASSWORD } })).status, 403);
    });

    it("signs in, with the session cookie limited to the admin paths", async () => {
      const res = await admin.request("/api/admin/login", { json: { password: PASSWORD } });
      assert.equal(res.status, 200);
      const cookies = res.headers.getSetCookie();
      assert.equal(cookies.length, 2);
      assert.deepEqual(cookies.map((c) => /Path=([^;]+)/.exec(c)?.[1]).sort(), ["/admin", "/api/admin"]);
      for (const c of cookies) {
        assert.match(c, /HttpOnly/);
        assert.match(c, /SameSite=Strict/);
        assert.doesNotMatch(c, /Secure/, "plain HTTP must still work");
      }
      assert.equal((await admin.json("/api/admin/config")).status, 200);
    });

    it("refuses a cross-site write even with a valid session", async () => {
      const res = await admin.request("/api/admin/config", { method: "DELETE", headers: { Origin: "https://evil.example" } });
      assert.equal(res.status, 403);
    });
  });

  describe("draft, preview and publish", () => {
    let published: Record<string, unknown>;

    it("serves the v1 file migrated to v2", async () => {
      const { data } = await admin.json("/api/admin/config");
      published = data.published as Record<string, unknown>;
      assert.equal(published.version, 2);
      assert.equal((published.tabs as unknown[]).length, 6);
      assert.deepEqual(data.problems, []);
      assert.equal(data.draft, null);
    });

    it("refuses to save an invalid draft and says where the problem is", async () => {
      const broken = structuredClone(published) as { tabs: { label: string }[] };
      broken.tabs[0].label = "";
      const res = await admin.json("/api/admin/config", { method: "PUT", json: { config: broken } });
      assert.equal(res.status, 400);
      assert.equal((res.data.issues as { path: string }[])[0].path, "tabs.0.label");
    });

    it("saves a draft that only the admin preview shows", async () => {
      const draft = structuredClone(published) as { name: string; tabs: { sections: unknown[] }[] };
      draft.name = "Draft Only Name";
      draft.tabs[0].sections.push({ id: "test-poll", type: "poll", question: "Pasta?", options: ["Carbonara", "Amatriciana"] });
      assert.equal((await admin.json("/api/admin/config", { method: "PUT", json: { config: draft } })).status, 200);

      assert.doesNotMatch(await (await fetch(server.url + "/")).text(), /Draft Only Name/, "the live site");
      assert.match((await admin.json("/admin/preview")).text, /Draft Only Name/, "the admin preview");
      // Signed out the preview never shows the draft (streamed redirects can still answer 200).
      assert.doesNotMatch(await (await fetch(server.url + "/admin/preview")).text(), /Draft Only Name/, "the preview, signed out");
    });

    it("publishes the draft to homepage.json and keeps the old version", async () => {
      const res = await admin.json("/api/admin/config/publish", { method: "POST", json: {} });
      assert.equal(res.status, 200);
      const onDisk = JSON.parse(fs.readFileSync(server.configPath, "utf-8"));
      assert.equal(onDisk.name, "Draft Only Name");
      assert.equal(onDisk.version, 2);
      assert.match(await (await fetch(server.url + "/")).text(), /Draft Only Name/);

      const { data } = await admin.json("/api/admin/revisions");
      assert.equal((data.revisions as unknown[]).length, 1);
      assert.equal((await admin.json("/api/admin/config/publish", { method: "POST", json: {} })).status, 400, "nothing left to publish");
    });
  });

  describe("comment moderation", () => {
    const anon = () => new Client(server.url);

    it("holds comments for approval and shows them only to their author", async () => {
      assert.equal((await admin.json("/api/admin/comments/settings", { method: "PUT", json: { mode: "pre", holdWords: [] } })).status, 200);

      const author = anon();
      const posted = await author.json("/api/comments", { json: { name: "Ann", body: "Held comment" } });
      assert.equal(posted.status, 201);
      assert.equal((posted.data.comment as { pending?: boolean }).pending, true);

      assert.doesNotMatch((await anon().json("/api/comments")).text, /Held comment/, "other visitors");
      assert.match((await author.json("/api/comments")).text, /Held comment/, "the author");
      assert.doesNotMatch((await author.json("/api/comments")).text, /visitor_hash|"status"/, "no internals leak");
    });

    it("lets the admin approve, after which everyone sees it", async () => {
      const { data } = await admin.json("/api/admin/comments?status=pending");
      const [comment] = data.comments as { id: number; body: string }[];
      assert.equal(comment.body, "Held comment");
      assert.equal((await admin.json(`/api/admin/comments/${comment.id}`, { method: "PATCH", json: { status: "approved" } })).status, 200);
      assert.match((await anon().json("/api/comments")).text, /Held comment/);
    });

    it("refuses moderation without a session", async () => {
      assert.equal((await anon().json("/api/admin/comments/1", { method: "DELETE" })).status, 401);
    });

    it("blocks a visitor from commenting again", async () => {
      const visitor = anon();
      await visitor.json("/api/comments", { json: { name: "Spam", body: "first" } });
      const { data } = await admin.json("/api/admin/comments?status=pending");
      const id = (data.comments as { id: number; body: string }[]).find((c) => c.body === "first")!.id;
      assert.equal((await admin.json(`/api/admin/comments/${id}`, { method: "PATCH", json: { blockAuthor: true } })).status, 200);
      await new Promise((r) => setTimeout(r, 5100)); // past the per-visitor posting limit
      const again = await visitor.json("/api/comments", { json: { name: "Spam", body: "second" } });
      assert.equal(again.status, 403);
    });
  });

  describe("public endpoints", () => {
    it("records one poll vote per visitor and lets them change it", async () => {
      const visitor = new Client(server.url);
      let res = await visitor.json("/api/poll", { json: { id: "test-poll", option: "Carbonara" } });
      assert.deepEqual(res.data, { counts: [1, 0], total: 1, voted: "Carbonara" });
      await new Promise((r) => setTimeout(r, 1100));
      res = await visitor.json("/api/poll", { json: { id: "test-poll", option: "Amatriciana" } });
      assert.deepEqual(res.data, { counts: [0, 1], total: 1, voted: "Amatriciana" });
      assert.equal((await visitor.json("/api/poll", { json: { id: "test-poll", option: "Pizza" } })).status, 400);
      assert.equal((await visitor.json("/api/poll?id=no-such-poll")).status, 404);
    });

    it("serves markdown files but nothing outside the content folder", async () => {
      assert.match((await fetch(server.url + "/api/markdown?file=about.md").then((r) => r.text())), /Hello from the test/);
      for (const bad of ["../../package.json", "..%2F..%2Fpackage.json", "/etc/passwd"]) {
        assert.equal((await fetch(`${server.url}/api/markdown?file=${bad}`)).status, 404, bad);
      }
    });

    it("refuses uploads without a session", async () => {
      const form = new FormData();
      form.append("file", new Blob(["x"], { type: "image/png" }), "x.png");
      assert.equal((await new Client(server.url).request("/api/admin/upload", { body: form })).status, 401);
    });
  });

  describe("signing out", () => {
    it("ends the session", async () => {
      assert.equal((await admin.json("/api/admin/logout", { method: "POST", json: {} })).status, 200);
      assert.equal((await admin.json("/api/admin/config")).status, 401);
    });
  });
});
