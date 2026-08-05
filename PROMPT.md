# Daily update instructions (used verbatim as the scheduled cloud agent's prompt)

You are running a scheduled daily update for the ZSK Festivals Tracker repo you've just been
checked out into. You start with zero prior context — everything you need is in this repo.

## Goal

Re-check the application deadline for each festival in `config/festivals.json`, update
`data/festivals.json` if anything changed, regenerate the dashboard, and push.

## Steps

1. Read `config/festivals.json` — it lists each festival's `id`, `name`, and `url`.
2. Read `data/festivals.json` — it holds the current known state per festival (previous
   `deadline_date`, `status`, `history`, etc). Today's date is whatever `date -u` reports.
3. For each festival, fetch its `url` (use WebFetch) and look for an entry/application/submission
   deadline. Check for phrasing like: "rok za", "krajnji rok", "prijave do", "zatvaranje
   prijava", "konkurs", "entry deadline", "deadline", "call for entries", "submissions close".
   The pages are a mix of Serbian and English and are NOT uniformly structured — read for meaning,
   don't pattern-match rigidly. If the given URL doesn't have it but clearly links to a more
   specific page (e.g. a dedicated "2026" or "prijave" subpage), follow that link once.
4. Normalize whatever date you find to ISO 8601 (`YYYY-MM-DD`). If a date has no explicit year,
   infer it from context (page title, nearby text, or "the next occurrence of that date").
5. Decide the new `status`:
   - `"open"` — a deadline is known and it's in the future.
   - `"closed"` — a deadline is known and it's in the past, OR the previously-stored deadline was
     in the past and no newer date was published yet. Do not invent a next-year guess.
   - `"tba"` — no deadline could be found on the site at all.
6. Compare the new `deadline_date` (and `status`) against what's stored:
   - If it changed, append a new entry to that festival's `history` array
     (`{"checked": "<today>", "deadline_date": "<new or null>", "note": "<what changed>"}`) and
     set `last_changed` to today.
   - Always set `last_checked` to today, regardless of whether anything changed.
   - Update `deadline_raw` and `notes` to reflect what you actually read on the page today.
7. If a fetch fails (timeout, connection error, blocked, etc.), do NOT wipe existing data — leave
   the previous `deadline_date`/`status` as-is, just set `last_error` to a short description and
   `last_checked` to today. Try at most one retry per festival before giving up for the day.
8. After updating `data/festivals.json`, run `node scripts/build-dashboard.js` to regenerate
   `docs/index.html`.
9. Check `git status`. If anything changed, `git add -A`, commit with message
   `Daily update <YYYY-MM-DD>`, and push to the default branch. If nothing changed at all
   (identical data and no new errors), you can skip the commit.
10. Report a short summary: which festivals changed, which are newly closing within 7 days, and
    which fetches failed.

## Ground rules

- Never delete a festival from `config/festivals.json` or `data/festivals.json`.
- Never fabricate a deadline you didn't actually read on the page (or a linked subpage). "tba" is
  a perfectly fine outcome.
- Keep `docs/index.html` in sync with `data/festivals.json` — always regenerate it via the build
  script, don't hand-edit it.
