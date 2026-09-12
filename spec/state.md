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
