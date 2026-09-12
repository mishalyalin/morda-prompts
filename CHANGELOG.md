# Changelog

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
