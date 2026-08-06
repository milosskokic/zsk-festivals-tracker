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

function formatDateShort(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
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

enriched.sort((a, b) => {
  if (a.deadline_date && b.deadline_date) return a.deadline_date.localeCompare(b.deadline_date);
  if (a.deadline_date) return -1;
  if (b.deadline_date) return 1;
  return a.name.localeCompare(b.name);
});

const SECTIONS = [
  { key: 'urgent', label: 'Final days', hint: '7 days or less' },
  { key: 'soon', label: 'Closing soon', hint: 'within 30 days' },
  { key: 'open', label: 'Open', hint: 'more than 30 days left' },
  { key: 'tba', label: 'TBA', hint: 'deadline not yet published' },
  { key: 'closed', label: 'Closed', hint: 'past deadline' },
];

function daysLabel(days) {
  if (days == null) return '';
  if (days < 0) return `Closed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function wasChangedToday(f) {
  return f.last_changed === todayISO;
}

function card(f) {
  const changedBadge = wasChangedToday(f) && f.history && f.history.length > 1
    ? `<span class="badge badge-changed">Updated today</span>`
    : '';
  const errorBadge = f.last_error
    ? `<span class="badge badge-error" title="${escapeHtml(f.last_error)}">Check failed</span>`
    : '';
  return `
    <a class="card urgency-${f.urgency}" href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer"
       data-name="${escapeHtml((f.name + ' ' + (f.category || '')).toLowerCase())}" data-urgency="${f.urgency}">
      <div class="card-top">
        <h3>${escapeHtml(f.name)}</h3>
        ${f.category ? `<span class="category">${escapeHtml(f.category)}</span>` : ''}
      </div>
      <div class="deadline-row">
        <span class="deadline-date">${formatDate(f.deadline_date)}</span>
        <span class="days-left days-${f.urgency}">${daysLabel(f.days)}</span>
      </div>
      ${f.notes ? `<div class="notes">${escapeHtml(f.notes)}</div>` : ''}
      <div class="card-footer">
        <span class="checked">Checked ${f.last_checked}</span>
        ${changedBadge}${errorBadge}
      </div>
    </a>`;
}

const counts = Object.fromEntries(SECTIONS.map(s => [s.key, enriched.filter(f => f.urgency === s.key).length]));

const statBar = SECTIONS.filter(s => counts[s.key] > 0).map(s => `
    <button type="button" class="stat-chip stat-${s.key}" data-filter="${s.key}">
      <span class="stat-count">${counts[s.key]}</span>
      <span class="stat-label">${s.label}</span>
    </button>`).join('\n');

const sectionsHtml = SECTIONS.filter(s => counts[s.key] > 0).map(s => `
  <section class="section" data-section="${s.key}">
    <div class="section-head">
      <h2>${s.label}</h2>
      <span class="section-hint">${s.hint}</span>
    </div>
    <div class="grid">
      ${enriched.filter(f => f.urgency === s.key).map(card).join('\n')}
    </div>
  </section>`).join('\n');

const lastUpdated = enriched.reduce((max, f) => (f.last_checked > max ? f.last_checked : max), '');

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%23202024"/><text x="50" y="66" font-size="58" text-anchor="middle" fill="%234bcf7f" font-family="Arial, sans-serif" font-weight="700">Z</text></svg>'
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZSK Festivals Tracker</title>
<link rel="icon" href="${FAVICON}">
<style>
  :root {
    color-scheme: light dark;
    --bg: #f4f4f7;
    --surface: #ffffff;
    --surface-hover: #fbfbfd;
    --text: #17171b;
    --muted: #6b6b75;
    --border: #e6e6ec;
    --accent: #4a4af0;
    --urgent: #d64545;
    --soon: #c98a1f;
    --open-color: #2f9e58;
    --tba: #7a7a85;
    --closed: #a3a3ab;
    --shadow: 0 1px 2px rgba(20,20,30,0.04), 0 8px 20px rgba(20,20,30,0.03);
    --shadow-hover: 0 4px 10px rgba(20,20,30,0.06), 0 16px 32px rgba(20,20,30,0.07);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131316;
      --surface: #1c1c20;
      --surface-hover: #212126;
      --text: #edeef0;
      --muted: #9b9ba5;
      --border: #2b2b31;
      --accent: #8f8fff;
      --urgent: #ff6b6b;
      --soon: #f0b429;
      --open-color: #4bcf7f;
      --tba: #9b9ba5;
      --closed: #6b6b75;
      --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.25);
      --shadow-hover: 0 4px 12px rgba(0,0,0,0.35), 0 20px 40px rgba(0,0,0,0.35);
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 0 1.25rem 4rem;
  }
  .wrap { max-width: 1120px; margin: 0 auto; }
  header {
    padding: 2.5rem 0 1.5rem;
  }
  h1 {
    font-size: 1.85rem;
    margin: 0 0 0.3rem;
    letter-spacing: -0.02em;
  }
  .subtitle {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.4rem;
  }
  .search-input {
    flex: 1 1 220px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.55rem 0.8rem;
    font-size: 0.9rem;
    color: var(--text);
    outline: none;
  }
  .search-input:focus {
    border-color: var(--accent);
  }
  .stat-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    color: var(--muted);
    cursor: pointer;
    font-family: inherit;
    transition: transform 0.1s ease, box-shadow 0.15s ease;
  }
  .stat-chip:hover { box-shadow: var(--shadow); }
  .stat-chip.active {
    border-color: currentColor;
  }
  .stat-chip .stat-count {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text);
  }
  .stat-urgent .stat-count { color: var(--urgent); }
  .stat-soon .stat-count { color: var(--soon); }
  .stat-open .stat-count { color: var(--open-color); }
  .stat-tba .stat-count { color: var(--tba); }
  .stat-closed .stat-count { color: var(--closed); }

  .section { margin-top: 2.2rem; }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin-bottom: 0.9rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .section-head h2 {
    font-size: 1.05rem;
    margin: 0;
  }
  .section-hint {
    color: var(--muted);
    font-size: 0.78rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 0.9rem;
  }
  .card {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.05rem 1.15rem;
    text-decoration: none;
    color: var(--text);
    border-left: 4px solid var(--closed);
    box-shadow: var(--shadow);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hover);
    background: var(--surface-hover);
  }
  .card.urgency-urgent { border-left-color: var(--urgent); }
  .card.urgency-soon { border-left-color: var(--soon); }
  .card.urgency-open { border-left-color: var(--open-color); }
  .card.urgency-tba { border-left-color: var(--tba); }
  .card.urgency-closed { border-left-color: var(--closed); opacity: 0.6; }
  .card-top {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .card-top h3 {
    font-size: 1.02rem;
    margin: 0;
    line-height: 1.3;
  }
  .category {
    font-size: 0.74rem;
    color: var(--muted);
  }
  .deadline-row {
    margin-top: 0.75rem;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .deadline-date {
    font-size: 1.05rem;
    font-weight: 600;
  }
  .days-left {
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .days-urgent { color: var(--urgent); }
  .days-soon { color: var(--soon); }
  .days-open { color: var(--open-color); }
  .days-tba, .days-closed { color: var(--muted); }
  .notes {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.55rem;
    line-height: 1.45;
  }
  .card-footer {
    margin-top: 0.85rem;
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
  .empty-state {
    text-align: center;
    color: var(--muted);
    padding: 3rem 0;
    font-size: 0.9rem;
    display: none;
  }
  footer {
    margin: 3rem auto 0;
    color: var(--muted);
    font-size: 0.8rem;
    text-align: center;
  }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>ZSK Festivals Tracker</h1>
  <div class="subtitle">Advertising festival &amp; competition deadlines — last updated ${lastUpdated}</div>
  <div class="controls">
    <input class="search-input" type="text" id="search" placeholder="Filter by name or category…">
    ${statBar}
  </div>
</header>

${sectionsHtml}

<div class="empty-state" id="empty-state">No festivals match your filter.</div>

</div>
<footer>Generated automatically. Deadlines are extracted from each organizer's public site and may change without notice — click through to confirm before submitting.</footer>
<script>
(function () {
  var search = document.getElementById('search');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.stat-chip'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));
  var emptyState = document.getElementById('empty-state');
  var activeFilter = null;

  function apply() {
    var q = search.value.trim().toLowerCase();
    var anyVisible = false;
    cards.forEach(function (c) {
      var matchesText = !q || c.dataset.name.indexOf(q) !== -1;
      var matchesFilter = !activeFilter || c.dataset.urgency === activeFilter;
      var show = matchesText && matchesFilter;
      c.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    sections.forEach(function (s) {
      var visibleCards = s.querySelectorAll('.card').length && Array.prototype.slice.call(s.querySelectorAll('.card')).some(function (c) { return c.style.display !== 'none'; });
      s.style.display = visibleCards ? '' : 'none';
    });
    emptyState.style.display = anyVisible ? 'none' : 'block';
  }

  search.addEventListener('input', apply);
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = chip.dataset.filter;
      activeFilter = activeFilter === key ? null : key;
      chips.forEach(function (c) { c.classList.toggle('active', c.dataset.filter === activeFilter); });
      apply();
    });
  });
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, html);
console.log(`Wrote ${OUT_PATH}`);
