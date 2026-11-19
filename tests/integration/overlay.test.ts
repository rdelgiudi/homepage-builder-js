import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client, startServer, type TestServer } from "./server";

const config = {
  version: 2,
  name: "Overlay Test",
  tabs: [{ id: "home", label: "Home", sections: [{ id: "live-skills", type: "skills", text: "Overlay Title", items: [{ label: "Published overlay text" }] }] }],
};

/** The rendered markup only — Next's flight data after it also carries the root loading screen, for client navigation. */
const rendered = (html: string) => html.slice(0, html.indexOf("self.__next_f"));
const viewers = async (base: string) => ((await (await fetch(base + "/api/viewers")).json()) as { count: number }).count;
const open = (url: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("WebSocket failed: " + url));
  });

describe("stream overlay (/overlay/<id>)", () => {
  let server: TestServer;
  let admin: Client;

  before(async () => {
    server = await startServer({ env: { ADMIN_PASSWORD: "pw" }, config });
    admin = new Client(server.url);
    assert.equal((await admin.request("/api/admin/login", { json: { password: "pw" } })).status, 200);
  });
  after(() => server?.stop());

  it("renders one published widget on a transparent page, without the site around it", async () => {
    const html = rendered(await (await fetch(server.url + "/overlay/live-skills")).text());
    assert.match(html, /Published overlay text/);
    assert.match(html, /Overlay Title/);
    assert.match(html, /html,body\{background:transparent!important\}/);
    assert.doesNotMatch(html, /animate-shimmer/, "no loading skeleton (it would flash in OBS)");
    assert.doesNotMatch(html, /viewing now|unique visitors/, "no counters");
  });

  it("?title=0 drops the title row", async () => {
    const html = rendered(await (await fetch(server.url + "/overlay/live-skills?title=0")).text());
    assert.match(html, /Published overlay text/);
    assert.doesNotMatch(html, /Overlay Title/);
  });

  it("never shows a widget that exists only in the admin draft", async () => {
    const { data } = await admin.json("/api/admin/config");
    const draft = structuredClone(data.published) as typeof config;
    draft.tabs[0].sections.push({ id: "draft-skills", type: "skills", text: "Draft", items: [{ label: "Unpublished secret text" }] });
    assert.equal((await admin.json("/api/admin/config", { method: "PUT", json: { config: draft } })).status, 200);
    const html = await (await fetch(server.url + "/overlay/draft-skills")).text();
    assert.doesNotMatch(html, /Unpublished secret text/);
  });

  it("an overlay connection is not counted as a viewer; a page is", async () => {
    const base = server.url.replace(/^http/, "ws");
    assert.equal(await viewers(server.url), 0);
    const overlay = await open(base + "/ws?overlay=1");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await viewers(server.url), 0, "overlay only");
    const page = await open(base + "/ws");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await viewers(server.url), 1, "overlay + one page");
    overlay.close();
    page.close();
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await viewers(server.url), 0);
  });
});
