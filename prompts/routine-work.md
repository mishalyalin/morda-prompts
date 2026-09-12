# Morda task routine for Claude Code (v3.0.1)

You are running as a Claude Code scheduled cloud routine, every 15 minutes, to answer the tasks the user handed to you from the Morda app. The machine you run on has nothing from the user's laptop: maybe no script and no `~/.morda/config.json`. Every run does the three steps below, in order, and stops. Never print, quote or store the secret anywhere except `~/.morda/config.json`.

## Step 1 - install the script if it is missing

If `~/.morda/morda.mjs` does not exist, run:

```
mkdir -p ~/.morda && curl -fsSL https://raw.githubusercontent.com/mishalyalin/morda-prompts/v3.0.1/morda.mjs -o ~/.morda/morda.mjs && shasum -a 256 ~/.morda/morda.mjs
```

The first word of the output must be exactly `9f4d94736870b112838c83500cfd6ea1b8b570da01481f1bd0703e309cb86e16`; otherwise delete the file, say that the download did not match, and stop.

## Step 2 - write the config if it is missing

The routine message that carries this link also carries a box id and a secret. If `~/.morda/config.json` does not exist, write it exactly like this (server URL as shown), then restrict it:

```
{"url": "https://76-13-254-21.nip.io/brief", "box": "<box id>", "secret": "<secret>"}
```

```
chmod 600 ~/.morda/config.json
```

If the file already exists, leave it alone. Do not print the secret, do not put it in a reply, a log, a note or anywhere else. Reading the config file back is fine; quoting it is not.

## Step 3 - answer what is pending

Run `node ~/.morda/morda.mjs pending` (use `bun` if there is no `node`). It prints a JSON array of tasks the user handed to you from the app; each has `id`, `title`, `body`, `notes` (what the user wrote to you, newest last), `replies` (what you already answered, newest last) and `after` (a number: the moment of the request you are answering). If the array is empty, stop: there is nothing to do this run.

For each item: do the task if it can be done from here, otherwise say plainly what is needed. Answer in the language of the task, under 200 words, no preamble. Write the answer to a temp file `reply.txt` and run:

```
node ~/.morda/morda.mjs reply <id> --after <after> --file reply.txt
```

with that item's `id` and `after`, then delete `reply.txt`. The `--after` value keeps a note the user types while you are working from being counted as answered. Do not reply to an item that is not in the pending list. Never put secrets in a reply. When every item has a reply, stop.

Note for the user (say it once, when you set the routine up): while the laptop is open, `node ~/.morda/morda.mjs watch` on it answers within a minute using the `claude` command on PATH; this routine keeps answering every 15 minutes when the laptop is closed. If both happen to answer the same item at the same moment, the user sees two replies, which is harmless.
