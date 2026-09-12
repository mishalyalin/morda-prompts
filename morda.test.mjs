// node --test morda.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  VERSION, WORK_PROMPT, REPLY_MAX_CHARS, REPLIES_MAX,
  b64urlEncode, b64urlDecode, derive, aad, encrypt, decrypt,
  resolveConfig, makeClient, selectPending, capReplies, mergeReply, fillWorkPrompt, newestTs, toMs, postReply,
} from "./morda.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const read = (rel) => readFileSync(join(HERE, rel), "utf8");
const SECRET = randomBytes(32);
const key = derive(SECRET, "morda-brief");

// ---- crypto ----

test("b64url round trip without padding", () => {
  const s = b64urlEncode(SECRET);
  assert.ok(!/[+/=]/.test(s));
  assert.deepEqual(b64urlDecode(s), SECRET);
});

test("encrypt/decrypt round trip, blob = iv+ct+tag", () => {
  const blob = encrypt(key, aad("box1", "brief", 3), { a: 1 });
  assert.deepEqual(decrypt(key, aad("box1", "brief", 3), blob), { a: 1 });
  assert.equal(Buffer.from(blob, "base64").length, 12 + JSON.stringify({ a: 1 }).length + 16);
});

test("AAD binds box, kind and seq; wrong key fails", () => {
  const blob = encrypt(key, aad("box1", "brief", 3), { a: 1 });
  assert.throws(() => decrypt(key, aad("box1", "brief", 4), blob));
  assert.throws(() => decrypt(key, aad("box1", "state", 3), blob));
  assert.throws(() => decrypt(key, aad("box2", "brief", 3), blob));
  assert.throws(() => decrypt(derive(randomBytes(32), "morda-brief"), aad("box1", "brief", 3), blob));
});

test("derive labels give different keys", () => {
  assert.notDeepEqual(derive(SECRET, "morda-brief"), derive(SECRET, "morda-state"));
  assert.notDeepEqual(derive(SECRET, "morda-brief"), derive(SECRET, "morda-auth"));
});

// ---- config ----

const tmp = mkdtempSync(join(tmpdir(), "morda-test-"));
const cfgPath = join(tmp, "config.json");
const envAll = { MORDA_URL: "https://x.example/brief/", MORDA_BOX: "b1", MORDA_SECRET: b64urlEncode(SECRET) };

test("resolveConfig: env wins, trailing slash stripped, keys derived", () => {
  const c = resolveConfig(envAll, join(tmp, "missing.json"));
  assert.equal(c.url, "https://x.example/brief");
  assert.equal(c.box, "b1");
  assert.deepEqual(c.keys.brief, key);
  assert.equal(c.keys.auth, b64urlEncode(derive(SECRET, "morda-auth")));
});

test("resolveConfig: file fills what env lacks", () => {
  writeFileSync(cfgPath, JSON.stringify({ url: "https://f.example", box: "fbox", secret: b64urlEncode(SECRET) }));
  const c = resolveConfig({ MORDA_BOX: "envbox" }, cfgPath);
  assert.equal(c.url, "https://f.example");
  assert.equal(c.box, "envbox");
});

test("resolveConfig: missing -> not configured; short secret rejected", () => {
  assert.throws(() => resolveConfig({}, join(tmp, "missing.json")), /not configured/);
  assert.throws(() => resolveConfig({ ...envAll, MORDA_SECRET: b64urlEncode(randomBytes(16)) }, cfgPath), /32 bytes/);
});

// ---- client ----

