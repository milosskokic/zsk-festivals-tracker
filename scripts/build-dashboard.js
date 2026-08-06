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

enriched.sort((a, b) => {
  if (a.deadline_date && b.deadline_date) return a.deadline_date.localeCompare(b.deadline_date);
  if (a.deadline_date) return -1;
  if (b.deadline_date) return 1;
  return a.name.localeCompare(b.name);
});

const SECTIONS = [
  { key: 'urgent', label: 'final days', hint: '7 days or less' },
  { key: 'soon', label: 'closing soon', hint: 'within 30 days' },
  { key: 'open', label: 'open', hint: 'more than 30 days left' },
  { key: 'tba', label: 'tba', hint: 'deadline not yet published' },
  { key: 'closed', label: 'closed', hint: 'past deadline' },
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
    ? `<span class="badge badge-changed">updated today</span>`
    : '';
  const errorBadge = f.last_error
    ? `<span class="badge badge-error" title="${escapeHtml(f.last_error)}">check failed</span>`
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
        <span class="checked">checked ${f.last_checked}</span>
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
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23ffffff" stroke="%231d1d1e" stroke-width="4"/><text x="50" y="68" font-size="52" text-anchor="middle" fill="%23fe153f" font-family="Arial, sans-serif" font-weight="800">ż</text></svg>'
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>żiśka — festivals tracker</title>
<link rel="icon" href="${FAVICON}">
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-hover: #fafafa;
    --text: #1d1d1e;
    --muted: #74747c;
    --faint: #a9a9b1;
    --border: #e7e7ea;
    --border-strong: #1d1d1e;
    --brand: #fe153f;
    --urgent: #e0293f;
    --soon: #d6820b;
    --open-color: #1f9254;
    --tba: #9a9aa3;
    --closed: #b6b6bd;
    --shadow: 0 1px 2px rgba(20,20,30,0.03);
    --shadow-hover: 0 10px 24px rgba(20,20,30,0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131316;
      --surface: #1a1a1d;
      --surface-hover: #202024;
      --text: #f2f2f3;
      --muted: #a3a3ac;
      --faint: #6b6b75;
      --border: #2c2c30;
      --border-strong: #f2f2f3;
      --brand: #ff4d6d;
      --urgent: #ff5c72;
      --soon: #f0a93a;
      --open-color: #3fcf80;
      --tba: #8a8a94;
      --closed: #55555c;
      --shadow: 0 1px 2px rgba(0,0,0,0.3);
      --shadow-hover: 0 12px 28px rgba(0,0,0,0.4);
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: helvetica-neue-lt-pro, "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem 4rem; }

  header.top {
    border-bottom: 2px solid var(--border-strong);
    padding: 1.6rem 0;
    margin-bottom: 0.5rem;
  }
  .top-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }
  .wordmark {
    font-size: 2.1rem;
    font-weight: 800;
    color: var(--brand);
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  .wordmark span { color: var(--text); }
  .tagline {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text);
    text-transform: lowercase;
  }
  .subtitle {
    color: var(--muted);
    font-size: 0.85rem;
    max-width: 1120px;
    margin: 0.9rem auto 0;
    padding: 0 1.5rem;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.6rem;
  }
  .search-input {
    flex: 1 1 220px;
    background: var(--surface);
    border: 2px solid var(--border-strong);
    border-radius: 0;
    padding: 0.6rem 0.85rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
    outline: none;
  }
  .search-input::placeholder { color: var(--faint); font-weight: 500; }
  .search-input:focus { border-color: var(--brand); }

  .stat-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    background: var(--surface);
    border: 2px solid var(--border-strong);
    border-radius: 0;
    padding: 0.42rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text);
    cursor: pointer;
    font-family: inherit;
    text-transform: lowercase;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .stat-chip .stat-count { font-weight: 800; }
  .stat-chip:hover { background: var(--surface-hover); }
  .stat-chip.active {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .stat-urgent .stat-count { color: var(--urgent); }
  .stat-soon .stat-count { color: var(--soon); }
  .stat-open .stat-count { color: var(--open-color); }
  .stat-tba .stat-count { color: var(--tba); }
  .stat-closed .stat-count { color: var(--closed); }
  .stat-chip.active .stat-count { color: inherit; }

  .section { margin-top: 2.6rem; }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    margin-bottom: 1.1rem;
    padding-bottom: 0.6rem;
    border-bottom: 2px solid var(--border-strong);
  }
  .section-head h2 {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
    text-transform: lowercase;
  }
  .section[data-section="urgent"] .section-head h2 { color: var(--urgent); }
  .section[data-section="soon"] .section-head h2 { color: var(--soon); }
  .section[data-section="open"] .section-head h2 { color: var(--open-color); }
  .section[data-section="tba"] .section-head h2 { color: var(--tba); }
  .section[data-section="closed"] .section-head h2 { color: var(--closed); }
  .section-hint {
    color: var(--muted);
    font-size: 0.78rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 1rem;
  }
  .card {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 1.1rem 1.2rem;
    text-decoration: none;
    color: var(--text);
    border-left: 3px solid var(--border);
    box-shadow: var(--shadow);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hover);
  }
  .card.urgency-urgent { border-left-color: var(--urgent); }
  .card.urgency-soon { border-left-color: var(--soon); }
  .card.urgency-open { border-left-color: var(--open-color); }
  .card.urgency-tba { border-left-color: var(--tba); }
  .card.urgency-closed { border-left-color: var(--closed); opacity: 0.55; }
  .card-top {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .card-top h3 {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
  }
  .category {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .deadline-row {
    margin-top: 0.8rem;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .deadline-date {
    font-size: 1.05rem;
    font-weight: 700;
  }
  .days-left {
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
    text-transform: lowercase;
  }
  .days-urgent { color: var(--urgent); }
  .days-soon { color: var(--soon); }
  .days-open { color: var(--open-color); }
  .days-tba { color: var(--tba); }
  .days-closed { color: var(--closed); }
  .notes {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.6rem;
    line-height: 1.45;
  }
  .card-footer {
    margin-top: 0.9rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: var(--faint);
    text-transform: lowercase;
  }
  .badge {
    font-size: 0.66rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    text-transform: lowercase;
  }
  .badge-changed { background: var(--text); color: var(--bg); }
  .badge-error { background: var(--brand); color: #fff; }
  .empty-state {
    text-align: center;
    color: var(--muted);
    padding: 3rem 0;
    font-size: 0.9rem;
    display: none;
  }
  footer.bottom {
    margin: 3.5rem auto 0;
    max-width: 1120px;
    padding: 1.5rem 1.5rem 0;
    border-top: 2px solid var(--border-strong);
    color: var(--muted);
    font-size: 0.78rem;
  }
</style>
</head>
<body>
<header class="top">
  <div class="top-row">
    <a class="wordmark" href="#">żiśka<span>.tracker</span></a>
    <span class="tagline">festivals &amp; deadlines</span>
  </div>
  <div class="subtitle">Advertising festival &amp; competition deadlines — last updated ${lastUpdated}</div>
</header>
<div class="wrap">
  <div class="controls">
    <input class="search-input" type="text" id="search" placeholder="filter by name or category…">
    ${statBar}
  </div>

${sectionsHtml}

<div class="empty-state" id="empty-state">No festivals match your filter.</div>

</div>
<footer class="bottom">Generated automatically. Deadlines are extracted from each organizer's public site and may change without notice — click through to confirm before submitting.</footer>
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
