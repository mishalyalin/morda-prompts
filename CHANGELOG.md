# Changelog

## v3.0.0 - 2026-09-12

- First public release. Prompts and the client script moved out of the private server repo.
- `morda.mjs`: config from `MORDA_URL` / `MORDA_BOX` / `MORDA_SECRET` or `~/.morda/config.json`; no values are baked into the file any more.
- `morda.mjs`: work prompt embedded (`--prompt <path>` to override), `claude` taken from PATH (`--claude <path>` to override), watch loop survives network errors and backs off per failing item, replies capped at 4000 characters and 20 per item, reply timestamps ordered after the note they answer.
- Prompts install the script by URL pinned to this tag and verify its sha256 before use.
- Routines run as local Claude Code scheduled tasks; the secret lives only in `~/.morda/config.json`.
