import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNtfyRequest, commentNotice, enabledKinds, messageNotice, suggestionNotice } from "@/lib/notify";

const msg = messageNotice({ name: "José 🎮", email: "jose@example.com", body: "Hallo!\nZweite Zeile" });

describe("ntfy notifications", () => {
  it("is off without a valid topic or URL", () => {
    assert.equal(buildNtfyRequest({}, msg), null);
    assert.equal(buildNtfyRequest({ NTFY_TOPIC: "  " }, msg), null);
    assert.equal(buildNtfyRequest({ NTFY_TOPIC: "a/b" }, msg), null);
    assert.equal(buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_URL: "not a url" }, msg), null);
    assert.equal(buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_URL: "ftp://x" }, msg), null);
  });

  it("publishes JSON to the server root, keeping non-ASCII text out of headers", () => {
    const req = buildNtfyRequest({ NTFY_TOPIC: "my-topic" }, msg)!;
    assert.equal(req.url, "https://ntfy.sh/");
    assert.deepEqual(req.headers, { "Content-Type": "application/json" });
    const body = JSON.parse(req.body);
    assert.equal(body.topic, "my-topic");
    assert.equal(body.title, "New message from José 🎮");
    assert.equal(body.message, "Hallo!\nZweite Zeile\n\n— jose@example.com");
    assert.deepEqual(body.tags, ["envelope"]);
    assert.equal(body.click, undefined);
  });

  it("supports a self-hosted server under a path, a token and a click link", () => {
    const req = buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_URL: "https://push.example.com/ntfy//", NTFY_TOKEN: "tk_1", NTFY_CLICK: "https://example.com/admin" }, msg)!;
    assert.equal(req.url, "https://push.example.com/ntfy/");
    assert.equal(req.headers.Authorization, "Bearer tk_1");
    assert.equal(JSON.parse(req.body).click, "https://example.com/admin");
  });

  it("ignores a non-http click link and shortens long text", () => {
    const req = buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_CLICK: "javascript:alert(1)" }, messageNotice({ name: "a", email: null, body: "x".repeat(1000) }))!;
    const body = JSON.parse(req.body);
    assert.equal(body.click, undefined);
    assert.equal(body.message.length, 401);
    assert.ok(body.message.endsWith("…"));
  });

  it("switches kinds on and off with NTFY_EVENTS", () => {
    assert.deepEqual([...enabledKinds({})], ["message", "comment", "suggestion"]);
    assert.deepEqual([...enabledKinds({ NTFY_EVENTS: " Comment, suggestion ,bogus" })], ["comment", "suggestion"]);
    assert.equal(buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_EVENTS: "comment" }, msg), null);
    assert.ok(buildNtfyRequest({ NTFY_TOPIC: "t", NTFY_EVENTS: "comment,message" }, msg));
  });

  it("words comments and game suggestions", () => {
    assert.equal(commentNotice({ name: "Ann", body: "hi", pending: false }).title, "New comment from Ann");
    const held = commentNotice({ name: "Ann", body: "hi", pending: true });
    assert.equal(held.title, "Comment from Ann awaits approval");
    assert.equal(held.kind, "comment");

    const s = suggestionNotice({ title: "Celeste", name: "Bo", note: "so good", again: false });
    assert.equal(s.title, "Game suggestion: Celeste");
    assert.equal(s.message, "Bo suggested it:\nso good");
    assert.equal(suggestionNotice({ title: "Celeste", name: null, note: null, again: false }).message, "Suggested by a visitor.");
    assert.equal(suggestionNotice({ title: "Celeste", name: null, note: null, again: true }).message, "Suggested again.");
  });
});
