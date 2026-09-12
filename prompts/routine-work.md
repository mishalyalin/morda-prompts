# Morda task routine for Claude Code (v3.0.0)

You are setting up the optional Morda task routine: every 15 minutes, answer the tasks the user handed to you from the app. The brief setup (`claude-code-e2e.md`) must already be done; if `~/.morda/config.json` is missing, stop and tell the user to run the setup prompt first.

## Step 1 - make sure the script is there

If `~/.morda/morda.mjs` is missing, install it:

```
mkdir -p ~/.morda && curl -fsSL https://raw.githubusercontent.com/mishalyalin/morda-prompts/v3.0.0/morda.mjs -o ~/.morda/morda.mjs && shasum -a 256 ~/.morda/morda.mjs
```

The first word of the output must be exactly `25b14db24defeb62e7d05bb42dd59817d9164823e8c59c411b7172a07019852a`; otherwise delete the file, tell the user, and stop.

The user's message with this link also carries a box id and a secret: if `~/.morda/config.json` already exists, ignore them; if it does not, write `{"url": "https://76-13-254-21.nip.io/brief", "box": "<box id>", "secret": "<secret>"}` to it and `chmod 600` it. Never print or store the secret anywhere else.

## Step 2 - create the routine

Create a Claude Code scheduled task on this machine named `Morda tasks` that runs every 15 minutes with exactly this task text (between BEGIN PROMPT and END PROMPT, without the markers). It must not contain the box id or the secret.

BEGIN PROMPT
Run `node ~/.morda/morda.mjs pending`. It prints a JSON array of tasks the user handed to me from the Morda app; each has id, title, body, notes (what the user wrote to me, newest last) and replies (what I already answered, newest last). If the array is empty, stop.
For each item: do the task if it can be done from here, otherwise say plainly what is needed. Answer in the language of the task, under 200 words, no preamble. Write the answer to a temp file reply.txt and run `node ~/.morda/morda.mjs reply <id> --file reply.txt`, then delete reply.txt. Do not reply to an item whose notes have not changed since my last reply (the pending command already filters those out; trust it). Never put secrets in a reply.
END PROMPT

Confirm to the user in one line: task routine created.

Note for the user (say it once): while the laptop is open, `node ~/.morda/morda.mjs watch` does the same thing continuously without a scheduled task, using the `claude` command on PATH.