test("makeClient: bearer auth, 404 -> null, 409 surfaces, put returns seq", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/state")) return { status: 404, ok: false, text: async () => "" };
    if (url.endsWith("/brief") && init.method === "PUT") {
      const body = JSON.parse(init.body);
      if (body.seq !== 2) return { status: 409, ok: false, text: async () => JSON.stringify({ current: 1 }) };
      return { status: 200, ok: true, text: async () => JSON.stringify({ seq: 2 }) };
    }
    return { status: 200, ok: true, text: async () => JSON.stringify({ seq: 1 }) };
  };
  const c = makeClient(resolveConfig(envAll, cfgPath), fetchFn);
  assert.equal(await c.get("state"), null);
  assert.equal(await c.seq("brief"), 1);
  await assert.rejects(c.put("brief", 1, {}), /HTTP 409/);
  assert.equal(await c.put("brief", 2, { x: 1 }), 2);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${b64urlEncode(derive(SECRET, "morda-auth"))}`);
  assert.ok(calls[0].url.startsWith("https://x.example/brief/v2/boxes/b1/"));
  const put = JSON.parse(calls.at(-1).init.body);
  assert.deepEqual(decrypt(key, aad("b1", "brief", 2), put.blob), { x: 1 });
});

test("postReply: retries once on 409 with a fresh read", async () => {
  let briefSeq = 5, puts = 0;
  const brief = { items: [{ id: "t1", kind: "task", title: "T" }] };
  const state = { items: { t1: { status: "work", notes: [{ ts: 10, text: "n" }] } } };
  const cfg = resolveConfig(envAll, cfgPath);
  const fetchFn = async (url, init) => {
    if (init.method === "GET" && url.endsWith("/brief")) return { status: 200, ok: true, text: async () => JSON.stringify({ seq: briefSeq, blob: encrypt(cfg.keys.brief, aad("b1", "brief", briefSeq), brief) }) };
    if (init.method === "GET" && url.endsWith("/state")) return { status: 200, ok: true, text: async () => JSON.stringify({ seq: 9, blob: encrypt(cfg.keys.state, aad("b1", "state", 9), state) }) };
    puts++;
    if (puts === 1) { briefSeq = 6; return { status: 409, ok: false, text: async () => JSON.stringify({ current: 6 }) }; }
    const body = JSON.parse(init.body);
    const doc = decrypt(cfg.keys.brief, aad("b1", "brief", body.seq), body.blob);
    assert.equal(body.seq, 7);
    assert.equal(doc.acked_state_seq, 9);
    assert.equal(doc.items[0].replies[0].text, "hello");
    return { status: 200, ok: true, text: async () => JSON.stringify({ seq: body.seq }) };
  };
  assert.equal(await postReply(makeClient(cfg, fetchFn), "t1", "hello"), 7);
  assert.equal(puts, 2);
});

// ---- pure logic ----

test("toMs / newestTs tolerate numbers, ISO strings and junk", () => {
  assert.equal(toMs(5), 5);
  assert.equal(toMs("1970-01-01T00:00:01Z"), 1000);
  assert.equal(toMs("nope"), 0);
  assert.equal(toMs(undefined), 0);
  assert.equal(newestTs([]), 0);
  assert.equal(newestTs(undefined), 0);
  assert.equal(newestTs([{ ts: 3 }, null, { ts: "1970-01-01T00:00:01Z" }, {}]), 1000);
});

test("selectPending: work item without reply is pending", () => {
  const out = selectPending({ items: [{ id: "a", title: "A", body: "b" }] }, { items: { a: { status: "work", ts: 1 } } });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "A");
  assert.equal(out[0].body, "b");
});

test("selectPending: replied item with no newer note is not pending", () => {
  const out = selectPending({ items: [{ id: "a", replies: [{ ts: 100, text: "r" }] }] }, { items: { a: { status: "work", notes: [{ ts: 50, text: "n" }] } } });
  assert.equal(out.length, 0);
});

test("selectPending: note newer than last reply makes it pending again", () => {
  const out = selectPending({ items: [{ id: "a", replies: [{ ts: 100, text: "r" }] }] }, { items: { a: { status: "work", notes: [{ ts: 150, text: "n" }] } } });
  assert.equal(out.length, 1);
});

test("selectPending: non-work statuses and u- items missing from brief", () => {
  const state = { items: { d: { status: "done" }, o: { status: "open" }, "u-1": { status: "work", title: "User task" } } };
  const out = selectPending({ items: [] }, state);
  assert.deepEqual(out.map((x) => x.id), ["u-1"]);
  assert.equal(out[0].title, "User task");
  assert.equal(selectPending(null, null).length, 0);
});

test("capReplies keeps the newest max entries", () => {
  const r = Array.from({ length: 25 }, (_, i) => ({ ts: i, text: String(i) }));
  const c = capReplies(r);
  assert.equal(c.length, REPLIES_MAX);
  assert.equal(c[0].ts, 5);
  assert.equal(c.at(-1).ts, 24);
});

test("mergeReply: appends to existing item, sets acked_state_seq, does not mutate input", () => {
  const brief = { summary: "s", items: [{ id: "a", title: "A", replies: [{ ts: 1, text: "old" }] }] };
  const out = mergeReply(brief, "a", "new", { ackedStateSeq: 7, now: 1000 });
  assert.equal(out.items[0].replies.length, 2);
  assert.equal(out.items[0].replies[1].text, "new");
  assert.equal(out.items[0].replies[1].ts, 1000);
  assert.equal(out.acked_state_seq, 7);
  assert.equal(brief.items[0].replies.length, 1);
  assert.equal(out.summary, "s");
});

test("mergeReply: creates a task stub for an unknown id", () => {
  const out = mergeReply({ items: [] }, "u-9", "hi", { fallbackTitle: "Vet" });
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].kind, "task");
  assert.equal(out.items[0].title, "Vet");
  assert.equal(out.items[0].source, "note");
});

test("mergeReply: caps text at REPLY_MAX_CHARS and replies at REPLIES_MAX", () => {
  const existing = Array.from({ length: REPLIES_MAX }, (_, i) => ({ ts: i, text: "x" }));
  const out = mergeReply({ items: [{ id: "a", replies: existing }] }, "a", "y".repeat(REPLY_MAX_CHARS + 10));
  assert.equal(out.items[0].replies.length, REPLIES_MAX);
  assert.equal(out.items[0].replies.at(-1).text.length, REPLY_MAX_CHARS);
});

test("mergeReply: reply ts is after the note it answers even if the clock is behind", () => {
  const out = mergeReply({ items: [{ id: "a" }] }, "a", "r", { now: 100, after: 5000 });
  assert.equal(out.items[0].replies[0].ts, 5001);
  const pending = selectPending(out, { items: { a: { status: "work", notes: [{ ts: 5000, text: "n" }] } } });
  assert.equal(pending.length, 0);
});

test("fillWorkPrompt fills all four placeholders", () => {
  const p = fillWorkPrompt(WORK_PROMPT, { title: "T", body: "B", notes: [{ ts: 1, text: "n" }], replies: [] });
  assert.ok(p.includes("Task: T."));
  assert.ok(p.includes("Details: B."));
  assert.ok(p.includes('"text":"n"'));
  assert.ok(!/\{(TITLE|BODY|NOTES|REPLIES)\}/.test(p));
});

// ---- repo consistency ----

test("WORK_PROMPT equals prompts/work-prompt.md", () => {
  assert.equal(WORK_PROMPT, read("prompts/work-prompt.md").trim());
});

test("setup prompts embed spec/state.md and spec/brief.md verbatim", () => {
  const state = read("spec/state.md").trim(), brief = read("spec/brief.md").trim();
  for (const f of ["prompts/claude-code-e2e.md", "prompts/claude-code-e2e-existing.md"]) {
    const p = read(f);
    assert.ok(p.includes(state), `${f} lacks state spec`);
    assert.ok(p.includes(brief), `${f} lacks brief spec`);
    assert.ok(!p.includes("{LEVEL_SNIPPET}"));
  }
});

test("prompts pin this VERSION and the real sha256 of morda.mjs", () => {
  const sha = createHash("sha256").update(readFileSync(join(HERE, "morda.mjs"))).digest("hex");
  for (const f of ["prompts/claude-code-e2e.md", "prompts/claude-code-e2e-existing.md", "prompts/routine-work.md", "README.md"]) {
    const p = read(f);
    assert.ok(p.includes(`morda-prompts/v${VERSION}/`) || p.includes(`| v${VERSION} |`), `${f} does not pin v${VERSION}`);
    assert.ok(p.includes(sha), `${f} does not carry sha256 ${sha}`);
  }
});

test("no secrets or private paths in the repo files", () => {
  for (const f of ["morda.mjs", "prompts/claude-code-e2e.md", "prompts/claude-code-e2e-existing.md", "prompts/routine-work.md", "README.md"]) {
    const p = read(f);
    assert.ok(!p.includes("/Users/"), `${f} contains a home path`);
    const tokens = (p.replace(/[a-f0-9]{64}/g, "").match(/[A-Za-z0-9_-]{43,}/g) || []).filter((t) => /[A-Za-z]/.test(t) && /\d/.test(t));
    assert.deepEqual(tokens, [], `${f} contains a base64url-looking token`);
  }
});

// ---- CLI ----

const node = process.execPath;
const script = join(HERE, "morda.mjs");

test("cli: no args -> usage, exit 2", () => {
  const r = spawnSync(node, [script], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage:/);
});

test("cli: not configured -> exit 1 with morda: not configured", () => {
  const home = join(tmp, "home"); mkdirSync(home, { recursive: true });
  const r = spawnSync(node, [script, "state"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: home } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^morda: not configured/);
  assert.equal(r.stdout, "");
});

test("cli: --version", () => {
  const r = spawnSync(node, [script, "--version"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), VERSION);
});
