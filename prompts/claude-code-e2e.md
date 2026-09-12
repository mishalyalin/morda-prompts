# Morda setup for Claude Code (v3.0.1)

You are setting up Morda for the user who pasted this link. Follow the steps in order. Do not skip the checksum. Do not widen the scope: no extra tools, no extra files, no changes elsewhere.

## Step 1 - install the script and verify it

Run:

```
mkdir -p ~/.morda && curl -fsSL https://raw.githubusercontent.com/mishalyalin/morda-prompts/v3.0.1/morda.mjs -o ~/.morda/morda.mjs && shasum -a 256 ~/.morda/morda.mjs
```

The first word of the output must be exactly:

```
9f4d94736870b112838c83500cfd6ea1b8b570da01481f1bd0703e309cb86e16
```

If it is anything else, delete `~/.morda/morda.mjs`, tell the user the download did not match, and stop here.

## Step 2 - write the config, never echo the secret

The user gave you a box id and a secret in the same message as this link. Write them to `~/.morda/config.json` exactly like this (server URL as shown), then restrict the file:

```
{"url": "https://76-13-254-21.nip.io/brief", "box": "<box id>", "secret": "<secret>"}
```

```
chmod 600 ~/.morda/config.json
```

Do not print the secret, do not put it in any other file, log, note, memory or scheduled task text. Reading the config file back is fine; quoting it is not.

## Step 3 - check the connection

Run `node ~/.morda/morda.mjs state` (use `bun` if there is no `node`). It prints `{}` on a fresh box, or JSON with what the user marked in the app. Any error means step 1 or 2 went wrong; fix that before continuing.

## Step 4 - send the first brief now

Run the brief prompt below once, right now, as your own task in this session. When the send command prints `sent brief seq=...`, tell the user the brief is in the app.

## Step 5 - make it daily

Create a Claude Code scheduled routine named `Morning brief` that runs every day at 07:00 in the user's time zone and whose task text is exactly the brief prompt below (between BEGIN PROMPT and END PROMPT, without those markers). The routine text must not contain the box id or the secret: the script reads them from `~/.morda/config.json`, so the routine runs where that file is. If the user wants a routine somewhere else (a cloud routine), do it the way `routine-work.md` does: its message carries the box id and secret lines and its first two steps install the script and write the config when they are missing.

Confirm to the user in one line: brief sent, daily task created, nothing else stored.

## The brief prompt

This is the prompt for the brief. It is what you run in step 4 and what the routine in step 5 runs every morning.

BEGIN PROMPT
You are my morning brief. First run `node ~/.morda/morda.mjs state` and read the JSON it prints.

