// morda.mjs - your own Claude's side of Morda. No dependencies, Node 18+ (or bun).
// The Morda server only ever sees ciphertext and a derived auth token, never the secret.
//
//   node morda.mjs state                        prints what you did in the app, as JSON ({} if nothing yet)
//   node morda.mjs send brief.json              encrypts brief.json and uploads it
//   node morda.mjs brief                        prints the current brief as JSON
//   node morda.mjs pending                      prints the items you handed to Claude that still need a reply
//   node morda.mjs reply <id> --file <path>     appends a reply to that item (or pipe the text on stdin)
//   node morda.mjs watch [--interval 30] [--claude <path>] [--prompt <path>]
//                                               loop: run pending items through Claude Code, post the replies
//
// Config, first one wins per field: env MORDA_URL / MORDA_BOX / MORDA_SECRET, then ~/.morda/config.json
// ({"url": ..., "box": ..., "secret": ...}, chmod 600). Nothing else is ever read or written, except the
// files you name on the command line.
import { hkdfSync, createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

export const VERSION = "3.0.0";
export const CONFIG_PATH = join(homedir(), ".morda", "config.json");
// Kept identical to prompts/work-prompt.md (morda.test.mjs checks). {TITLE} {BODY} {NOTES} {REPLIES} are filled per item.
export const WORK_PROMPT =
  "You are working on one task for the user. Task: {TITLE}. Details: {BODY}. User notes: {NOTES}. Your earlier replies: {REPLIES}. Do the task if it can be done from here, otherwise say plainly what you need. Answer in the language of the task, under 200 words, no preamble.";

export const REPLY_MAX_CHARS = 4000; // per reply, matches spec/brief.md
export const REPLIES_MAX = 20; // per item, oldest dropped first
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000; // one headless Claude run
const RETRY_FAILED_MS = 10 * 60 * 1000; // watch: leave a failing item alone this long before trying again

// ---- crypto (mirrors the app's WebCrypto byte for byte) ------------------------------------------

export function b64urlDecode(s) { return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
export function b64urlEncode(b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function derive(secret, label) { return Buffer.from(hkdfSync("sha256", secret, "", label, 32)); }
export function aad(box, kind, seq) { return Buffer.from(`${box}|${kind}|${seq}`); }

// blob = base64( iv(12) + ciphertext + tag(16) ), AES-256-GCM, AAD binds the blob to box, kind and seq.
export function encrypt(key, aadBytes, obj) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aadBytes);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), "utf8")), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64");
}

export function decrypt(key, aadBytes, blobB64) {
  const buf = Buffer.from(blobB64, "base64");
  if (buf.length < 28) throw new Error("blob too short");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAAD(aadBytes);
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString("utf8"));
}

// ---- config + server client ---------------------------------------------------------------------

// Pure apart from the one file read. Returns { url, box, keys: { brief, state, auth } }.
export function resolveConfig(env = process.env, configPath = CONFIG_PATH) {
  let { MORDA_URL: url, MORDA_BOX: box, MORDA_SECRET: secret } = env;
  if (!(url && box && secret)) {
    let file = {};
    try { file = JSON.parse(readFileSync(configPath, "utf8")) || {}; } catch { /* absent or unreadable: fall through */ }
    url = url || file.url; box = box || file.box; secret = secret || file.secret;
  }
  if (!url || !box || !secret) throw new Error(`not configured: set MORDA_URL, MORDA_BOX and MORDA_SECRET, or create ${configPath}`);
  const raw = b64urlDecode(secret);
  if (raw.length !== 32) throw new Error("secret must decode to 32 bytes");
  return {
    url: String(url).replace(/\/+$/, ""),
    box: String(box),
    keys: { brief: derive(raw, "morda-brief"), state: derive(raw, "morda-state"), auth: b64urlEncode(derive(raw, "morda-auth")) },
  };
}

