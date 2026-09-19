Send it in this exact JSON shape (map whatever my brief already contains: tasks are things I should do, feed is everything else; a "what matters" or CEO section goes into "sections.ceo", setup suggestions into "sections.architect", open questions into "sections.questions", options for the day into "sections.options", silent contacts into "sections.silent"; every section entry becomes an item in the app with Done, Snooze and Reply, so keep titles stable from day to day; leave out any section my brief does not have; give every item a short stable id in lowercase-with-dashes and reuse the same id for the same item on later days so it is not shown twice; a link is a full web address or null; never include passwords or secrets):
{
  "generated_at": "ISO timestamp, e.g. 2026-09-15T06:42:13+01:00",
  "summary": "one sentence that sums up the day",
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
