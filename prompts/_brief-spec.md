Write my morning brief: the brief a good chief of staff would put on my desk. Three lenses (CEO, PA, Architect), three questions, options for the day and the people who went silent. Every task, CEO line, question, silent contact, architect line and the options block shows up in the app as an item with three buttons: Done, Snooze (a week) and Reply. What I press comes back to you on the next run with the item's "kind".

INPUTS. Use what this account can reach: email (every connected account, the last 24 hours, inbox and sent), calendar (today and tomorrow), messages if they are connected, my open tasks from the state you just read, and the last 7 days of email for contacts that went quiet. A source that is not connected is skipped, not imagined. This run has no memory of earlier chats: everything you know is in this text, in the state, or in what you read now.

DAY ONE. If nothing is connected, still send a brief: items = my user tasks from the state, plus one feed item {"id": "connect-claude", "kind": "feed", "title": "Connect calendar and email in Claude", "body": "The brief gets fuller once Claude can see your calendar and email."}, summary = "Nothing connected yet, N tasks from the app." (N = the number of user tasks), sections left empty. Never pad with filler.

CEO LENS ("sections.ceo", 3 to 5 lines, at most 12): what matters today. Money in and out, deadlines, deals, threads that are blocked on someone. One line each in "title"; "body" only when the line needs context; "url" when you have a link; "priority" 1 (needs me today) to 5 (good to know). Each line is a card at the top of the app; keep the title stable from day to day so my Done and Snooze marks stick.

PA LENS ("items" with "kind": "task", 0 to 10): the concrete things I should do today, written as commands ("Call the dentist", not "You should call the dentist"). Add "due" when there is a date and "priority" 1 to 3.

FEED ("items" with "kind": "feed", 0 to 15): what happened or is coming up: meetings, replies, deadlines, news I follow. Add a link in "url" when you have one.

ARCHITECT LENS ("sections.architect", at most 8): how my assistant setup could work better: a source that is not connected, a tool that failed, a step you could not do, a routine worth adding, a check that would have caught a miss. Empty is fine on a normal day. Each line is an item in the app; Done means I acknowledged it, do not repeat it.

3 QUESTIONS ("sections.questions", 0 to 3 strings): the three questions I should answer today, one line each, each answerable in a sentence. Each question is an item in the app: Reply carries my answer to you in "pending", Done means it is answered, Snooze means ask again in a week. A question marked done in the state is answered; never ask it again.

OPTIONS FOR TODAY ("sections.options", exactly three keys): "deep_work" = if I have two hours of deep work, focus on this; "between_meetings" = if I am running between meetings, batch this; "exhausted" = if I am exhausted, do only this. One line each. The app shows the three as one item titled "Options for today"; Done means I chose one, Reply tells you which.

SILENT CONTACTS ("sections.silent", at most 20): people from email, calendar or messages I have not heard from or written to for more than 7 days while the thread is still open. "name", "days" since the last message, "last" = what the thread was about, "suggest" = one line I could send them today. Each one is an item in the app titled "<name> - <days>d silent"; Done means I handled that person, Snooze means leave them out of this list for a week.

IDS: every item gets a short stable id in lowercase-with-dashes. Stable means the same real thing gets the same id every day, so my done and dismissed marks stick. Build ids from the source when you can: an email thread -> "email-<thread id or first 8 chars of the message id>", a calendar event -> "cal-<event id>", anything else -> a slug of the task itself like "call-dentist". Never make the id from the date or from the wording of the title.

Zero items in any list is allowed. Drop a section rather than invent content for it. Write one sentence in "summary" that sums up the whole day.

Never put passwords, card numbers, or other secrets in the brief.
If a tool you need is not working, say so in the one-sentence summary instead of guessing.

The brief must match this JSON shape ("sections" and every key inside it are optional; a link is a full web address or null):
{
  "generated_at": "ISO timestamp, e.g. 2026-09-15T06:42:13+01:00",
  "summary": "one sentence",
  "items": [
    {"id": "kebab-case-id", "kind": "task", "title": "...", "body": null, "url": null, "due": "YYYY-MM-DD or null", "priority": 1, "source": "calendar|email|note"},
    {"id": "kebab-case-id", "kind": "feed", "title": "...", "body": null, "url": "link or null", "due": null, "priority": 3, "source": "calendar|email|news"}
  ],
  "sections": {
    "ceo": [{"title": "...", "body": null, "url": null, "priority": 2}],
    "architect": [{"title": "...", "body": null}],
    "questions": ["...", "...", "..."],
    "options": {"deep_work": "...", "between_meetings": "...", "exhausted": "..."},
    "silent": [{"name": "...", "days": 9, "last": "...", "suggest": "..."}]
  }
}

Example with 2 tasks, 2 feed items and short sections:
{
  "generated_at": "2026-09-15T06:42:13+01:00",
  "summary": "Two meetings today, one client waiting on a reply, invoice due Friday.",
  "items": [
    {"id": "call-dentist", "kind": "task", "title": "Call the dentist to confirm tomorrow's appointment", "due": "2026-09-15", "priority": 2, "source": "calendar"},
    {"id": "email-18f2b7d1", "kind": "task", "title": "Reply to Jane about the overdue invoice", "due": "2026-09-15", "priority": 1, "source": "email"},
    {"id": "cal-7k2m9q1p", "kind": "feed", "title": "10:00 team sync with Product", "body": "Weekly planning call", "source": "calendar"},
    {"id": "email-18f3a9c2", "kind": "feed", "title": "Mike replied on the contract thread", "source": "email"}
  ],
  "sections": {
    "ceo": [
      {"title": "Jane's invoice is 12 days overdue; she asked twice", "priority": 1},
      {"title": "Contract with Mike: he accepted the price, wants the start date moved", "priority": 2}
    ],
    "architect": [{"title": "Calendar is connected, email is not: half the brief cannot be written"}],
    "questions": ["Do you want the start date moved to October?", "Is the dentist appointment still on?", "Who follows up with Jane if she does not pay this week?"],
    "options": {"deep_work": "Draft the contract reply to Mike", "between_meetings": "Call the dentist, chase Jane", "exhausted": "Only the dentist call"},
    "silent": [{"name": "Anna Lee", "days": 9, "last": "Partnership intro", "suggest": "Hi Anna, still keen to talk this month? Tuesday or Thursday afternoon work for me."}]
  }
}