export function makeClient({ url, box, keys }, fetchFn = fetch) {
  async function api(method, path, body) {
    const r = await fetchFn(`${url}/v2/boxes/${box}${path}`, {
      method,
      headers: { Authorization: `Bearer ${keys.auth}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 404) return null;
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} -> HTTP ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
  return {
    box,
    // { seq, doc } or null when the box has no blob of this kind yet
    async get(kind) {
      const row = await api("GET", `/${kind}`);
      return row ? { seq: row.seq, doc: decrypt(keys[kind], aad(box, kind, row.seq), row.blob) } : null;
    },
    async seq(kind) { const r = await api("GET", `/${kind}/seq`); return r ? r.seq : 0; },
    // Resolves to the stored seq; throws "HTTP 409" when `seq` is not above the server's current one.
    async put(kind, seq, doc) { return (await api("PUT", `/${kind}`, { seq, blob: encrypt(keys[kind], aad(box, kind, seq), doc) })).seq; },
  };
}

// ---- pure logic (unit-tested in morda.test.mjs) ---------------------------------------------------

export function toMs(ts) {
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : 0;
  if (typeof ts === "string") { const n = Date.parse(ts); return Number.isFinite(n) ? n : 0; }
  return 0;
}

export function newestTs(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((m, x) => (x && toMs(x.ts) > m ? toMs(x.ts) : m), 0);
}

// Which state items (status "work") still need a reply: no reply yet, or a note newer than the last reply.
export function selectPending(brief, state) {
  const briefItems = new Map(((brief && brief.items) || []).filter((i) => i && i.id).map((i) => [i.id, i]));
  const out = [];
  for (const [id, it] of Object.entries((state && state.items) || {})) {
    if (!it || it.status !== "work") continue;
    const notes = Array.isArray(it.notes) ? it.notes : [];
    const b = briefItems.get(id);
    const replies = b && Array.isArray(b.replies) ? b.replies : [];
    if (replies.length && newestTs(notes) <= newestTs(replies)) continue;
    out.push({ id, title: (b && b.title) || it.title || id, body: (b && b.body) || null, status: it.status, work_ts: it.work_ts || it.ts || null, notes, replies });
  }
  return out;
}

export function capReplies(replies, max = REPLIES_MAX) { return replies.length > max ? replies.slice(replies.length - max) : replies.slice(); }

// New brief with `text` appended to item `id`'s replies (a "task" stub is created for a user-created id
// that is not in the brief yet). The reply's ts is forced past `after` (the newest note it answers), so a
// phone clock that runs ahead of this machine can never make the same note look unanswered forever.
export function mergeReply(brief, id, text, { ackedStateSeq, fallbackTitle, now = Date.now(), after = 0 } = {}) {
  const items = ((brief && brief.items) || []).map((i) => ({ ...i }));
  let idx = items.findIndex((i) => i && i.id === id);
  if (idx === -1) {
    items.push({ id, kind: "task", title: fallbackTitle || id, body: null, url: null, due: null, priority: 3, source: "note" });
    idx = items.length - 1;
  }
  const reply = { ts: Math.max(now, after + 1), text: String(text).slice(0, REPLY_MAX_CHARS) };
  items[idx].replies = capReplies([...(Array.isArray(items[idx].replies) ? items[idx].replies : []), reply]);
  const out = { ...brief, items };
  if (ackedStateSeq !== undefined) out.acked_state_seq = ackedStateSeq;
  return out;
}

export function fillWorkPrompt(template, item) {
  return template
    .replaceAll("{TITLE}", item.title || "")
    .replaceAll("{BODY}", item.body || "")
    .replaceAll("{NOTES}", JSON.stringify(item.notes || []))
    .replaceAll("{REPLIES}", JSON.stringify(item.replies || []));
}

// ---- commands -------------------------------------------------------------------------------------

function opt(args, name) { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; }
function log(msg) { process.stderr.write(`morda: ${msg}\n`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cmdState(c) {
  const cur = await c.get("state");
  console.log(JSON.stringify(cur ? { ...cur.doc, seq: cur.seq } : {}, null, 2));
}

async function cmdSend(c, file) {
  if (!file) throw new Error("usage: node morda.mjs send brief.json");
  const brief = JSON.parse(readFileSync(file, "utf8"));
  if (!brief.generated_at) brief.generated_at = new Date().toISOString();
  const seq = await c.put("brief", (await c.seq("brief")) + 1, brief);
  const digest = createHash("sha256").update(JSON.stringify(brief)).digest("hex").slice(0, 12);
  console.log(`sent brief seq=${seq} items=${(brief.items || []).length} sha256=${digest}`);
}

async function cmdBrief(c) {
  const cur = await c.get("brief");
  if (!cur) throw new Error("no brief yet");
  console.log(JSON.stringify({ ...cur.doc, seq: cur.seq }, null, 2));
}

async function pendingItems(c) {
  const [b, s] = await Promise.all([c.get("brief"), c.get("state")]);
  return selectPending(b && b.doc, s && s.doc);
}

async function cmdPending(c) { console.log(JSON.stringify(await pendingItems(c), null, 2)); }

// Re-reads the brief and retries once if someone else bumped the seq in between.
export async function postReply(c, id, text) {
  for (let attempt = 0; ; attempt++) {
    const [b, s] = await Promise.all([c.get("brief"), c.get("state")]);
    if (!b) throw new Error("no brief yet");
    const it = s && s.doc.items ? s.doc.items[id] : undefined;
    const updated = mergeReply(b.doc, id, text, { ackedStateSeq: s ? s.seq : undefined, fallbackTitle: it && it.title, after: newestTs(it && it.notes) });
    try { return await c.put("brief", b.seq + 1, updated); }
    catch (e) { if (attempt === 0 && /HTTP 409/.test(e.message)) continue; throw e; }
  }
}

async function readReplyText(args) {
  const usage = "usage: node morda.mjs reply <id> --file <path>  (or pipe the text on stdin)";
  const file = opt(args, "--file");
  if (args.includes("--file") && !file) throw new Error(usage);
  if (file) return readFileSync(file, "utf8").trim();
  if (process.stdin.isTTY) throw new Error(usage);
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error(usage);
  return text;
}

async function cmdReply(c, id, args) {
  if (!id) throw new Error("usage: node morda.mjs reply <id> --file <path>");
  const seq = await postReply(c, id, await readReplyText(args));
  console.log(`replied ${id} brief seq=${seq}`);
}

function runClaude(claudePath, promptText) {
  return new Promise((resolve, reject) => {
    const child = spawn(claudePath, ["-p", promptText, "--output-format", "text"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`claude timed out after ${CLAUDE_TIMEOUT_MS / 60000} min`)); }, CLAUDE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e.code === "ENOENT" ? new Error(`claude CLI not found at "${claudePath}"; pass --claude <path>`) : e); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(out.trim()) : reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 300)}`)); });
  });
}

