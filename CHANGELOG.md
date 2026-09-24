# Changelog

## v7.0.0 - 2026-09-24

- `connector/update.md` rewritten around open loops: read sessions first, then memory, mail and calendar; sort each candidate (needs you / waiting on others / Claude is on it / notice); look for a later close before keeping an item; never turn a notice into "pay this"; a source sentence behind every item; caps and priorities.
- New item fields: `kind`, `project`, `step`, `why`, `who`, `since`, `from_title`, `from_link`, `quote`, `drop`.
- Setup points to Claude Code first (it can read the sessions), a normal chat as the fallback.

## v6.0.0 - 2026-09-24

- The Morda connector (OAuth custom connector in Claude) replaces the curl links. `connector/setup.md` is what the `set_up_morda` tool returns; `connector/update.md` is what `get_my_list` returns.
- Setup is one message to Claude: fill the list now, create an hourly scheduled task, then `report_hourly` so the app shows whether hourly updates are on.

## v5.0.0 - 2026-09-19 (no tag; pinned by commit SHA)

- Two variants instead of three: `/m/<key>` (setup) and `/m/<key>/routine` (routine). `/full` and `/tasks` answer 410. Every variant says where its public text lives (`{PROMPTS_URL}`).
- The setup variant writes the first brief and creates one cloud routine named "Morda", every 15 minutes or as often as the account allows; it deletes a leftover "Morda tasks" routine. The routine variant never creates routines.
- Three reactions in the app: Done, Snooze (a week) and Reply. Work, Later and Dismiss are gone from the prompts. The routine reads `events` (done, undone, snoozed, unsnoozed, each with the item's kind) from `/v1/pending`, records them and acknowledges them with `/v1/events/ack`, then answers `pending` replies.
- Every brief section entry (CEO line, question, silent contact, options for the day, architect line) is an item in the app with the same three reactions; `_brief-spec.md`, `_send-spec.md` and `_state-rules.md` say so. `_state-rules.md` explains `snoozed` / `snoozed_until` and drops `later` and the `Q:` user task.

## v4.0.0 - 2026-09-15 (no tag; pinned by commit SHA)

- One link replaces the copy-paste setup: the Morda server serves `prompts/morda.md` at `/m/<key>` (setup), `/m/<key>/full` (routine with brief) and `/m/<key>/tasks` (routine without brief), with the key and the specs filled in. Claude Code gets one line from the app, the user presses send.
- `prompts/_brief-spec.md` is the v4 brief: CEO lens, tasks, feed, architect lens, three questions, options for the day, silent contacts over 7 days. Zero items are allowed; day one without connectors still posts a brief.
- `prompts/_send-spec.md` maps a brief you already write into the Morda shape; `prompts/_state-rules.md` explains done, later, dismissed, work, user tasks and notes.
- `CONTRIBUTING.md`, `prompts.test.mjs` and a GitHub Actions workflow running `node --test` on every push and pull request.
- The e2e prompts and `morda.mjs` are unchanged.

## v3.1.0 - 2026-09-12 (docs only, no tag)

- README gets a top section "Nothing to install: relay mode": Claude.ai, ChatGPT and Claude Code answer tasks through the connector with `get_pending` + `reply_task` on a routine that runs every 15 minutes if the assistant allows it, otherwise as often as it allows. Nothing runs on the user's computer; the prompts come from the app.
- The encrypted mode (this repo's script and prompts) is documented as the option below relay mode, for Claude Code only.
- The laptop `watch` is demoted to optional, for people who want answers within a minute while their laptop is open. The cloud routine is the normal path.
- `morda.mjs`, `prompts/*.md` and `spec/*.md` are unchanged; the pinned tag stays v3.0.1 and the sha256 `9f4d94736870b112838c83500cfd6ea1b8b570da01481f1bd0703e309cb86e16` still applies.

## v3.0.1 - 2026-09-12

- `prompts/routine-work.md` is a Claude Code cloud routine again (every 15 minutes, works with the laptop closed): each run installs the script if missing (pinned URL + sha256), writes `~/.morda/config.json` from the routine message if missing, answers what `pending` prints, stops when empty. The laptop `watch` stays the fast path.
- `pending` prints `after` per item; `reply --after <ms>` and `postReply(..., { after })` stamp the reply just past the request it answers, so a note typed while Claude was working stays pending. Reply ts is no longer the wall clock when there is something to answer.
- `watch` remembers what it handled in `~/.morda/watch-<box>.json` (`{id: after}`), so a restarted watcher never repeats a job; the 10-minute per-item backoff and the run timeout stay.
- A bare 404 or a 401 from the server is an error naming the URL (`box not found or wrong URL (404 <url>)`, `box not found or wrong secret (401 <url>)`) with exit 1; only the server's explicit "no blob yet" means an empty box.
- Setup prompts no longer forbid cloud routines; the existing-routine prompt leaves the user's routine where it runs.

## v3.0.0 - 2026-09-12

- First public release. Prompts and the client script moved out of the private server repo.
- `morda.mjs`: config from `MORDA_URL` / `MORDA_BOX` / `MORDA_SECRET` or `~/.morda/config.json`; no values are baked into the file any more.
- `morda.mjs`: work prompt embedded (`--prompt <path>` to override), `claude` taken from PATH (`--claude <path>` to override), watch loop survives network errors and backs off per failing item, replies capped at 4000 characters and 20 per item, reply timestamps ordered after the note they answer.
- Prompts install the script by URL pinned to this tag and verify its sha256 before use.
- The secret lives in `~/.morda/config.json` and in nothing the script writes.
