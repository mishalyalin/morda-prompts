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

function splitVariants(text) {
  const out = {};
  const re = /^<!--\s*morda:(setup|routine)\s*-->\s*$/gm;
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

test("morda.md has exactly the two variants, setup and routine, each non-empty", () => {
  assert.deepEqual(Object.keys(V).sort(), ["routine", "setup"]);
  for (const k of Object.keys(V)) assert.ok(V[k].length > 200, `${k} is too short`);
  assert.equal((MORDA.match(/<!--\s*morda:/g) || []).length, 2);
});

test("the three stop phrases appear in every variant", () => {
  for (const [name, body] of Object.entries(V)) {
    for (const s of STOP) assert.ok(body.includes(s), `${name} lacks "${s}"`);
  }
});

test("only {BASE_URL} and {PROMPTS_URL} placeholders, no literal URLs in prompts/", () => {
  for (const f of readdirSync(join(HERE, "prompts"))) {
    if (!["morda.md", ...SPECS].includes(f)) continue;
    const p = read(join("prompts", f));
    assert.ok(!/https?:\/\//.test(p), `${f} contains a literal URL`);
    assert.ok(!/\?v=/.test(p), `${f} contains ?v=`);
    assert.ok(!/\{[A-Z_]*URL[A-Z_]*\}/.test(p.replace(/\{BASE_URL\}|\{PROMPTS_URL\}/g, "")), `${f} uses an unknown URL placeholder`);
  }
  assert.ok(MORDA.includes("{BASE_URL}"));
  for (const [name, body] of Object.entries(V)) assert.ok(body.includes("This text is public at {PROMPTS_URL}."), `${name} does not point at its public source`);
});

test("the key appears only as a bearer header or the /m link", () => {
  const served = Object.values(V).join("\n");
  const lines = served.split("\n").filter((l) => l.includes("{KEY}"));
  assert.ok(lines.length > 0);
  for (const l of lines) {
    const ok = l.includes('-H "Authorization: Bearer {KEY}"') || /\{BASE_URL\}\/m\/\{KEY\}(\/routine)?/.test(l);
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
    /^\{BASE_URL\}\/v1\/events\/ack$/,
    /^\{BASE_URL\}\/m\/\{KEY\}(\/routine)?$/,
  ];
  assert.ok(calls.length >= 6);
  for (const c of calls) assert.ok(allowed.some((r) => r.test(c)), `unexpected endpoint: ${c}`);
});

test("both variants carry {STATE_RULES} and {BRIEF_SPEC}; routine also carries {SEND_SPEC}", () => {
  for (const ph of ["{STATE_RULES}", "{BRIEF_SPEC}"]) {
    assert.ok(V.setup.includes(ph), `setup lacks ${ph}`);
    assert.ok(V.routine.includes(ph), `routine lacks ${ph}`);
  }
  assert.ok(V.routine.includes("{SEND_SPEC}"));
  assert.ok(V.setup.includes("even if the answer says needs_brief is false"));
  assert.ok(V.routine.includes('If "needs_brief" is false, do not write a brief.'));
});

test("setup creates one routine with the exact interval wording; the routine never creates routines", () => {
  assert.ok(V.setup.includes("every 15 minutes or as often as the account allows"));
  assert.ok(V.setup.includes('Create one cloud routine named "Morda"'));
  assert.ok(V.setup.includes("Never create a second routine with the same name."));
  assert.ok(V.setup.includes("{BASE_URL}/m/{KEY}/routine"));
  assert.ok(V.routine.includes("Never create, edit or delete routines."));
  assert.ok(!/create .*routine/i.test(V.routine.replace("Never create, edit or delete routines.", "")));
  assert.ok(!/every (5|10|30|60) minutes|hourly|every hour/i.test(MORDA));
});

test("routine records events by kind, acks them, and answers pending", () => {
  assert.ok(V.routine.includes("/v1/events/ack"));
  assert.ok(V.routine.includes('"through": <the events_through value>'));
  for (const k of ['"task"', '"ceo"', '"question"', '"silent"', '"options"', '"architect"']) {
    assert.ok(V.routine.includes(k), `routine does not say what to record for kind ${k}`);
  }
  assert.ok(V.routine.includes("/v1/items/<the item's id>/reply"));
});

test("no legacy links or reactions in the served variants", () => {
  const served = Object.values(V).join("\n");
  for (const bad of ["/full", "/tasks", "Work", "Later", "Dismiss", "Teach"]) {
    assert.ok(!served.includes(bad), `served text still mentions ${bad}`);
  }
  assert.ok(!MORDA.includes("Morda tasks\" whose"), "setup must not create a Morda tasks routine");
});

test("spec files exist, are non-empty and carry the sections that the app shows as items", () => {
  for (const f of SPECS) assert.ok(read(join("prompts", f)).trim().length > 100, `${f} empty`);
  const brief = read("prompts/_brief-spec.md");
  for (const k of ['"ceo"', '"architect"', '"questions"', '"options"', '"silent"', '"deep_work"', '"between_meetings"', '"exhausted"']) {
    assert.ok(brief.includes(k), `_brief-spec.md lacks ${k}`);
  }
  assert.ok(brief.includes("Zero items in any list is allowed"));
  assert.ok(brief.includes("DAY ONE"));
  assert.ok(read("prompts/_send-spec.md").includes('"sections"'));
  const state = read("prompts/_state-rules.md");
  for (const k of ['"done"', '"dismissed"', '"snoozed"', '"snoozed_until"', '"work"', '"user_tasks"', '"notes"']) assert.ok(state.includes(k), `_state-rules.md lacks ${k}`);
  assert.ok(!state.includes('"later"'), "_state-rules.md still explains later");
  assert.ok(!state.includes('"Q:'), "_state-rules.md still explains Q: tasks");
  for (const k of ['"question"', '"silent"', '"options"', '"architect"']) assert.ok(state.includes(k), `_state-rules.md lacks kind ${k}`);
  assert.ok(brief.includes("Done, Snooze"), "_brief-spec.md does not say sections become items");
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

test("v6 connector prompts: setup names every step, update keeps the person's decisions", () => {
  const setup = read("connector/setup.md");
  for (const s of ["get_my_list", "update_my_list", "every hour", "report_hourly"]) assert.ok(setup.includes(s), s);
  const update = read("connector/update.md");
  assert.ok(update.includes("Never send again a task the person closed"));
  assert.ok(update.includes("Keys starting `me:`"));
});