The state is what I did in the app since your last brief. Its shape (v3):
{
  "v": 3,
  "seq": 12,
  "items": {
    "call-dentist": {"status": "done", "ts": 1757670000000, "seq": 11},
    "team-sync-0910": {"status": "dismissed", "ts": 1757670000000, "seq": 9},
    "renew-passport": {"status": "later", "ts": 1757670000000, "seq": 10, "later_until": "2026-09-13"},
    "u-3f8a9c2b1e4d5f60": {"status": "work", "ts": 1757670000000, "seq": 12, "title": "Find a vet for Saturday",
      "created_by": "user", "created_ts": 1757670000000, "notes": [{"ts": 1757670000000, "text": "prefers afternoon"}]}
  }
}
Rules:
- If "v" is missing, treat the state as v3 with defaults; the shape is the same either way.
- If "status" is missing, treat it as "open".
- If "status" is anything you do not recognize, treat it as "open".
- "done": do not list that task again. If it is genuinely still relevant, mention it in one feed line at most.
- "dismissed": never show that item again, under any id.
- "later": skip that task today unless today's date (in my local timezone) is on or after "later_until". Once it is due again, treat it like any open task.
- "work": this is a task I handed to you (or the app's own watcher) to work on directly, not a task for me. Carry it forward: keep tracking it, and if you already sent a reply for it in an earlier brief, do not repeat the same reply. If the item is not present in your own sources anymore, still keep it in the brief as a "task" (see the id rule below) so the thread stays intact.
- An item whose id starts with "u-" was created by me in the app, not by you. It has its own "title" (and no other source for that title). Echo it into the brief as a "task" item using the same id and that title, so your replies and my notes stay attached to it. Do this for every "u-..." item whose status is not "dismissed", even if you have nothing new to add.
- "notes" on an item are things I wrote to you about that task from the app (newest last). Read them as instructions or context for that specific task. There can be up to 50 of them; each is at most 2000 characters.
- Copy the state's "seq" into the brief as "acked_state_seq" so the app knows which of my marks you have seen.
- If the state is {} there is nothing to apply.

Now write:

TASKS: 3 to 10 short lines. Each one thing I should do today, written as a command ("Call the dentist", not "You should call the dentist").

FEED: 5 to 15 short lines about things that happened or are coming up (meetings, replies, deadlines, news I follow). Add a link when you have one.

IDS: every item gets a short stable id in lowercase-with-dashes. Stable means the same real thing gets the same id every day, so my done and dismissed marks stick. Build ids from the source when you can: an email thread -> "email-<thread id or first 8 chars of the message id>", a calendar event -> "cal-<event id>", anything else -> a slug of the task itself like "call-dentist". Never make the id from the date or from the wording of the title.

USER-CREATED TASKS: if the state (see the state rules above) has an item whose id starts with "u-", that task was typed by me in the app - you did not go looking for it yourself. Echo it into TASKS as a "task" item using that exact id and its "title" from the state, even if you have nothing to add about it - this is how it keeps showing up and how your replies stay attached to it.

REPLIES: an item can carry a "replies" array - things you (or the app's watcher) said back to me about that task. Each reply is {"ts": <ms since epoch>, "text": "<= 4000 chars"}, oldest first, newest last, at most 20 kept (drop the oldest ones past 20). Add a new reply only when you actually did work on that specific item and have something to tell me about it; otherwise leave "replies" out or unchanged. Never put a reply on an item you did not work on.

Write one sentence that sums up the whole day.

SCOPE: my calendar for today and tomorrow, my unread email from the last 24 hours, my calendar for the rest of this week, any email thread where someone is waiting on me, and whatever I asked you to track. Put anything with a deadline in the next 48 hours at the top of TASKS. If I have given you my own standing instructions (projects to watch, people to track, files to read), apply them too and fold the results into TASKS or FEED.

Never put passwords, card numbers, or other secrets in the brief.
If a tool you need is not working, say so in the one-sentence summary instead of guessing.

The brief must match this JSON shape:
{
  "generated_at": "ISO timestamp, e.g. 2026-09-10T07:00:00+01:00",
  "summary": "one sentence",
  "acked_state_seq": 0,
  "items": [
    {"id": "kebab-case-id", "kind": "task", "title": "...", "body": null, "url": null, "due": "YYYY-MM-DD or null", "priority": 1, "source": "calendar|email|note", "replies": []},
    {"id": "kebab-case-id", "kind": "feed", "title": "...", "body": null, "url": "https://... or null", "due": null, "priority": 3, "source": "calendar|email|news"}
  ]
}
("replies" is optional - only add it when the item actually has replies, per the REPLIES rule above.)

Example with 2 tasks, 2 feed items, and one user-created task with a reply:
{
  "generated_at": "2026-09-10T07:00:00+01:00",
  "summary": "Two meetings today, one client waiting on a reply, nothing urgent.",
  "acked_state_seq": 12,
  "items": [
    {"id": "call-dentist", "kind": "task", "title": "Call the dentist to confirm tomorrow's appointment", "due": "2026-09-10", "priority": 2, "source": "calendar"},
    {"id": "email-18f2b7d1", "kind": "task", "title": "Reply to Jane about the overdue invoice", "due": "2026-09-10", "priority": 1, "source": "email"},
    {"id": "cal-7k2m9q1p", "kind": "feed", "title": "10:00 team sync with Product", "body": "Weekly planning call", "url": "https://calendar.google.com/event?eid=abc123", "source": "calendar"},
    {"id": "email-18f3a9c2", "kind": "feed", "title": "Mike replied on the contract thread", "url": "https://mail.google.com/mail/u/0/#inbox/xyz", "source": "email"},
    {"id": "u-3f8a9c2b1e4d5f60", "kind": "task", "title": "Find a vet for Saturday", "priority": 2, "source": "note",
      "replies": [{"ts": 1757670000000, "text": "Found two vets near you open Saturday morning: Riverside Vets (0.4mi) and Park Clinic (1.1mi). Want me to book one?"}]}
  ]
}

Save the JSON as brief.json (in a temp directory) and run: node ~/.morda/morda.mjs send brief.json
Then delete brief.json. Report the one line the send command prints and nothing else.
END PROMPT
