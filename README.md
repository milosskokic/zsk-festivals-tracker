# ZSK Festivals Tracker

A small dashboard tracking application deadlines for regional advertising festivals and awards
(AcademIAA, Golden Drum, Kaktus, SoMo Borac, UEPS, BalCannes, Effie Srbija, Young Lions Srbija,
Disrupt Awards, MIXX Awards, and more).

Live site: served from `docs/index.html` via GitHub Pages (Settings → Pages → Deploy from
branch → `main` / `/docs`).

## How it works

- `config/festivals.json` — the static list of festivals and their source URLs. Add/remove
  festivals here.
- `data/festivals.json` — the current known deadline state per festival, plus a `history` log of
  every change ever detected. This is the source of truth the dashboard is built from.
- `scripts/build-dashboard.js` — plain Node (no dependencies) script that reads
  `data/festivals.json` and generates `docs/index.html`.
- `docs/index.html` — the generated dashboard. Don't hand-edit; regenerate it instead.
- `PROMPT.md` — the exact instructions given to the daily scheduled cloud agent that re-checks
  every site, updates `data/festivals.json`, rebuilds the dashboard, and pushes.

## Running an update manually

```bash
node scripts/build-dashboard.js
```

This only regenerates the HTML from whatever is currently in `data/festivals.json` — it doesn't
re-check the websites. Re-checking the websites requires an LLM agent (the sites use inconsistent,
mixed-language phrasing that plain scraping can't reliably parse) — either run the prompt in
`PROMPT.md` yourself in Claude Code, or trigger the scheduled routine manually via
`https://claude.ai/code/routines`.

## Adding a festival

1. Add an entry to `config/festivals.json` (id, name, category, url).
2. Add a matching entry to `data/festivals.json` with `deadline_date: null`, `status: "tba"`, and
   an empty-ish `history` array — the next scheduled run will fill it in.
3. Run `node scripts/build-dashboard.js` to confirm it renders.
