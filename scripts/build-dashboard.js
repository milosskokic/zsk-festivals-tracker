#!/usr/bin/env node
// Reads data/festivals.json and writes docs/index.html. Zero npm dependencies.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'festivals.json');
const OUT_PATH = path.join(ROOT, 'docs', 'index.html');

const { festivals } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const now = new Date();
const todayISO = now.toISOString().slice(0, 10);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T23:59:59Z');
  const diffMs = target - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function computeUrgency(f) {
  if (f.status === 'closed') return 'closed';
  if (!f.deadline_date) return 'tba';
  const days = daysUntil(f.deadline_date);
  if (days < 0) return 'closed';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'open';
}

const enriched = festivals.map(f => ({ ...f, urgency: computeUrgency(f), days: daysUntil(f.deadline_date) }));

const order = { urgent: 0, soon: 1, open: 2, tba: 3, closed: 4 };
enriched.sort((a, b) => {
  const oa = order[a.urgency];
  const ob = order[b.urgency];
  if (oa !== ob) return oa - ob;
  if (a.deadline_date && b.deadline_date) return a.deadline_date.localeCompare(b.deadline_date);
  if (a.deadline_date) return -1;
  if (b.deadline_date) return 1;
  return a.name.localeCompare(b.name);
});

const urgencyLabel = {
  urgent: 'Final days',
  soon: 'Closing soon',
  open: 'Open',
  tba: 'TBA',
  closed: 'Closed',
};

function wasCheckedToday(f) {
  return f.last_checked === todayISO;
}

function wasChangedToday(f) {
  return f.last_changed === todayISO;
}

function daysLabel(days) {
  if (days == null) return '';
  if (days < 0) return `Closed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

const cards = enriched.map(f => {
  const changedBadge = wasChangedToday(f) && f.history.length > 1
    ? `<span class="badge badge-changed">Updated today</span>`
    : '';
  const errorBadge = f.last_error
    ? `<span class="badge badge-error" title="${escapeHtml(f.last_error)}">Check failed</span>`
    : '';
  return `
    <a class="card urgency-${f.urgency}" href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer">
      <div class="card-top">
        <h2>${escapeHtml(f.name)}</h2>
        <span class="pill pill-${f.urgency}">${urgencyLabel[f.urgency]}</span>
      </div>
      <div class="deadline-date">${formatDate(f.deadline_date)}</div>
      <div class="days-left">${daysLabel(f.days)}</div>
      ${f.category ? `<div class="category">${escapeHtml(f.category)}</div>` : ''}
      ${f.notes ? `<div class="notes">${escapeHtml(f.notes)}</div>` : ''}
      <div class="card-footer">
        <span class="checked">Last checked: ${f.last_checked}</span>
        ${changedBadge}${errorBadge}
      </div>
    </a>`;
}).join('\n');

const lastUpdated = enriched.reduce((max, f) => (f.last_checked > max ? f.last_checked : max), '');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZSK Festivals Tracker</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f5f5f7;
    --surface: #ffffff;
    --text: #1a1a1e;
    --muted: #6b6b75;
    --border: #e3e3e8;
    --urgent: #d64545;
    --soon: #c98a1f;
    --open-color: #2f9e58;
    --tba: #7a7a85;
    --closed: #a3a3ab;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16161a;
      --surface: #202024;
      --text: #ececef;
      --muted: #9d9da8;
      --border: #2e2e34;
      --urgent: #ff6b6b;
      --soon: #f0b429;
      --open-color: #4bcf7f;
      --tba: #9d9da8;
      --closed: #6b6b75;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 2rem 1.25rem 4rem;
  }
  header {
    max-width: 1100px;
    margin: 0 auto 2rem;
  }
  h1 {
    font-size: 1.75rem;
    margin: 0 0 0.25rem;
  }
  .subtitle {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .grid {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .card {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.1rem 1.2rem;
    text-decoration: none;
    color: var(--text);
    border-left: 5px solid var(--closed);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  }
  .card.urgency-urgent { border-left-color: var(--urgent); }
  .card.urgency-soon { border-left-color: var(--soon); }
  .card.urgency-open { border-left-color: var(--open-color); }
  .card.urgency-tba { border-left-color: var(--tba); }
  .card.urgency-closed { border-left-color: var(--closed); opacity: 0.65; }
  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .card-top h2 {
    font-size: 1.05rem;
    margin: 0;
    line-height: 1.3;
  }
  .pill {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .pill-urgent { background: color-mix(in srgb, var(--urgent) 18%, transparent); color: var(--urgent); }
  .pill-soon { background: color-mix(in srgb, var(--soon) 18%, transparent); color: var(--soon); }
  .pill-open { background: color-mix(in srgb, var(--open-color) 18%, transparent); color: var(--open-color); }
  .pill-tba { background: color-mix(in srgb, var(--tba) 18%, transparent); color: var(--tba); }
  .pill-closed { background: color-mix(in srgb, var(--closed) 18%, transparent); color: var(--closed); }
  .deadline-date {
    font-size: 1.15rem;
    font-weight: 600;
    margin-top: 0.7rem;
  }
  .days-left {
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: 0.15rem;
  }
  .category {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 0.6rem;
  }
  .notes {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.5rem;
    line-height: 1.4;
  }
  .card-footer {
    margin-top: 0.9rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .badge {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }
  .badge-changed { background: color-mix(in srgb, var(--open-color) 20%, transparent); color: var(--open-color); }
  .badge-error { background: color-mix(in srgb, var(--urgent) 20%, transparent); color: var(--urgent); }
  footer {
    max-width: 1100px;
    margin: 2.5rem auto 0;
    color: var(--muted);
    font-size: 0.8rem;
    text-align: center;
  }
</style>
</head>
<body>
<header>
  <h1>ZSK Festivals Tracker</h1>
  <div class="subtitle">Advertising festival &amp; competition deadlines — last updated ${lastUpdated}</div>
</header>
<div class="grid">
${cards}
</div>
<footer>Generated automatically. Deadlines are extracted from each organizer's public site and may change without notice — click through to confirm before submitting.</footer>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, html);
console.log(`Wrote ${OUT_PATH}`);