async function cmdWatch(c, args) {
  const interval = Number(opt(args, "--interval") || 30);
  if (!(interval >= 5)) throw new Error("--interval must be at least 5 seconds");
  const claudePath = opt(args, "--claude") || "claude";
  const promptPath = opt(args, "--prompt");
  const template = promptPath ? readFileSync(promptPath, "utf8").trim() : WORK_PROMPT;
  const failedAt = new Map();
  log(`watching box ${c.box.slice(0, 8)}... every ${interval}s (claude: ${claudePath})`);
  for (;;) {
    try {
      for (const item of await pendingItems(c)) {
        if (Date.now() - (failedAt.get(item.id) || 0) < RETRY_FAILED_MS) continue;
        log(`working on ${item.id}`);
        try {
          const text = await runClaude(claudePath, fillWorkPrompt(template, item));
          if (!text) throw new Error("claude returned an empty reply");
          const seq = await postReply(c, item.id, text);
          failedAt.delete(item.id);
          log(`replied ${item.id} (brief seq=${seq})`);
        } catch (e) {
          failedAt.set(item.id, Date.now());
          log(`${item.id} failed, will retry in ${RETRY_FAILED_MS / 60000} min: ${e.message}`);
        }
      }
    } catch (e) {
      log(`poll failed: ${e.message}`);
    }
    await sleep(interval * 1000);
  }
}

const USAGE = "usage: node morda.mjs state | send brief.json | brief | pending | reply <id> --file <path> | watch [--interval 30] [--claude <path>] [--prompt <path>]";

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const commands = {
    state: (c) => cmdState(c),
    send: (c) => cmdSend(c, rest[0]),
    brief: (c) => cmdBrief(c),
    pending: (c) => cmdPending(c),
    reply: (c) => cmdReply(c, rest[0], rest.slice(1)),
    watch: (c) => cmdWatch(c, rest),
  };
  if (cmd === "--version") { console.log(VERSION); return 0; }
  if (!commands[cmd]) { console.error(USAGE); return 2; }
  try { await commands[cmd](makeClient(resolveConfig())); return 0; }
  catch (e) { console.error(`morda: ${e.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
