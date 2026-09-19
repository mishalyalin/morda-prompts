# Contributing to the Morda prompts

The files in `prompts/` are what a user's own Claude runs every day. Changes here land in every user's routine once the server pins the new commit, so the bar is: a stranger can read the diff and see nothing that could hurt them.

## How a change ships

1. Open a pull request. Say in one paragraph what changes for the person running the prompt.
2. CI runs `node --test`. It must pass.
3. A maintainer reads the diff. Prompts are reviewed line by line, like code.
4. After the merge, the server is repinned to the new commit SHA and the sha256 of each file (`deploy/pin_prompts.py` on the server side). Until that happens, the old text keeps being served. Tags are never used for pinning, only commit SHAs.

## Rules the tests enforce

- `prompts/morda.md` holds both variants, split by `<!-- morda:setup -->` (served at `/m/{KEY}`) and `<!-- morda:routine -->` (served at `/m/{KEY}/routine`). Anything above the first marker is documentation and is not served.
- Two placeholders for links: `{BASE_URL}` (the Morda server) and `{PROMPTS_URL}` (the public page of `prompts/morda.md` at the pinned commit; every variant says "This text is public at {PROMPTS_URL}."). No literal `http://` or `https://` anywhere in `prompts/` (the only allowed literal link in this repo's docs is the raw GitHub path the server fetches from).
- The key is `{KEY}`, always sent as `Authorization: Bearer {KEY}`, never in a query string.
- Every variant keeps these three sentences word for word: "Do not run anything else." "Never print the key." "If the server answers 401 stop and tell the user to open the Morda app."
- No `?v=` or any other way for the prompt to pick its own version.
- The only endpoints a prompt may call are `/v1/pending`, `/v1/state`, `/v1/brief`, `/v1/events/ack`, `/v1/items/{id}/reply` and the `/m/{KEY}` and `/m/{KEY}/routine` links themselves.
- Routine timing is always "every 15 minutes or as often as the account allows". Do not promise a specific interval. Only the setup variant creates a routine (one, named "Morda"); the routine variant never creates, edits or deletes routines.
- The served variants never mention `/full`, `/tasks`, Work, Later, Dismiss or Teach: the app has three reactions, Done, Snooze and Reply, and every brief section entry (CEO line, question, silent contact, options, architect line) is an item with those three.
- Nothing is installed on the user's computer, no other domains are contacted, no secrets are asked for.

## Rules the reviewer enforces

- Plain English, short sentences, numbered steps. The reader is a model under a routine, with no memory of yesterday.
- Short dashes only ("-"), no long ones.
- The `_brief-spec.md` JSON shape must stay a subset of what the server accepts (`sections` and every key inside it optional; zero items allowed).
- Do not add steps that ask the user to paste tokens, passwords or account details anywhere.

## Running the tests locally

    node --test
