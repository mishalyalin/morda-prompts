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
