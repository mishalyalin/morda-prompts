# Changelog

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
