// node --test prompts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const read = (rel) => readFileSync(join(HERE, rel), "utf8");

const MORDA = read("prompts/morda.md");
const SPECS = ["_brief-spec.md", "_send-spec.md", "_state-rules.md"];
const STOP = [
  "Do not run anything else.",
  "Never print the key.",
  "If the server answers 401 stop and tell the user to open the Morda app.",
];
const MARKER = /^<!--\s*morda:(setup|full|tasks)\s*-->\s*$/m;

function splitVariants(text) {
  const out = {};
  const re = /^<!--\s*morda:(setup|full|tasks)\s*-->\s*$/gm;
  let m, last = null;
  const cuts = [];
  while ((m = re.exec(text)) !== null) cuts.push([m[1], m.index, m.index + m[0].length]);
  for (let i = 0; i < cuts.length; i++) {
    const [name, , end] = cuts[i];
    const stop = i + 1 < cuts.length ? cuts[i + 1][1] : text.length;
    out[name] = text.slice(end, stop).trim();
  }
  return out;
}

const V = splitVariants(MORDA);

test("morda.md has exactly the three variants, each non-empty", () => {
  assert.deepEqual(Object.keys(V).sort(), ["full", "setup", "tasks"]);
  for (const k of Object.keys(V)) assert.ok(V[k].length > 200, `${k} is too short`);
  assert.equal((MORDA.match(/<!--\s*morda:/g) || []).length, 3);
});

test("the three stop phrases appear in every variant", () => {
  for (const [name, body] of Object.entries(V)) {
    for (const s of STOP) assert.ok(body.includes(s), `${name} lacks "${s}"`);
  }
});

test("exactly one host placeholder and no literal URLs in prompts/", () => {
  for (const f of readdirSync(join(HERE, "prompts"))) {
    if (!["morda.md", ...SPECS].includes(f)) continue;
    const p = read(join("prompts", f));
    assert.ok(!/https?:\/\//.test(p), `${f} contains a literal URL`);
    assert.ok(!/\?v=/.test(p), `${f} contains ?v=`);
    assert.ok(!/\{[A-Z_]*URL[A-Z_]*\}/.test(p.replace(/\{BASE_URL\}/g, "")), `${f} uses a second host placeholder`);
  }
  assert.ok(MORDA.includes("{BASE_URL}"));
});

test("the key travels only as a bearer header", () => {
  const served = Object.values(V).join("\n");
  const lines = served.split("\n").filter((l) => l.includes("{KEY}"));
  assert.ok(lines.length > 0);
  for (const l of lines) {
    const ok = l.includes('-H "Authorization: Bearer {KEY}"') || /\{BASE_URL\}\/m\/\{KEY\}(\/full|\/tasks)?/.test(l);
    assert.ok(ok, `key used outside a bearer header or /m link: ${l.trim()}`);
    assert.ok(!/[?&][a-z_]+=\{KEY\}/.test(l), `key in a query string: ${l.trim()}`);
  }
});

test("only the allowed endpoints are called", () => {
  const served = Object.values(V).join("\n").replace(/<the item's id>/g, "ITEM");
  const calls = served.match(/\{BASE_URL\}\/[A-Za-z0-9_\/{}]+/g) || [];
  const allowed = [
    /^\{BASE_URL\}\/v1\/pending$/,
    /^\{BASE_URL\}\/v1\/state$/,
    /^\{BASE_URL\}\/v1\/brief$/,
    /^\{BASE_URL\}\/v1\/items\/ITEM\/reply$/,
    /^\{BASE_URL\}\/m\/\{KEY\}(\/full|\/tasks)?$/,
  ];
  assert.ok(calls.length >= 6);
  for (const c of calls) assert.ok(allowed.some((r) => r.test(c)), `unexpected endpoint: ${c}`);
});

test("setup and full variants use every spec placeholder; tasks never briefs", () => {
  for (const ph of ["{STATE_RULES}", "{BRIEF_SPEC}"]) {
    assert.ok(V.setup.includes(ph), `setup lacks ${ph}`);
    assert.ok(V.full.includes(ph), `full lacks ${ph}`);
  }
  assert.ok(V.full.includes("{SEND_SPEC}"));
  assert.ok(!V.tasks.includes("{BRIEF_SPEC}") && !V.tasks.includes("{SEND_SPEC}") && !V.tasks.includes("/v1/brief"));
  assert.ok(V.tasks.includes("Never write or send a brief from here."));
  assert.ok(V.setup.includes("even if the answer says needs_brief is false"));
});

test("routine timing stays hedged", () => {
  assert.ok(V.setup.includes("every 15 minutes or as often as the account allows"));
  assert.ok(!/every (5|10|30|60) minutes|hourly|every hour/i.test(MORDA));
});

test("spec files exist, are non-empty and carry the v4 sections", () => {
  for (const f of SPECS) assert.ok(read(join("prompts", f)).trim().length > 100, `${f} empty`);
  const brief = read("prompts/_brief-spec.md");
  for (const k of ['"ceo"', '"architect"', '"questions"', '"options"', '"silent"', '"deep_work"', '"between_meetings"', '"exhausted"']) {
    assert.ok(brief.includes(k), `_brief-spec.md lacks ${k}`);
  }
  assert.ok(brief.includes("Zero items in any list is allowed"));
  assert.ok(brief.includes("DAY ONE"));
  assert.ok(read("prompts/_send-spec.md").includes('"sections"'));
  assert.ok(read("prompts/_state-rules.md").includes('"dismissed"'));
});

test("no long dashes, no home paths, no secrets-looking tokens", () => {
  for (const f of ["prompts/morda.md", ...SPECS.map((s) => join("prompts", s)), "CONTRIBUTING.md"]) {
    const p = read(f);
    assert.ok(!/[–—]/.test(p), `${f} contains a long dash`);
    assert.ok(!p.includes("/Users/"), `${f} contains a home path`);
    const tokens = (p.replace(/[a-f0-9]{64}/g, "").match(/[A-Za-z0-9_-]{43,}/g) || []).filter((t) => /[A-Za-z]/.test(t) && /\d/.test(t));
    assert.deepEqual(tokens, [], `${f} contains a base64url-looking token`);
  }
});
