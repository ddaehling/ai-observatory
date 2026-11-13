/* Parallax · AI Observatory — the reader.
   Buildless vanilla JavaScript, no dependencies, no third-party requests. The small
   catalog loads first (falling back to the legacy data.json); report bodies, the source
   ledger and edition notes are fetched only when a page needs them. Queue, read marks,
   progress and preferences stay in this browser.

   SECTIONS
     1  Utilities            6  Marks: the profile, the agreement sentence
     2  Constants            7  Library view (#index and #queue)
     3  State                8  Command palette and queue sheet
     4  Data layer           9  Reading actions and reading progress
     5  Reading state, preferences, announcements   10  Router, focus, transitions
     11 Events               12  Views still to be rebuilt (slices 2 and 3)
     13 Boot
*/
(() => {
  'use strict';

  /* ------------------------------------------------------------------ 1. Utilities */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeURL = value => { try { const url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
  const hostOf = value => { try { return new URL(String(value)).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  const external = (url, text, attrs = '') => {
    const href = safeURL(url);
    return href
      ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" ${attrs}>${esc(text)}<span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`
      : esc(text);
  };
  const sentenceCase = text => { const t = String(text || '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);
  const fmtScore = value => (num(value) === null ? 'Not established' : num(value).toFixed(1));
  /* One number formatter for the whole site, applied everywhere a count is
     printed. Four-figure numbers are written without a separator and five
     figures and up are grouped ('min2'), which is the ISO 31-0 convention the
     ledger's own integration test pins: #source-count has to state the total
     as 3009. The site never writes a four-figure number any other way. */
  const fmtInt = value => {
    const n = Number(value || 0);
    try { return n.toLocaleString('en-GB', { useGrouping: 'min2' }); }
    catch (_) { return String(n); }
  };
  const plural = (n, one, many = `${one}s`) => `${fmtInt(n)} ${Number(n) === 1 ? one : many}`;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reportURL = (id, anchor) => `#report/${encodeURIComponent(id)}${anchor ? `/${encodeURIComponent(anchor)}` : ''}`;
  const motionReduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  const firstSentence = text => { const t = String(text || '').trim(); const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/); return m ? m[0] : t; };
  /* The search words are marked inside the title, on escaped text only: the
     needles are matched against the plain string and the haystack is escaped
     piece by piece, so no user input can reach the DOM as markup. */
  function markWords(text, words) {
    const plain = String(text || '');
    if (!words || !words.length) return esc(plain);
    const spans = [];
    const lower = plain.toLowerCase();
    for (const word of words) {
      if (!word) continue;
      for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) spans.push([at, at + word.length]);
    }
    if (!spans.length) return esc(plain);
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [spans[0]];
    for (const span of spans.slice(1)) {
      const last = merged[merged.length - 1];
      if (span[0] <= last[1]) last[1] = Math.max(last[1], span[1]); else merged.push(span);
    }
    let out = '', at = 0;
    for (const [from, to] of merged) { out += esc(plain.slice(at, from)) + `<mark>${esc(plain.slice(from, to))}</mark>`; at = to; }
    return out + esc(plain.slice(at));
  }
  const searchWords = () => state.filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);

  function fmtDate(value, { time = false, short = false } = {}) {
    if (!value) return 'Not established';
    const d = new Date(String(value).length === 10 ? `${value}T12:00:00Z` : value);
    if (!Number.isFinite(d.getTime())) return 'Not established';
    const opts = short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
    if (time) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
    try { return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: (state.meta && state.meta.timezone) || 'UTC' }).format(d); }
    catch (_) { return d.toISOString().slice(0, 10); }
  }
  const isoDate = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''; };
  const dayIndex = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 86400000) : 0; };

  /* ------------------------------------------------------------------ 2. Constants */
  const DIMENSIONS = [
    { key: 'usefulness', label: 'Usefulness', text: 'Actionable value for people who teach and build.' },
    { key: 'impact', label: 'Impact', text: 'Potential significance to AI development, grounded in evidence.' },
    { key: 'novelty', label: 'Novelty', text: 'Demonstrated difference, rather than promotional claims.' },
    { key: 'maturity', label: 'Maturity', text: 'Documented readiness and reliability; no assumed benchmark performance.' },
    { key: 'openness', label: 'Openness', text: 'Inspectability, licensing, portability and reproducibility.' }
  ];
  const HONESTY = 'Two runs of the same reviewer model: a consistency check, not independent validation.';
  /* The grammar of the caret gauge, written once and printed under every size of
     it, so the mark is never an unlabelled line. */
  const GAUGE_LEGEND = '<span><span class="g-key">▼</span> run A</span><span><span class="g-key">▲</span> run B</span><span><span class="g-key">▏</span> their mean</span><span><span class="g-key g-key-gap">▭</span> the distance between them</span>';
  const STORE = { reading: 'parallax.v1.reading', prefs: 'parallax.v1.prefs' };
  const PREF_VALUES = {
    theme: ['auto', 'plate', 'darkroom', 'redlight'],
    text: ['s', 'm', 'l', 'xl'],
    motion: ['allow', 'reduce'],
    /* WCAG 2.1.4: "/" is a single-character shortcut, so it has an off switch. */
    keys: ['on', 'off'],
    transparency: ['system', 'reduce'],
    plot: ['open', 'closed']
  };
  const THEME_LABEL = { auto: 'Automatic', plate: 'Daylight', darkroom: 'Night sky', redlight: 'Night vision' };
  const PAGE = { reports: 60, sources: 50 };
  /* Measured row heights per density, in rem. contain-intrinsic-size is computed
     from these rather than guessed, so the document does not grow underneath the
     scrollbar as the reader moves down it. */
  const DENSITY = { row: 8.65, rowPhone: 9.4, head: 3.25, lead: 30, srcRow: 3.75 };
  const onPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 55.99em)').matches;
  const CHANGE_LABEL = { baseline: 'Profile', new: 'New', update: 'Revised' };
  const CATEGORY_GLYPH = { Models: '◆', Tools: '▣', 'Open source': '◇', 'Creative workflows': '❖', Research: '◈' };
  const READING_LENSES = [
    { value: '', label: 'Any state', clear: true },
    { value: 'unread', label: 'Unread' },
    { value: 'progress', label: 'In progress' },
    { value: 'queued', label: 'In your queue' },
    { value: 'read', label: 'Read' },
    { value: 'quick', label: 'Quick reads, 5 min' }
  ];
  const SORTS = [
    { value: 'latest', label: 'Latest first' },
    { value: 'score', label: 'Highest rated' },
    { value: 'spread', label: 'Most disagreement' },
    { value: 'title', label: 'Title A–Z' }
  ];

  /* ------------------------------------------------------------------ 3. State */
  const app = $('#app');
  const state = {
    meta: null, entries: [], byId: new Map(), runsLight: [], sourceStats: null,
    details: new Map(), sources: null, runs: null,
    reading: Object.create(null), prefs: {}, storageOK: true,
    filters: { q: '', category: '', min: '', reading: '', sort: 'latest' },
    sourceFilters: { q: '', kind: '', status: '', scope: '' },
    route: { name: '', id: '', anchor: '' }, routeToken: 0, booted: false,
    activeReport: null, listScroll: 0, listShown: PAGE.reports, sourceShown: PAGE.sources,
    palette: { index: 0, items: [] },
    sky: { stars: [], index: 0, table: false, sort: 'date', dir: -1 },
    progress: { io: null, seen: null, total: 0, id: '' },
    docH: 0
  };

  /* ------------------------------------------------------------------ 4. Data layer */
  const pending = new Map();
  function fetchJSON(path) {
    if (pending.has(path)) return pending.get(path);
    const request = fetch(path, { cache: 'no-cache' }).then(response => {
      if (!response.ok) { const error = new Error(`${path} returned ${response.status}`); error.status = response.status; throw error; }
      return response.json();
    });
    pending.set(path, request);
    request.catch(() => pending.delete(path));
    return request;
  }
  const legacy = () => fetchJSON('./data.json');

  const lightEntry = entry => ({
    ...Object.fromEntries(['id', 'title', 'entity', 'category', 'tags', 'summary', 'changeType', 'publishedAt', 'discoveredAt', 'updatedAt', 'officialUrl', 'judgment', 'scores', 'score', 'wordCount', 'readMinutes'].filter(k => k in entry).map(k => [k, entry[k]])),
    sections: (entry.sections || []).map(s => ({ id: s.id, title: s.title })),
    reviews: (entry.reviews || []).map(r => ({ reviewerId: r.reviewerId, verdict: r.verdict, confidence: r.confidence, reviewedAt: r.reviewedAt, scores: r.scores })),
    sourceCount: (entry.sources || []).length,
    useCaseCount: (entry.useCases || []).length,
    limitationCount: (entry.limitations || []).length
  });
  function sourceStatsOf(sources) {
    const byKind = {}, byStatus = {};
    for (const s of sources) { byKind[s.kind] = (byKind[s.kind] || 0) + 1; byStatus[s.status] = (byStatus[s.status] || 0) + 1; }
    return { total: sources.length, monitored: sources.filter(s => s.monitor !== false).length, checked: sources.filter(s => s.lastCheckedAt).length, byKind, byStatus };
  }

  async function loadCatalog() {
    let catalog;
    try {
      catalog = await fetchJSON('./catalog.json');
      if (!catalog || !catalog.metadata || !Array.isArray(catalog.entries)) throw new Error('catalog.json has an unexpected shape.');
    } catch (_) {
      const data = await legacy();
      if (!data || !data.metadata || !Array.isArray(data.entries)) throw new Error('The edition data has an unexpected shape.');
      for (const entry of data.entries) state.details.set(entry.id, entry);
      state.sources = Array.isArray(data.sources) ? data.sources : [];
      state.runs = Array.isArray(data.runs) ? data.runs : [];
      catalog = {
        metadata: data.metadata,
        entries: data.entries.map(lightEntry),
        runs: state.runs.map(({ limitations, ...run }) => ({ ...run, limitationCount: (limitations || []).length })),
        sourceStats: sourceStatsOf(state.sources)
      };
    }
    state.meta = catalog.metadata;
    state.entries = catalog.entries.filter(e => e && typeof e.id === 'string');
    state.byId = new Map(state.entries.map(e => [e.id, e]));
    /* One haystack per report, built once: search never rebuilds strings per keystroke. */
    for (const e of state.entries) {
      e._hay = [e.title, e.entity, e.category, e.summary, ...(e.tags || [])].join(' ').toLowerCase();
      e._runs = runsOf(e);
      e._day = dayIndex(e.discoveredAt);
    }
    state.runsLight = Array.isArray(catalog.runs) ? catalog.runs : [];
    state.sourceStats = catalog.sourceStats || null;
  }

  async function loadReport(id) {
    if (state.details.has(id)) return state.details.get(id);
    let entry;
    try {
      const payload = await fetchJSON(`./reports/${encodeURIComponent(id)}.json`);
      entry = payload && payload.entry;
      if (!entry || entry.id !== id) throw new Error('Unexpected report file.');
    } catch (_) {
      const data = await legacy();
      entry = (data.entries || []).find(item => item.id === id);
      if (!entry) throw new Error('This report is not in the current edition.');
    }
    state.details.set(id, entry);
    return entry;
  }
  async function loadSources() {
    if (state.sources) return state.sources;
    try {
      const payload = await fetchJSON('./sources.json');
      if (!payload || !Array.isArray(payload.sources)) throw new Error('bad shape');
      state.sources = payload.sources;
    } catch (_) {
      const data = await legacy();
      state.sources = Array.isArray(data.sources) ? data.sources : [];
    }
    for (const s of state.sources) s._hay = [s.name, s.url, s.notes, s.kind, ...(s.topics || [])].join(' ').toLowerCase();
    return state.sources;
  }
  async function loadRuns() {
    if (state.runs) return state.runs;
    try {
      const payload = await fetchJSON('./editions.json');
      if (!payload || !Array.isArray(payload.runs)) throw new Error('bad shape');
      state.runs = payload.runs;
    } catch (_) {
      const data = await legacy();
      state.runs = Array.isArray(data.runs) ? data.runs : [];
    }
    return state.runs;
  }

  /* --------------------------------------- 5. Reading state, preferences, messages */
  const record = id => state.reading[id] || { queued: false, read: false, progress: 0 };
  const isShaped = r => r && typeof r === 'object' && typeof r.queued === 'boolean' && typeof r.read === 'boolean' && typeof r.progress === 'number' && Number.isFinite(r.progress) && r.progress >= 0 && r.progress <= 100;

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (_) { state.storageOK = false; return fallback; }
  }
  /* Records for reports that are not in this edition are kept exactly as they are.
     A withdrawn report, or one in a shard this visit never loaded, must not lose the
     reader's place. Only the shape is checked. */
  function readReading() {
    const raw = readStorage(STORE.reading, null);
    const out = Object.create(null);
    const records = raw && raw.records && typeof raw.records === 'object' && !Array.isArray(raw.records) ? raw.records : {};
    for (const [id, item] of Object.entries(records)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      out[id] = {
        ...item,
        queued: item.queued === true,
        read: item.read === true,
        progress: Number.isFinite(Number(item.progress)) ? clamp(Math.round(Number(item.progress)), 0, 100) : 0
      };
    }
    return out;
  }
  function saveReading() {
    try { localStorage.setItem(STORE.reading, JSON.stringify({ schemaVersion: 1, records: state.reading })); }
    catch (_) { state.storageOK = false; }
  }
  const validPrefs = value => Object.fromEntries(Object.entries(PREF_VALUES)
    .filter(([key, values]) => value && values.includes(value[key])).map(([key]) => [key, value[key]]));

  function applyPrefs() {
    const root = document.documentElement;
    const theme = state.prefs.theme;
    if (theme && theme !== 'auto') root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
    if (PREF_VALUES.text.includes(state.prefs.text) && state.prefs.text !== 'm') root.setAttribute('data-text', state.prefs.text);
    else root.removeAttribute('data-text');
    if (state.prefs.motion === 'reduce') root.setAttribute('data-motion', 'reduce'); else root.removeAttribute('data-motion');
    if (state.prefs.transparency === 'reduce') root.setAttribute('data-transparency', 'reduce'); else root.removeAttribute('data-transparency');
    const dark = theme === 'darkroom' || theme === 'redlight' || ((!theme || theme === 'auto') && matchMedia('(prefers-color-scheme: dark)').matches);
    const tint = theme === 'redlight' ? '#000000' : dark ? '#14181F' : '#F4F5F7';
    const metas = $$('meta[name="theme-color"]');
    metas.forEach((meta, i) => { if (i === 0) { meta.setAttribute('content', tint); meta.removeAttribute('media'); } else meta.remove(); });
  }
  function savePrefs() {
    try { localStorage.setItem(STORE.prefs, JSON.stringify(validPrefs(state.prefs))); }
    catch (_) { announce('This preference applies to this visit only; browser storage is unavailable.'); }
  }
  function setPref(key, value) {
    if (!PREF_VALUES[key] || !PREF_VALUES[key].includes(value)) return;
    state.prefs[key] = value;
    applyPrefs();
    savePrefs();
  }

  /* One live region, one message. The settings page mirrors it as visible text. */
  function announce(message) {
    const box = $('#announcer');
    if (box) { box.textContent = ''; requestAnimationFrame(() => { box.textContent = message; }); }
    const status = $('#settings-status');
    if (status) status.textContent = message;
  }
  const announceCount = debounce(message => announce(message), 500);

  /* ------------------------------------------------- 6. Marks: profile and agreement */
  /* Run A is the caret above the line, run B the caret below it. In a list the pair is
     drawn as one bar per dimension: the bar reaches the higher of the two runs, the ink
     reaches the lower, and the tinted cap between them is the disagreement. */
  function runsOf(entry) {
    const reviews = Array.isArray(entry.reviews) ? entry.reviews.filter(r => r && r.scores) : [];
    const a = reviews.find(r => /_a\d*$/.test(String(r.reviewerId || ''))) || reviews[0] || null;
    const b = reviews.find(r => r !== a && /_b\d*$/.test(String(r.reviewerId || ''))) || reviews.find(r => r !== a) || null;
    const dims = DIMENSIONS.map(d => {
      const mean = num(entry.scores && entry.scores[d.key]);
      const av = a && num(a.scores[d.key]) !== null ? num(a.scores[d.key]) : mean;
      const bv = b && num(b.scores[d.key]) !== null ? num(b.scores[d.key]) : av;
      const hi = av === null ? null : Math.max(av, bv);
      const lo = av === null ? null : Math.min(av, bv);
      return { ...d, a: av, b: bv, mean, hi, lo, differs: av !== null && av !== bv };
    });
    const differing = dims.filter(d => d.differs);
    return { a, b, dims, differing, splits: differing.length, pairs: dims.filter(d => d.a !== null).length, both: !!(a && b && a !== b) };
  }
  function agreementLine(entry) {
    const r = entry._runs || runsOf(entry);
    if (!r.both) return 'One recorded run';
    return r.splits === 0 ? `Runs agree on all ${r.pairs}` : `Runs differ on ${r.splits} of ${r.pairs}`;
  }
  function agreementSentence(entry) {
    const r = entry._runs || runsOf(entry);
    if (!r.both) return 'Only one review run is recorded for this report.';
    if (!r.splits) return `Run A and run B agree on all ${r.pairs} dimensions.`;
    const names = r.differing.map(d => d.label.toLowerCase());
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const by = Math.max(...r.differing.map(d => Math.abs(d.a - d.b)));
    return `Run A and run B agree on ${r.pairs - r.splits} of ${r.pairs} dimensions; they differ by ${by === 1 ? 'one point' : `${by} points`} on ${list}.`;
  }
  function profile(entry, size = '') {
    const r = entry._runs || runsOf(entry);
    const bars = r.dims.map(d => {
      if (d.hi === null) return '<i style="--h:0%;--k:100%"></i>';
      const h = clamp(d.hi * 10, 2, 100);
      const k = clamp((d.lo / Math.max(d.hi, 0.0001)) * 100, 0, 100);
      return `<i style="--h:${h.toFixed(1)}%;--k:${k.toFixed(1)}%"></i>`;
    }).join('');
    const values = r.dims.map(d => `${d.label.toLowerCase()} ${d.mean === null ? 'not established' : fmtScore(d.mean)}`).join(', ');
    const label = `${sentenceCase(values)}. ${agreementSentence(entry)}`;
    return `<span class="profile${size ? ` ${size}` : ''}" role="img" aria-label="${esc(label)}">${bars}</span>`;
  }
  const arithmetic = entry => {
    const r = entry._runs || runsOf(entry);
    const parts = r.dims.map(d => (d.mean === null ? '–' : fmtScore(d.mean)));
    return `Mean of five dimensions: (${parts.join(' + ')}) ÷ 5 = ${fmtScore(entry.score)}`;
  };

  /* ------------------------------------------------------------- 7. The library view */
  const categories = () => [...new Set(state.entries.map(e => e.category).filter(Boolean))].sort(collator.compare);
  const minutesLeft = entry => Math.max(1, Math.round((entry.readMinutes || 0) * (1 - record(entry.id).progress / 100)));

  function matchesLens(entry, lens) {
    const r = record(entry.id);
    switch (lens) {
      case 'unread': return !r.read && r.progress < 5;
      case 'progress': return !r.read && r.progress >= 5 && r.progress < 97;
      case 'queued': return r.queued;
      case 'read': return r.read;
      case 'quick': return (entry.readMinutes || 0) <= 5;
      default: return true;
    }
  }
  function filtered({ skip = '' } = {}) {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];
    let list = state.entries;
    if (state.route.name === 'queue') list = list.filter(e => record(e.id).queued);
    if (words.length && skip !== 'q') list = list.filter(e => words.every(w => e._hay.includes(w)));
    if (f.category && skip !== 'category') list = list.filter(e => e.category === f.category);
    if (f.min && skip !== 'min') list = list.filter(e => num(e.score) !== null && num(e.score) >= Number(f.min));
    if (f.reading && skip !== 'reading') list = list.filter(e => matchesLens(e, f.reading));
    return sortList(list, f.sort);
  }
  function sortList(list, sort) {
    const copy = [...list];
    if (sort === 'score') copy.sort((a, b) => (num(b.score) || 0) - (num(a.score) || 0) || collator.compare(a.title, b.title));
    else if (sort === 'title') copy.sort((a, b) => collator.compare(a.title, b.title));
    else if (sort === 'spread') copy.sort((a, b) => b._runs.splits - a._runs.splits || (num(b.score) || 0) - (num(a.score) || 0));
    else copy.sort((a, b) => String(b.discoveredAt || '').localeCompare(String(a.discoveredAt || '')));
    return copy;
  }
  const filtersActive = () => !!(state.filters.q.trim() || state.filters.category || state.filters.min || state.filters.reading);

  function readingLabel(id) {
    const r = record(id);
    if (r.read) return 'Read';
    if (r.progress >= 5 && r.progress < 97) return `${r.progress}% read`;
    if (r.queued) return 'In queue';
    return '';
  }
  const readingGlyph = id => {
    const r = record(id);
    if (r.read) return '✓';
    if (r.progress >= 5) return '◔';
    if (r.queued) return '▰';
    return '';
  };

  /* The kicker says which date it is showing, and says it in a different weight
     from the date itself: a column of "Released 18 Jun" next to "Found 11 Nov"
     in identical type reads as dates out of order. */
  const whenSpan = entry => (entry.publishedAt
    ? `<span class="row-when"><b>Released</b> ${esc(fmtDate(entry.publishedAt))}</span>`
    : `<span class="row-when"><b>Found</b> ${esc(fmtDate(entry.discoveredAt))}</span>`);

  function rowHTML(entry, index, total, words) {
    const id = entry.id;
    const r = record(id);
    const label = readingLabel(id);
    const tags = (entry.tags || []).slice(0, 2);
    return `<li class="row${r.read ? ' read' : ''}" data-report-id="${esc(id)}" aria-label="${esc(entry.title)}" aria-posinset="${index + 1}" aria-setsize="${total}">
<span class="row-state" data-reading-glyph="${esc(id)}" aria-hidden="true">${readingGlyph(id)}</span>
<div class="row-main">
<p class="row-kicker"><span class="row-cat">${esc(CATEGORY_GLYPH[entry.category] || '◇')} ${esc(entry.category || 'Not established')}</span><span>${esc(CHANGE_LABEL[entry.changeType] || 'Report')}</span>${whenSpan(entry)}</p>
<h4 class="row-title"><a class="row-link" href="${reportURL(id)}">${markWords(entry.title, words)}</a></h4>
<p class="row-sum">${esc(entry.summary || '')}</p>
<p class="row-meta"><span>${esc(fmtInt(entry.readMinutes || 0))} min read</span>${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}<span data-reading-label="${esc(id)}">${esc(label)}</span></p>
</div>
<div class="row-score">
<p class="score"><b>${esc(fmtScore(entry.score))}</b><span>out of 10</span></p>
${profile(entry)}
<p class="agree">${esc(agreementLine(entry))}</p>
</div>
${queueButton(entry)}
</li>`;
  }
  const queueButton = entry => `<button type="button" class="icon-btn row-save" data-action="queue" data-id="${esc(entry.id)}" aria-pressed="${record(entry.id).queued}" aria-label="${record(entry.id).queued ? 'Remove' : 'Save'} ${esc(entry.title)} ${record(entry.id).queued ? 'from' : 'to'} your reading queue"><svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4.5h10v15l-5-3.7-5 3.7z"/></svg></button>`;

  /* The lead tile spans exactly as many rows as the tiles beside it: `1 / -1` would
     resolve against an explicit grid that does not exist and silently span one row. */
  function tileHTML(entry, index, total, lead = false, span = 0, words) {
    const id = entry.id;
    return `<li class="tile${lead ? ' tile-lead' : ''}" ${lead && span > 1 ? `style="grid-row: 1 / span ${span}"` : ''} data-report-id="${esc(id)}" aria-label="${esc(entry.title)}" aria-posinset="${index + 1}" aria-setsize="${total}">
<p class="row-kicker"><span class="row-cat">${esc(CATEGORY_GLYPH[entry.category] || '◇')} ${esc(entry.category || 'Not established')}</span><span>${esc(CHANGE_LABEL[entry.changeType] || 'Report')}</span>${whenSpan(entry)}</p>
<h4 class="tile-title"><a class="row-link" href="${reportURL(id)}">${markWords(entry.title, words)}</a></h4>
${lead ? `<p class="row-sum">${esc(entry.summary || '')}</p>` : ''}
${lead && entry.judgment ? `<p class="tile-judgment">${esc(entry.judgment)}</p>` : ''}
${lead ? `<p class="row-meta"><span>${esc(fmtInt(entry.readMinutes || 0))} min read</span></p>` : ''}
<div class="tile-foot">
<div class="tile-score">
<p class="score"><b>${esc(fmtScore(entry.score))}</b><span>out of 10</span></p>
${lead ? `<p class="arith">${esc(arithmetic(entry))}</p>` : ''}
</div>
<div class="profile-stack">${profile(entry, lead ? 'lg' : 'sm')}${lead ? '<span class="profile-key" aria-hidden="true">usefulness · impact · novelty · maturity · openness</span>' : ''}</div>
<p class="agree">${esc(agreementLine(entry))}${lead ? '' : esc(` · ${fmtInt(entry.readMinutes || 0)} min read`)}</p>
<span class="tile-state" data-reading-label="${esc(id)}">${esc(readingLabel(id))}</span>
</div>
</li>`;
  }

  function chipsHTML(name, options, selected) {
    return options.map(o => {
      const on = String(selected || '') === String(o.value);
      const off = o.count === 0 && o.value !== '';
      return `<label class="chip${o.value === '' ? ' chip-clear' : ''}"><input type="radio" name="${esc(name)}" value="${esc(o.value)}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span>${esc(o.label)}</span>${o.count === undefined ? '' : `<span class="chip-n">${esc(fmtInt(o.count))}</span>`}</label>`;
    }).join('');
  }

  const inProgress = entry => { const r = record(entry.id); return !r.read && r.progress >= 5 && r.progress < 97; };

  function renderLibrary() {
    if (state.route.name === 'queue') { renderQueuePage(); return; }
    const total = state.entries.length;
    const stats = state.sourceStats || {};
    const resume = state.entries.filter(inProgress)
      .sort((a, b) => record(b.id).progress - record(a.id).progress)[0];

    app.innerHTML = `<div class="library">
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">AI Observatory</p>
      <h1 class="display">Every report, seen twice.</h1>
      <p class="lede">Source-linked research on AI tools, models, open code and creative work, for people who teach and build. Every report is read twice, and both readings are shown.</p>
      <div class="figures">
        <p class="figure"><b>${esc(fmtInt(total))}</b><span>reports</span></p>
        <p class="figure"><b>${esc(fmtInt(state.runsLight.length))}</b><span>editions</span></p>
        <p class="figure"><b>${esc(fmtInt(stats.total || 0))}</b><span>source records</span></p>
        <p class="figure"><b>${esc(fmtInt(stats.monitored || 0))}</b><span>monitored sources</span></p>
      </div>
      ${resume ? `<div class="resume-card">
        <p class="eyebrow">Continue reading</p>
        <a href="${reportURL(resume.id)}">${esc(resume.title)}</a>
        <div class="bar"><span style="--p:${record(resume.id).progress}%"></span></div>
        <p class="resume-foot"><span>${record(resume.id).progress}% read · about ${esc(plural(minutesLeft(resume), 'minute'))} left</span><span>${esc(fmtScore(resume.score))} out of 10</span></p>
      </div>` : ''}
    </div>
  </header>
  <section class="library-body" aria-labelledby="reports-h">
    ${filtersHTML()}
    <p class="statusline">
      <span id="report-count"></span>
      <span class="profile-key">Bars: the five dimensions in rubric order; a tinted cap means the runs differ.</span>
      <span class="keys"><span><kbd>/</kbd> search</span><span><kbd>⌘K</kbd> find</span></span>
    </p>
    <div id="report-list"></div>
    <div id="list-empty"></div>
  </section>
  ${skyBlock()}
</div>`;
    renderReportList();
    measureChrome();
  }

  /* ------------------------------------------------------------ 7a. The queue page
     #queue is the queue, not the library with every other report filtered out. The
     old build raised the whole filter apparatus above it — a search field, two
     menus, twelve chips every one of them reading 0 — and then said the queue was
     empty. The page carries the list, the totals, the order controls and the two
     data actions, and nothing else. */
  const queueOrder = entry => { const r = record(entry.id); return Number.isFinite(Number(r.order)) ? Number(r.order) : Number.MAX_SAFE_INTEGER; };
  const queuedList = () => state.entries.filter(e => record(e.id).queued)
    .sort((a, b) => queueOrder(a) - queueOrder(b) || collator.compare(a.title, b.title));

  function queuePageRowHTML(entry, index, total) {
    const r = record(entry.id);
    const going = inProgress(entry);
    const left = r.read ? 'Marked as read' : `about ${plural(minutesLeft(entry), 'minute')} left`;
    return `<li class="qrow" data-report-id="${esc(entry.id)}" aria-posinset="${index + 1}" aria-setsize="${total}">
  <div class="qrow-main">
    <h3 class="qrow-title"><a class="row-link" href="${reportURL(entry.id)}">${esc(entry.title)}</a></h3>
    ${going ? `<div class="bar"><span style="--p:${r.progress}%"></span></div>` : ''}
    <p class="qrow-meta"><span>${esc(fmtScore(entry.score))} out of 10</span><span>${esc(agreementLine(entry))}</span><span>${esc(left)}</span></p>
  </div>
  <div class="qrow-tools">
    <button type="button" class="qrow-move" data-action="queue-up" data-id="${esc(entry.id)}" aria-label="Move ${esc(entry.title)} up the queue"${index === 0 ? ' disabled' : ''}><span aria-hidden="true">▲</span></button>
    <button type="button" class="qrow-move" data-action="queue-down" data-id="${esc(entry.id)}" aria-label="Move ${esc(entry.title)} down the queue"${index === total - 1 ? ' disabled' : ''}><span aria-hidden="true">▼</span></button>
    ${queueButton(entry)}
  </div>
</li>`;
  }

  function renderQueuePage() {
    const saved = queuedList();
    const minutes = saved.filter(e => !record(e.id).read).reduce((a, e) => a + minutesLeft(e), 0);
    app.innerHTML = `<div class="library">
  <header class="queue-head">
    <p class="eyebrow">Your reading</p>
    <h1 class="title-1">Reading queue</h1>
    <p class="lede">Reports you saved, in the order you want to read them. Your queue, read marks and progress stay in this browser.</p>
    ${saved.length ? `<div class="actions"><button type="button" class="button" data-action="export">Export as a file</button><a class="textlink" href="#settings/data">Manage your reading data</a></div>` : ''}
  </header>
  <section class="library-body" aria-labelledby="reports-h">
    <h2 class="sr-only" id="reports-h">Saved reports</h2>
    <p class="statusline"><span id="report-count">${esc(plural(saved.length, 'report'))}${minutes ? esc(` · about ${plural(minutes, 'minute')} left`) : ''}</span></p>
    <div id="report-list">${saved.length ? `<ol class="qpage">${saved.map((e, i) => queuePageRowHTML(e, i, saved.length)).join('')}</ol>` : ''}</div>
    <div id="list-empty">${saved.length ? '' : emptyStateHTML(true)}</div>
  </section>
</div>`;
    measureChrome();
  }

  /* Reordering is explicit and keyboard-first (SC 2.5.7): the two controls swap a
     record's place in the queue and focus follows the report that moved. */
  function moveQueued(id, delta) {
    const list = queuedList();
    const at = list.findIndex(e => e.id === id);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(at, 1)[0]);
    list.forEach((entry, i) => { state.reading[entry.id] = { ...record(entry.id), order: i }; });
    saveReading();
    if (state.route.name === 'queue') renderQueuePage(); else renderQueue();
    announce(`${state.byId.get(id)?.title || 'Report'} moved to position ${to + 1} of ${list.length}.`);
    $(`[data-action="${delta < 0 ? 'queue-up' : 'queue-down'}"][data-id="${CSS.escape(id)}"]`)?.focus();
  }

  function filtersHTML() {
    const f = state.filters;
    const catCounts = new Map();
    for (const e of filtered({ skip: 'category' })) catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1);
    const lensBase = filtered({ skip: 'reading' });
    const catOptions = [{ value: '', label: 'All', count: filtered({ skip: 'category' }).length }]
      .concat(categories().map(c => ({ value: c, label: c, count: catCounts.get(c) || 0 })));
    const lensOptions = READING_LENSES.map(l => ({ ...l, count: lensBase.filter(e => matchesLens(e, l.value)).length }));
    const thresholds = [5, 6, 7].filter(t => state.entries.some(e => num(e.score) !== null && num(e.score) >= t));
    return `<form id="report-filters" role="search" aria-label="Filter and sort the library">
  <div class="toolbar">
    <div class="toolbar-row">
      <h2 class="toolbar-h" id="reports-h">Reports</h2>
      <div class="field">
        <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.4"/><path d="M15.7 15.7 20.5 20.5"/></svg>
        <label class="sr-only" for="report-search">Search the library</label>
        <input id="report-search" name="q" type="search" value="${esc(f.q)}" placeholder="Search titles, makers and tags…" autocomplete="off" spellcheck="false">
      </div>
      <div class="filter-group">
        <span class="select-wrap">
          <label class="sr-only" for="filter-min">Minimum rating</label>
          <select class="input" id="filter-min" name="min">
            <option value="">Any rating</option>
            ${thresholds.map(t => `<option value="${t}"${f.min === String(t) ? ' selected' : ''}>Rated ${t}.0 or higher</option>`).join('')}
          </select>
        </span>
        <span class="select-wrap">
          <label class="sr-only" for="filter-sort">Sort</label>
          <select class="input" id="filter-sort" name="sort">
            ${SORTS.map(s => `<option value="${s.value}"${f.sort === s.value ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </span>
        <button type="button" class="button button-quiet" data-action="reset-filters">Reset</button>
      </div>
    </div>
  </div>
  <div class="chiprow chiprow-scroll" role="group" aria-label="Category">${chipsHTML('category', catOptions, f.category)}</div>
  <div class="chiprow" role="group" aria-label="Reading lens">${chipsHTML('reading', lensOptions, f.reading)}</div>
</form>`;
  }

  /* Groups are the dates on which reports were first found — a recorded fact. Edition
     membership is not inferred from them. */
  /* eslint-disable-next-line no-unused-vars */
  function groupsOf(list) {
    const grouped = state.filters.sort === 'latest' && !state.filters.q.trim();
    if (!grouped) return [{ key: '', label: '', items: list }];
    const map = new Map();
    for (const e of list) {
      const key = isoDate(e.discoveredAt) || 'undated';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map].map(([key, items]) => ({ key, label: key === 'undated' ? 'Date not established' : `Found ${fmtDate(key)}`, items }));
  }

  /* The estimate a group reserves while it is off screen comes from the fixed row
     height for the current density, the group header and the gaps — never a guess.
     An 8rem-per-row guess against a 9.25rem row made the index grow 23% as the
     reader scrolled through it, and the scrollbar thumb shrink with it. */
  function groupHeight(count, isLead) {
    const row = onPhone() ? DENSITY.rowPhone : DENSITY.row;
    return (isLead ? DENSITY.lead : count * row) + DENSITY.head;
  }

  function renderReportList() {
    const list = $('#report-list');
    if (!list) return;
    const all = filtered();
    const total = state.entries.length;
    const shown = Math.min(state.listShown, all.length);
    const count = $('#report-count');
    if (count) count.textContent = all.length === total ? plural(total, 'report') : `${fmtInt(all.length)} of ${plural(total, 'report')}`;

    const emptyBox = $('#list-empty');
    if (!all.length) {
      list.innerHTML = '';
      if (emptyBox) emptyBox.innerHTML = emptyStateHTML(false);
      if (state.booted) announceCount(`No report matches. ${fmtInt(total)} in the library.`);
      return;
    }
    if (emptyBox) emptyBox.innerHTML = '';

    const page = all.slice(0, shown);
    const groups = groupsOf(page);
    const lead = !filtersActive() && state.filters.sort === 'latest';
    const words = searchWords();
    let index = 0;
    const html = groups.map((g, gi) => {
      const headId = `group-${gi}`;
      const head = g.label ? `<h3 class="group-head" id="${headId}">${esc(g.label)}<span class="group-n">${esc(plural(g.items.length, 'report'))} first found</span></h3>` : '';
      const isLead = lead && gi === 0 && g.items.length > 1;
      let body;
      if (isLead) {
        const ordered = sortList(g.items, 'score');
        body = `<ol class="lead-grid">${ordered.map((e, i) => tileHTML(e, index++, all.length, i === 0, ordered.length - 1, words)).join('')}</ol>`;
      } else {
        body = `<ol class="rows">${g.items.map(e => rowHTML(e, index++, all.length, words)).join('')}</ol>`;
      }
      return `<section class="group"${g.label ? ` aria-labelledby="${headId}"` : ''} style="--group-h:${groupHeight(g.items.length, isLead).toFixed(2)}rem">${head}${body}</section>`;
    }).join('');
    const more = all.length > shown
      ? `<div class="list-foot"><button type="button" class="button" data-action="more">Show ${Math.min(PAGE.reports, all.length - shown)} more of ${esc(plural(all.length - shown, 'report'))}</button></div><div class="sentinel" data-sentinel></div>`
      : '';
    list.innerHTML = html + more;
    observeSentinel();
    if (state.booted) announceCount(`${fmtInt(all.length)} of ${plural(total, 'report')}`);
  }

  function emptyStateHTML(isQueue) {
    if (isQueue) {
      return `<div class="qempty">
  <p class="qempty-glyph" aria-hidden="true">☆</p>
  <h3>Your queue is empty.</h3>
  <p>Save a report with the bookmark control on any row or in any report header, and it will wait for you here. It stays in this browser.</p>
  <a class="button button-primary" href="#index">Browse the library</a>
</div>`;
    }
    const q = state.filters.q.trim();
    const near = sortList(state.entries.filter(e => !state.filters.category || e.category === state.filters.category), 'score').slice(0, 3);
    return `<div class="empty-state">
<h2>${q ? `No match for “${esc(q)}”.` : 'No reports match these filters.'}</h2>
<p>${q ? 'Search looks at titles, makers, categories, summaries and tags. Try fewer words.' : 'Nothing in the library satisfies every active filter at once.'}</p>
<button type="button" class="button" data-action="reset-filters">Clear filters</button>
<div class="suggest"><p class="eyebrow">Highest rated in the library</p>${near.map(e => `<a href="${reportURL(e.id)}">${esc(e.title)} — ${esc(fmtScore(e.score))} out of 10</a>`).join('')}</div>
</div>`;
  }

  let sentinelObserver = null;
  function observeSentinel() {
    if (sentinelObserver) { sentinelObserver.disconnect(); sentinelObserver = null; }
    const sentinel = $('[data-sentinel]');
    if (!sentinel || typeof IntersectionObserver !== 'function') return;
    sentinelObserver = new IntersectionObserver(items => {
      if (items.some(i => i.isIntersecting)) showMore();
    }, { rootMargin: '600px 0px' });
    sentinelObserver.observe(sentinel);
  }
  function showMore() {
    const all = filtered();
    if (state.listShown >= all.length) return;
    state.listShown += PAGE.reports;
    renderReportList();
  }

  /* ------------------------------------------------------- 7b. The library, plotted */
  function skyPoints() {
    const entries = state.entries.filter(e => num(e.score) !== null);
    if (!entries.length) return { stars: [], days: [], lo: 4, hi: 8 };
    const days = entries.map(e => e._day);
    const dMin = Math.min(...days), dMax = Math.max(...days);
    const scores = entries.map(e => num(e.score));
    const lo = Math.floor(Math.min(...scores)), hi = Math.ceil(Math.max(...scores));
    const buckets = new Map();
    const stars = entries.map(e => {
      const x = dMax === dMin ? 50 : ((e._day - dMin) / (dMax - dMin)) * 100;
      const y = 100 - ((num(e.score) - lo) / Math.max(hi - lo, 1)) * 100;
      const key = `${e._day}:${Math.round(num(e.score) * 10)}`;
      const seat = buckets.get(key) || 0;
      buckets.set(key, seat + 1);
      /* deterministic beeswarm: one bucket pass, no measurement, no jitter */
      const offset = (((seat + 1) >> 1) * (seat % 2 ? -1 : 1) * 0.45).toFixed(2);
      const minutes = e.readMinutes || 0;
      const r = minutes >= 12 ? 0.6 : minutes >= 8 ? 0.48 : 0.36;
      return { entry: e, x, y, offset, r };
    });
    return { stars, lo, hi, dMin, dMax };
  }
  function skyBlock() {
    const phone = matchMedia('(max-width: 55.99em)').matches;
    const open = PREF_VALUES.plot.includes(state.prefs.plot) ? state.prefs.plot === 'open' : !phone;
    return `<details class="sky-details" data-plot${open ? ' open' : ''}>
  <summary>The library, plotted</summary>
  <div class="sky-wrap">${skyHTML()}</div>
</details>`;
  }
  function skyHTML() {
    const { stars, lo, hi, dMin, dMax } = skyPoints();
    state.sky.stars = stars;
    if (!stars.length) return '';
    const ticks = [];
    for (let v = lo; v <= hi; v++) ticks.push(v);
    const dates = [dMin, dMin + (dMax - dMin) / 2, dMax].map(d => new Date(d * 86400000));
    const plot = `<div class="sky-plot" id="sky-plot" role="listbox" tabindex="0" aria-label="The library, plotted: rating against the date each report was first found" aria-activedescendant="star-0">
${stars.map((s, i) => `<span class="star" role="option" id="star-${i}" aria-selected="${i === 0}" data-sky="${i}" data-split="${s.entry._runs.splits ? 1 : 0}" data-read="${record(s.entry.id).read ? 1 : 0}" style="--x:${s.x.toFixed(2)}%;--y:${s.y.toFixed(2)}%;--r:${s.r}rem;--o:${s.offset}rem" aria-label="${esc(`${s.entry.title}. ${fmtScore(s.entry.score)} out of 10. ${agreementLine(s.entry)}. ${plural(s.entry.readMinutes || 0, 'minute')} read.`)}"></span>`).join('')}
</div>`;
    /* Both axes live in their own gutters outside the plot box, so no numeral has
       a gridline through it and no star is plotted underneath a date label. The
       first and last date are anchored to the ends of the axis rather than
       centred on them, which is what sheared the last label off the panel. */
    const axes = `${ticks.map(v => `<span class="sky-grid" style="--y:${(100 - ((v - lo) / Math.max(hi - lo, 1)) * 100).toFixed(2)}%"></span>`).join('')}
${ticks.map(v => `<span class="sky-axis sky-axis-y" style="--y:${(100 - ((v - lo) / Math.max(hi - lo, 1)) * 100).toFixed(2)}%">${v}</span>`).join('')}
${dates.map((d, i) => `<span class="sky-axis sky-axis-x${i === 0 ? ' is-start' : i === dates.length - 1 ? ' is-end' : ''}" style="--x:${i * 50}%">${esc(fmtDate(d.toISOString(), { short: true }))}</span>`).join('')}`;
    /* One star is named, atlas-style: the highest rated in the library. */
    const brightest = stars.reduce((best, star) => ((num(star.entry.score) || 0) > (num(best.entry.score) || 0) ? star : best), stars[0]);
    const label = `<span class="sky-label${brightest.x > 55 ? ' is-right' : ''}" style="--x:${brightest.x.toFixed(2)}%;--y:${brightest.y.toFixed(2)}%" aria-hidden="true"><b>${esc(brightest.entry.entity || brightest.entry.title)}</b><span>${esc(fmtScore(brightest.entry.score))} out of 10 · highest rated</span></span>`;
    const split = stars.filter(star => star.entry._runs.splits).length;
    return `<div class="sky" id="sky">
  <div class="sky-plot sky-axes" aria-hidden="true">${axes}${label}</div>
  ${plot}
  <div class="sky-lens" id="sky-lens" hidden></div>
</div>
<div class="sky-note">
  <p>Across: when it was found. Up: its rating, on the ${lo}–${hi} part of the 1–10 scale. Bigger takes longer to read, hollow means read, and a detached outer ring marks the ${esc(fmtInt(split))} of ${esc(fmtInt(stars.length))} whose two runs differed. Editorial judgments, not benchmarks.</p>
  <button type="button" class="button button-quiet" data-action="sky-table" aria-pressed="${state.sky.table}">${state.sky.table ? 'View as plot' : 'View as table'}</button>
</div>
${state.sky.table ? skyTableHTML() : ''}`;
  }
  function skyTableHTML() {
    const dir = state.sky.dir;
    const key = state.sky.sort;
    const rows = [...state.entries].sort((a, b) => {
      if (key === 'title') return dir * collator.compare(a.title, b.title);
      if (key === 'score') return dir * ((num(a.score) || 0) - (num(b.score) || 0));
      return dir * String(a.discoveredAt || '').localeCompare(String(b.discoveredAt || ''));
    });
    const head = (k, label, cls = '') => `<th scope="col"${cls ? ` class="${cls}"` : ''} aria-sort="${key === k ? (dir === 1 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-action="sky-sort" data-sort="${k}">${esc(label)}${key === k ? (dir === 1 ? ' ↑' : ' ↓') : ''}</button></th>`;
    return `<div class="sky-table" role="region" tabindex="0" aria-label="The library as a table">
<table><caption>Every report, its rating and the date it was first found. The same data as the plot.</caption>
<thead><tr>${head('title', 'Report')}${head('date', 'First found')}${head('score', 'Rating', 'n')}<th scope="col">Runs</th></tr></thead>
<tbody>${rows.map(e => `<tr><td><a href="${reportURL(e.id)}">${esc(e.title)}</a></td><td>${esc(fmtDate(e.discoveredAt))}</td><td class="n">${esc(fmtScore(e.score))}</td><td>${esc(agreementLine(e))}</td></tr>`).join('')}</tbody>
</table></div>`;
  }
  function moveSky(delta, axis) {
    const stars = state.sky.stars;
    if (!stars.length) return;
    const order = axis === 'y'
      ? [...stars.keys()].sort((i, j) => stars[i].y - stars[j].y || stars[i].x - stars[j].x)
      : [...stars.keys()].sort((i, j) => stars[i].x - stars[j].x || stars[i].y - stars[j].y);
    const at = order.indexOf(state.sky.index);
    const next = order[clamp(at + delta, 0, order.length - 1)];
    selectStar(next);
  }
  function selectStar(index) {
    const stars = state.sky.stars;
    if (!stars[index]) return;
    state.sky.index = index;
    const plot = $('#sky-plot');
    if (plot) plot.setAttribute('aria-activedescendant', `star-${index}`);
    for (const el of $$('#sky-plot .star')) el.setAttribute('aria-selected', String(Number(el.dataset.sky) === index));
    const lens = $('#sky-lens');
    const star = stars[index];
    if (lens) {
      lens.hidden = false;
      lens.style.setProperty('--lx', `${star.x.toFixed(2)}%`);
      lens.style.setProperty('--ly', `${star.y.toFixed(2)}%`);
      lens.innerHTML = `<b>${esc(star.entry.entity || star.entry.title)}</b><span>${esc(star.entry.category || '')} · ${esc(fmtScore(star.entry.score))} out of 10 · ${esc(plural(star.entry.readMinutes || 0, 'min'))} read<br>${esc(agreementLine(star.entry))}</span>`;
    }
  }

  /* -------------------------------------------------- 8. Command palette, queue sheet */
  function paletteItems(query) {
    const q = query.trim().toLowerCase();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];
    const pages = [
      { label: 'Library', detail: 'Every report', url: '#index' },
      { label: 'Reading queue', detail: 'What you saved', url: '#queue' },
      { label: 'Sources', detail: 'The source ledger', url: '#sources' },
      { label: 'Editions', detail: 'Every scan', url: '#editions' },
      { label: 'Method', detail: 'How reports are rated', url: '#method' },
      { label: 'Settings', detail: 'Appearance, text size, your data', url: '#settings' }
    ];
    const actions = [
      { label: 'Appearance: Automatic', detail: 'Follow the system', run: () => setPref('theme', 'auto') },
      { label: 'Appearance: Daylight', detail: 'Light theme', run: () => setPref('theme', 'plate') },
      { label: 'Appearance: Night sky', detail: 'Dark theme', run: () => setPref('theme', 'darkroom') },
      { label: 'Appearance: Night vision', detail: 'Red light only', run: () => setPref('theme', 'redlight') },
      { label: 'Open the reading queue', detail: 'Your saved reports', run: openQueue },
      { label: 'Export reading data', detail: 'Download a JSON file', run: exportReading },
      { label: 'Show only unread reports', detail: 'Filter the library', run: () => { state.filters.reading = 'unread'; if (location.hash.replace('#', '') !== 'index') location.hash = '#index'; else renderLibrary(); } }
    ];
    const groups = [];
    if (!words.length) {
      const resume = state.entries.filter(e => { const r = record(e.id); return !r.read && r.progress >= 5 && r.progress < 97; });
      const queued = state.entries.filter(e => record(e.id).queued && !resume.includes(e));
      const items = resume.map(e => ({ label: e.title, detail: `${record(e.id).progress}% read · about ${plural(minutesLeft(e), 'minute')} left`, url: reportURL(e.id), entry: e }))
        .concat(queued.map(e => ({ label: e.title, detail: `In your queue · ${fmtInt(e.readMinutes || 0)} min read`, url: reportURL(e.id), entry: e })));
      if (items.length) groups.push({ title: 'Continue reading and queue', items: items.slice(0, 6) });
      groups.push({ title: 'Pages', items: pages });
      groups.push({ title: 'Latest reports', items: sortList(state.entries, 'latest').slice(0, 5).map(paletteReport) });
      groups.push({ title: 'Actions', items: actions });
      return groups;
    }
    const hits = state.entries.filter(e => words.every(w => e._hay.includes(w)));
    const ranked = hits.sort((a, b) => score(b) - score(a) || (num(b.score) || 0) - (num(a.score) || 0));
    function score(e) {
      const t = e.title.toLowerCase(), n = (e.entity || '').toLowerCase();
      let s = 0;
      for (const w of words) { if (t.startsWith(w)) s += 6; if (t.includes(w)) s += 3; if (n.includes(w)) s += 2; }
      return s;
    }
    if (ranked.length) {
      groups.push({ title: 'Top hit', items: [paletteReport(ranked[0])] });
      if (ranked.length > 1) groups.push({ title: `Reports (${fmtInt(ranked.length)})`, items: ranked.slice(1, 7).map(paletteReport) });
    }
    const pageHits = pages.filter(p => words.every(w => `${p.label} ${p.detail}`.toLowerCase().includes(w)));
    if (pageHits.length) groups.push({ title: 'Pages', items: pageHits });
    const actionHits = actions.filter(a => words.every(w => `${a.label} ${a.detail}`.toLowerCase().includes(w)));
    if (actionHits.length) groups.push({ title: 'Actions', items: actionHits });
    /* Nothing matched every word: offer the nearest titles rather than a dead end. */
    if (!groups.length) {
      const near = state.entries
        .map(e => ({ e, hits: words.filter(w => e._hay.includes(w)).length }))
        .filter(x => x.hits)
        .sort((x, y) => y.hits - x.hits || (num(y.e.score) || 0) - (num(x.e.score) || 0))
        .slice(0, 3).map(x => paletteReport(x.e));
      const fallback = near.length ? near : sortList(state.entries, 'score').slice(0, 3).map(paletteReport);
      if (fallback.length) {
        groups.push({
          title: `No match for “${query.trim()}”.`,
          note: near.length ? 'The closest titles in the library:' : 'Nothing came close. The highest rated reports:',
          items: fallback
        });
      }
    }
    return groups;
  }
  const paletteReport = e => ({ label: e.title, detail: `${e.category || ''} · ${fmtScore(e.score)} out of 10 · ${agreementLine(e)}`, url: reportURL(e.id), entry: e });

  function renderPalette() {
    const input = $('#palette-input');
    const list = $('#palette-list');
    if (!input || !list) return;
    const groups = paletteItems(input.value);
    const flat = [];
    const html = groups.map(g => {
      const items = g.items.map(item => {
        const i = flat.push(item) - 1;
        return `<li class="palette-opt" role="option" id="palette-option-${i}" data-palette-index="${i}" aria-selected="false"><span><b>${esc(item.label)}</b><small>${esc(item.detail || '')}</small></span>${item.entry ? profile(item.entry, 'sm') : ''}</li>`;
      }).join('');
      return `<li role="presentation" class="palette-group">${esc(g.title)}${g.note ? `<span class="palette-note">${esc(g.note)}</span>` : ''}</li>${items}`;  /* the note is its own block */
    }).join('');
    state.palette.items = flat;
    state.palette.index = 0;
    list.innerHTML = flat.length ? html : `<li role="presentation" class="palette-empty">No match for “${esc(input.value.trim())}”, and the library is empty. Try the <a href="#index">library</a>.</li>`;
    updatePalette();
  }
  function updatePalette() {
    const input = $('#palette-input');
    const items = state.palette.items;
    for (const option of $$('#palette-list [role="option"]')) {
      const on = Number(option.dataset.paletteIndex) === state.palette.index;
      option.setAttribute('aria-selected', String(on));
    }
    if (input) {
      if (items.length) input.setAttribute('aria-activedescendant', `palette-option-${state.palette.index}`);
      else input.removeAttribute('aria-activedescendant');
    }
  }
  function openPalette() {
    const dialog = $('#palette');
    const input = $('#palette-input');
    if (!dialog || dialog.open) return;
    renderPalette();
    showDialog(dialog);
    if (input) { input.focus(); input.select(); }
  }
  function runPaletteItem(item) {
    if (!item) return;
    $('#palette')?.close();
    if (item.run) { item.run(); return; }
    if (item.url) location.hash = item.url;
  }

  /* The sheet is the reading list: what you were in the middle of, then what is
     waiting, then what you finished. Removing is explicit, keeps focus on the list
     and can be undone until the sheet closes. */
  let lastUnqueued = null;
  /* Every item reads in the same unit as the footer total: minutes left, not the
     whole length of the report. A progress bar is drawn whenever there is any
     progress to draw. */
  function queueItemHTML(entry, index, total) {
    const r = record(entry.id);
    const going = inProgress(entry);
    const say = r.read ? 'Marked as read'
      : going ? `${r.progress}% read · about ${plural(minutesLeft(entry), 'minute')} left`
        : `about ${plural(minutesLeft(entry), 'minute')} left`;
    return `<li class="queue-item" data-report-id="${esc(entry.id)}" aria-posinset="${index + 1}" aria-setsize="${total}">
<a href="${reportURL(entry.id)}">${esc(entry.title)}</a>
${r.read ? '' : `<div class="bar"><span style="--p:${r.progress}%"></span></div>`}
<p class="queue-row"><span class="queue-meta">${esc(say)}</span><span class="qrow-tools">
<button type="button" class="qrow-move" data-action="queue-up" data-id="${esc(entry.id)}" aria-label="Move ${esc(entry.title)} up the queue"${index === 0 ? ' disabled' : ''}><span aria-hidden="true">▲</span></button>
<button type="button" class="qrow-move" data-action="queue-down" data-id="${esc(entry.id)}" aria-label="Move ${esc(entry.title)} down the queue"${index === total - 1 ? ' disabled' : ''}><span aria-hidden="true">▼</span></button>
${queueButton(entry)}</span></p>
</li>`;
  }
  function renderQueue() {
    const body = $('#queue-body');
    const foot = $('#queue-foot');
    if (!body || !foot) return;
    /* One list in the reader's own order, so "move up" means what it says. */
    const saved = queuedList();
    const minutes = saved.filter(e => !record(e.id).read).reduce((a, e) => a + minutesLeft(e), 0);
    body.innerHTML = saved.length
      ? `<ol class="queue-list">${saved.map((e, i) => queueItemHTML(e, i, saved.length)).join('')}</ol>`
      : `<div class="state queue-empty"><p class="queue-glyph" aria-hidden="true">☆</p><h3>Your queue is empty.</h3><p>Save a report with the bookmark control on any row, and it will wait for you here. It stays in this browser.</p><a class="button button-primary" href="#index" data-close>Browse the library</a></div>`;
    const totals = saved.length
      ? `${plural(saved.length, 'report')}${minutes ? ` · about ${plural(minutes, 'minute')} left` : ''}`
      : 'Nothing saved yet';
    foot.innerHTML = `<span class="queue-total">${esc(totals)}</span>${lastUnqueued && state.byId.has(lastUnqueued.id) ? '<button type="button" class="button button-quiet" data-queue="undo">Undo remove</button>' : ''}<a class="button" href="#queue" data-close>Open as a page</a><button type="button" class="button" data-action="export">Export</button>`;
  }
  function openQueue() {
    lastUnqueued = null;
    renderQueue();
    showDialog($('#queue'));
  }
  /* Both listeners are attached once, to elements index.html already holds. The one
     on the body runs in the capture phase, before the document handler that actually
     toggles the record, so it can still see what is about to be removed. */
  $('#queue-body')?.addEventListener('click', event => {
    const button = event.target.closest('[data-action="queue"]');
    if (!button || !record(button.dataset.id).queued) return;
    const rows = $$('#queue-body [data-report-id]');
    const at = Math.max(0, rows.findIndex(li => li.dataset.reportId === button.dataset.id));
    lastUnqueued = { id: button.dataset.id, at };
    setTimeout(() => {
      const links = $$('#queue-body [data-report-id] a');
      const next = links[Math.min(at, links.length - 1)];
      (next || $('#queue-foot [data-queue="undo"]') || $('#queue [data-close]'))?.focus();
    }, 0);
  }, true);
  $('#queue-foot')?.addEventListener('click', event => {
    if (!event.target.closest('[data-queue="undo"]') || !lastUnqueued) return;
    const entry = state.byId.get(lastUnqueued.id);
    lastUnqueued = null;
    if (!entry) return;
    setRecord(entry.id, { queued: true });
    announce(`${entry.title} is back in your reading queue.`);
    $(`#queue-body [data-report-id="${CSS.escape(entry.id)}"] a`)?.focus();
  });
  /* ⌘↵ saves the selected report without leaving the keyboard. The listener sits on
     the field itself, so it runs before the document handler that owns Enter. */
  $('#palette-input')?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    event.stopPropagation();
    const entry = (state.palette.items[state.palette.index] || {}).entry;
    if (!entry) { announce('Select a report to save it to your queue.'); return; }
    const on = !record(entry.id).queued;
    setRecord(entry.id, { queued: on });
    announce(on ? `Saved ${entry.title} to your reading queue.` : `Removed ${entry.title} from your reading queue.`);
  });
  function showDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.documentElement.classList.add('has-dialog');
  }

  /* --------------------------------------------- 9. Reading actions and progress */
  function setRecord(id, change) {
    const next = { ...record(id), ...change };
    /* A report joins the end of the queue when it is saved, so the order the
       reader sets with the move controls has something to start from. */
    if (change.queued === true && !Number.isFinite(Number(next.order))) {
      const orders = Object.values(state.reading).map(r => Number(r && r.order)).filter(Number.isFinite);
      next.order = orders.length ? Math.max(...orders) + 1 : 0;
    }
    state.reading[id] = next;
    saveReading();
    updateReadingControls(id);
  }
  function updateReadingControls(id) {
    const scope = id ? `[data-id="${CSS.escape(id)}"]` : '[data-id]';
    for (const button of $$(`[data-action="queue"]${scope}`)) {
      const entry = state.byId.get(button.dataset.id);
      if (!entry) continue;
      const on = record(entry.id).queued;
      button.setAttribute('aria-pressed', String(on));
      if (button.dataset.labelled === 'text') button.textContent = on ? 'In queue' : 'Add to queue';
      else button.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${entry.title} ${on ? 'from' : 'to'} your reading queue`);
    }
    for (const button of $$(`[data-action="read"]${scope}`)) {
      const entry = state.byId.get(button.dataset.id);
      if (!entry) continue;
      const on = record(entry.id).read;
      button.setAttribute('aria-pressed', String(on));
      if (button.dataset.labelled === 'text') button.textContent = on ? 'Read' : 'Mark as read';
    }
    for (const label of $$('[data-reading-label]')) {
      const who = label.dataset.readingLabel;
      if (id && who !== id) continue;
      label.textContent = readingLabel(who);
      const row = label.closest('[data-report-id]');
      if (row) row.classList.toggle('read', record(who).read);
    }
    for (const glyph of $$('[data-reading-glyph]')) {
      if (id && glyph.dataset.readingGlyph !== id) continue;
      glyph.textContent = readingGlyph(glyph.dataset.readingGlyph);
    }
    const badge = $('#queue-count');
    if (badge) {
      const n = state.entries.filter(e => record(e.id).queued).length;
      badge.textContent = String(n);
      badge.hidden = n === 0;
      const tool = $('#open-queue');
      if (tool) tool.setAttribute('aria-label', n ? `Open your reading queue, ${plural(n, 'report')} saved` : 'Open your reading queue');
    }
    if ($('#queue')?.open) renderQueue();
  }

  function exportReading() {
    const value = { schemaVersion: 1, exportedAt: new Date().toISOString(), records: state.reading, preferences: validPrefs(state.prefs) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `parallax-reading-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Reading data exported.');
  }
  async function importReading(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a reading-data file smaller than 1 MB. Nothing was imported.');
      const imported = JSON.parse(await file.text());
      if (!imported || imported.schemaVersion !== 1 || !imported.records || typeof imported.records !== 'object' || Array.isArray(imported.records)) {
        throw new Error('That is not a Parallax reading-data export (schema version 1). Nothing was imported.');
      }
      const records = Object.entries(imported.records);
      for (const [, item] of records) if (!isShaped(item)) throw new Error('The reading data contains invalid values. Nothing was imported.');
      let known = 0;
      for (const [id, item] of records) {
        state.reading[id] = { ...item, queued: item.queued, read: item.read, progress: clamp(Math.round(item.progress), 0, 100) };
        if (state.byId.has(id)) known++;
      }
      state.prefs = { ...state.prefs, ...validPrefs(imported.preferences) };
      applyPrefs();
      savePrefs();
      saveReading();
      updateReadingControls();
      if (state.route.name === 'settings') renderSettings();
      announce(`Imported reading data: ${plural(records.length, 'record')}, ${fmtInt(known)} of them in this edition.`);
    } catch (error) {
      announce(error instanceof SyntaxError ? 'That file is not valid JSON. Nothing was imported.' : error.message);
    }
    event.target.value = '';
  }
  function clearReading() {
    state.reading = Object.create(null);
    saveReading();
    updateReadingControls();
    if (state.route.name === 'settings') renderSettings();
    announce('Reading data cleared from this browser.');
  }

  /* Progress is measured over the prose only, with an IntersectionObserver, so a jump
     from the contents or a deep link can never inflate it. A block counts once it has
     actually come into view. */
  function observeProgress(entry) {
    stopProgress();
    const body = $('#report-body');
    if (!body || typeof IntersectionObserver !== 'function') return;
    const blocks = $$('p, li, h3, table, blockquote, pre', body);
    if (!blocks.length) return;
    state.progress = { io: null, seen: new Set(), total: blocks.length, id: entry.id };
    const io = new IntersectionObserver(items => {
      let changed = false;
      for (const item of items) {
        if (!item.isIntersecting) continue;
        state.progress.seen.add(item.target.dataset.block);
        io.unobserve(item.target);
        changed = true;
      }
      if (changed) commitProgress();
    }, { rootMargin: '0px 0px -25% 0px', threshold: 0 });
    blocks.forEach((block, i) => { block.dataset.block = String(i); io.observe(block); });
    state.progress.io = io;
    commitProgress();
  }
  function stopProgress() {
    if (state.progress.io) state.progress.io.disconnect();
    state.progress = { io: null, seen: null, total: 0, id: '' };
  }
  function commitProgress() {
    const p = state.progress;
    if (!p.id || !p.total) return;
    const measured = Math.round((p.seen.size / p.total) * 100);
    const kept = record(p.id).progress;
    const value = Math.max(kept, measured);
    paintProgress(p.id, value);
    if (value !== kept) {
      state.reading[p.id] = { ...record(p.id), progress: value };
      clearTimeout(commitProgress.timer);
      commitProgress.timer = setTimeout(saveReading, 300);
    }
  }
  function paintProgress(id, value) {
    const label = $('#progress-label');
    if (label) label.textContent = `${value}% read`;
    const bar = $('#report-progress');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(value));
      const fill = $('span', bar);
      if (fill) fill.style.setProperty('--p', `${value}%`);
    }
    const resume = $(`[data-action="resume"][data-id="${CSS.escape(id)}"]`);
    if (resume) resume.hidden = !(value >= 5 && value < 97 && !record(id).read);
  }
  function resumeReading(id) {
    const body = $('#report-body');
    if (!body) return;
    const blocks = $$('[data-block]', body);
    const target = blocks[clamp(Math.floor((record(id).progress / 100) * blocks.length), 0, Math.max(blocks.length - 1, 0))];
    if (target) target.scrollIntoView({ block: 'center', behavior: motionReduced() ? 'instant' : 'smooth' });
  }

  /* ------------------------------------------------- 10. Router, focus, transitions */
  const ROUTE_NAMES = ['index', 'queue', 'report', 'sources', 'editions', 'method', 'settings'];
  const TITLES = { index: 'Library', queue: 'Reading queue', sources: 'Source ledger', editions: 'Editions', method: 'Method', settings: 'Settings', missing: 'Not found' };
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    let name = parts[0] || 'index', id = '', anchor = '';
    if (name === 'discover' || name === 'library') name = 'index';
    try { id = decodeURIComponent(parts[1] || ''); anchor = decodeURIComponent(parts.slice(2).join('/')); }
    catch (_) { name = 'missing'; }
    return { name, id, anchor };
  }
  const isList = name => name === 'index' || name === 'queue';

  function transition(update, prev, next) {
    const animate = state.booted && typeof document.startViewTransition === 'function' && !motionReduced();
    if (!animate) { update(); return; }
    const opening = isList(prev.name) && next.name === 'report';
    const row = opening ? document.querySelector(`[data-report-id="${CSS.escape(next.id)}"] .row-link`) : null;
    if (row) row.style.viewTransitionName = 'report-title';
    const t = document.startViewTransition(() => {
      if (row) row.style.viewTransitionName = '';
      update();
      const hero = $('#app .report-hero h1');
      if (opening && hero) hero.style.viewTransitionName = 'report-title';
    });
    t.finished.catch(() => {}).finally(() => { for (const el of $$('[style*="view-transition-name"]')) el.style.viewTransitionName = ''; });
  }
  function focusAfterRoute(prev, next) {
    if (next.anchor) return;
    requestAnimationFrame(() => {
      if (prev.name === 'report' && isList(next.name)) {
        const link = document.querySelector(`[data-report-id="${CSS.escape(prev.id)}"] .row-link`);
        if (link) { link.focus({ preventScroll: true }); return; }
      }
      const heading = $('#app h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    });
  }
  function scrollToAnchor(anchor) {
    const target = document.getElementById(anchor);
    if (!target) return false;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    return true;
  }
  function route() {
    if (!state.meta) return;
    const prev = state.route;
    const next = parseRoute();
    if (next.name === 'report' && prev.name === 'report' && next.id === prev.id && state.activeReport) {
      state.route = next;
      if (next.anchor) scrollToAnchor(next.anchor);
      return;
    }
    if (isList(prev.name)) state.listScroll = window.scrollY;
    const token = ++state.routeToken;
    const first = !state.booted;
    const update = () => {
      state.route = next;
      state.activeReport = null;
      stopProgress();
      if (!isList(next.name)) state.listShown = PAGE.reports;
      document.body.dataset.route = ROUTE_NAMES.includes(next.name) ? next.name : 'missing';
      for (const link of $$('a[data-nav]')) {
        const on = link.dataset.nav === next.name || (link.dataset.nav === 'index' && (next.name === 'report' || next.name === 'queue'));
        if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      }
      for (const dialog of $$('dialog[open]')) dialog.close();
      app.setAttribute('aria-busy', 'true');
      if (isList(next.name)) { renderLibrary(); app.setAttribute('aria-busy', 'false'); }
      else if (next.name === 'report') renderReport(next, token);
      else if (next.name === 'sources') { renderSources(token); app.setAttribute('aria-busy', 'false'); }
      else if (next.name === 'editions') renderEditions(token);
      else if (next.name === 'method') { renderMethod(); app.setAttribute('aria-busy', 'false'); }
      else if (next.name === 'settings') { renderSettings(); app.setAttribute('aria-busy', 'false'); }
      else { renderMissing('page'); app.setAttribute('aria-busy', 'false'); }
      const entry = next.name === 'report' ? state.byId.get(next.id) : null;
      document.title = entry ? `${entry.entity || entry.title} · Parallax` : `${TITLES[next.name] || 'Not found'} · Parallax · AI Observatory`;
      const bar = $('#readbar');
      if (bar) { bar.hidden = next.name !== 'report'; bar.style.setProperty('--p', '0'); }
      updateReadingControls();
      measureChrome();
      if (!next.anchor) window.scrollTo({ top: isList(next.name) && prev.name === 'report' ? state.listScroll : 0, behavior: 'instant' });
    };
    transition(update, prev, next);
    if (!first) focusAfterRoute(prev, next);
    state.booted = true;
  }

  /* The stuck chrome is measured, never guessed: focus and anchors have to clear it. */
  function measureChrome() {
    const root = document.documentElement;
    const masthead = $('#masthead');
    const toolbar = $('#report-filters .toolbar');
    const head = masthead ? masthead.getBoundingClientRect().height : 0;
    const bar = toolbar ? toolbar.getBoundingClientRect().height : 0;
    root.style.setProperty('--chrome-h', `${Math.round(head)}px`);
    root.style.setProperty('--toolbar-h', `${Math.round(bar)}px`);
    root.style.setProperty('--stack-h', `${Math.round(head + bar + (bar ? 40 : 0))}px`);
    state.docH = document.documentElement.scrollHeight;
  }

  /* ------------------------------------------------------------------ 11. Events */
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close], [data-close-dialog]');
    if (close) close.closest('dialog')?.close();

    const option = event.target.closest('#palette-list [data-palette-index]');
    if (option) { runPaletteItem(state.palette.items[Number(option.dataset.paletteIndex)]); return; }

    const star = event.target.closest('[data-sky]');
    if (star) { selectStar(Number(star.dataset.sky)); location.hash = reportURL(state.sky.stars[Number(star.dataset.sky)].entry.id); return; }

    /* In-report jumps replace the history entry, so one Back press always leaves. */
    const link = event.target.closest('a[href^="#report/"]');
    if (link && state.route.name === 'report') {
      const parts = link.getAttribute('href').replace(/^#\/?/, '').split('/');
      if (decodeURIComponent(parts[1] || '') === state.route.id && parts[2]) {
        event.preventDefault();
        const anchor = decodeURIComponent(parts.slice(2).join('/'));
        history.replaceState(null, '', link.getAttribute('href'));
        state.route = { ...state.route, anchor };
        scrollToAnchor(anchor);
        return;
      }
    }

    const action = event.target.closest('[data-action]');
    if (!action || !state.meta) return;
    const id = action.dataset.id;
    switch (action.dataset.action) {
      case 'queue': {
        const on = !record(id).queued;
        setRecord(id, { queued: on });
        announce(on ? 'Saved to your reading queue.' : 'Removed from your reading queue.');
        relistAfterReadingChange(id);
        break;
      }
      case 'read': {
        const on = !record(id).read;
        setRecord(id, on ? { read: true, progress: 100 } : { read: false, progress: 0 });
        announce(on ? 'Marked as read.' : 'Marked as unread.');
        paintProgress(id, record(id).progress);
        relistAfterReadingChange(id);
        break;
      }
      case 'queue-up': moveQueued(id, -1); break;
      case 'queue-down': moveQueued(id, 1); break;
      case 'resume': resumeReading(id); break;
      case 'glance': openGlance(); break;
      case 'more': showMore(); break;
      case 'export': exportReading(); break;
      case 'clear-reading': clearReading(); break;
      case 'reset-filters':
        Object.assign(state.filters, { q: '', category: '', min: '', reading: '', sort: 'latest' });
        state.listShown = PAGE.reports;
        if ($('#report-filters')) { syncFilterForm(); renderReportList(); refreshChipCounts(); }
        else renderLibrary();
        $('#report-search')?.focus();
        break;
      case 'sky-table':
        state.sky.table = !state.sky.table;
        renderLibrary();
        $('[data-action="sky-table"]')?.focus();
        break;
      case 'sky-sort': {
        const key = action.dataset.sort;
        state.sky.dir = state.sky.sort === key ? -state.sky.dir : (key === 'title' ? 1 : -1);
        state.sky.sort = key;
        renderLibrary();
        $(`[data-action="sky-sort"][data-sort="${key}"]`)?.focus();
        break;
      }
      case 'more-sources': state.sourceShown += PAGE.sources; renderSourceList(); break;
      default: break;
    }
  });

  document.addEventListener('input', event => {
    const target = event.target;
    if (target.id === 'report-search') { state.filters.q = target.value; state.listShown = PAGE.reports; debouncedList(); return; }
    if (target.id === 'source-search') { state.sourceFilters.q = target.value; state.sourceShown = PAGE.sources; debouncedSources(); return; }
    if (target.id === 'palette-input') { renderPalette(); return; }
    if (target.form && target.form.id === 'report-filters' && target.name in state.filters) {
      /* Only the list is rewritten. Replacing the whole view took the focused
         chip or menu out of the DOM with it, so focus fell to <body> and a
         second arrow key scrolled the page instead of moving along the group. */
      state.filters[target.name] = target.value;
      state.listShown = PAGE.reports;
      renderReportList();
      refreshChipCounts();
      return;
    }
    if (target.form && target.form.id === 'source-filters' && target.name in state.sourceFilters) {
      state.sourceFilters[target.name] = target.value;
      state.sourceShown = PAGE.sources;
      renderSourceList();
      return;
    }
    if (target.form && target.form.id === 'preferences') setPref(target.name, target.value);
  });
  const debouncedList = debounce(() => { renderReportList(); refreshChipCounts(); }, 120);
  /* Put the form's controls back in step with the filter state without touching
     the elements the reader may be standing on. */
  function syncFilterForm() {
    const form = $('#report-filters');
    if (!form) return;
    const search = $('#report-search');
    if (search) search.value = state.filters.q;
    for (const select of $$('select', form)) if (select.name in state.filters) select.value = state.filters[select.name];
    for (const radio of $$('input[type="radio"]', form)) {
      if (!(radio.name in state.filters)) continue;
      radio.checked = radio.value === String(state.filters[radio.name] || '');
      radio.disabled = false;
    }
  }
  /* Marking or saving a report can take its own row out of a filtered list. The
     list is rewritten, not the view, and focus returns to the same control if it
     survived — otherwise to the one thing that is certainly still there. */
  function relistAfterReadingChange(id) {
    if (state.route.name === 'queue') { renderQueuePage(); $(`[data-action="queue"][data-id="${CSS.escape(id)}"]`)?.focus(); return; }
    if (!state.filters.reading || !$('#report-list')) return;
    const held = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id === id;
    renderReportList();
    refreshChipCounts();
    if (!held) return;
    ($(`[data-action="queue"][data-id="${CSS.escape(id)}"]`) || $('#report-search'))?.focus();
  }
  const debouncedSources = debounce(() => renderSourceList(), 120);
  function refreshChipCounts() {
    const form = $('#report-filters');
    if (!form) return;
    const lensBase = filtered({ skip: 'reading' });
    const catBase = filtered({ skip: 'category' });
    const catCounts = new Map();
    for (const e of catBase) catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1);
    for (const input of $$('input[name="category"]', form)) {
      const n = input.value ? catCounts.get(input.value) || 0 : catBase.length;
      const chip = input.closest('.chip');
      const cell = chip && $('.chip-n', chip);
      if (cell) cell.textContent = fmtInt(n);
      if (input.value) input.disabled = n === 0 && input.value !== state.filters.category;
    }
    for (const input of $$('input[name="reading"]', form)) {
      const n = lensBase.filter(e => matchesLens(e, input.value)).length;
      const chip = input.closest('.chip');
      const cell = chip && $('.chip-n', chip);
      if (cell) cell.textContent = fmtInt(n);
      if (input.value) input.disabled = n === 0 && input.value !== state.filters.reading;
    }
  }

  document.addEventListener('change', event => {
    if (event.target.id === 'reading-import') importReading(event);
  });
  document.addEventListener('submit', event => { if (event.target.closest('form')) event.preventDefault(); });

  document.addEventListener('keydown', event => {
    const target = event.target;
    const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (state.meta) openPalette();
      return;
    }
    if (target.id === 'palette-input') {
      const items = state.palette.items;
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
        event.preventDefault();
        state.palette.index = (state.palette.index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        updatePalette();
        $(`#palette-option-${state.palette.index}`)?.scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runPaletteItem(items[state.palette.index]);
      }
      return;
    }
    if (target.id === 'sky-plot') {
      const keys = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };
      if (keys[event.key]) { event.preventDefault(); moveSky(keys[event.key][1], keys[event.key][0]); return; }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const star = state.sky.stars[state.sky.index];
        if (star) location.hash = reportURL(star.entry.id);
        return;
      }
    }
    if (event.key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey && !$('dialog[open]')) {
      event.preventDefault();
      const search = $('#report-search') || $('#source-search');
      if (search) { search.focus(); search.select(); }
      else { location.hash = '#index'; requestAnimationFrame(() => requestAnimationFrame(() => $('#report-search')?.focus())); }
      return;
    }
    if (event.key === 'Escape' && editing && (target.type === 'search' || target.type === 'text') && target.value && target.id !== 'palette-input') {
      event.preventDefault();
      target.value = '';
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  $('#open-palette')?.addEventListener('click', () => { if (state.meta) openPalette(); });
  $('#open-queue')?.addEventListener('click', () => { if (state.meta) openQueue(); });
  document.addEventListener('mousemove', event => {
    const option = event.target.closest && event.target.closest('#palette-list [data-palette-index]');
    if (option && Number(option.dataset.paletteIndex) !== state.palette.index) {
      state.palette.index = Number(option.dataset.paletteIndex);
      updatePalette();
    }
  });
  document.addEventListener('pointerover', event => {
    const star = event.target.closest && event.target.closest('[data-sky]');
    if (star) selectStar(Number(star.dataset.sky));
  });
  document.addEventListener('focusin', event => {
    if (event.target.id === 'sky-plot') selectStar(state.sky.index);
  });
  for (const dialog of $$('dialog')) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => document.documentElement.classList.remove('has-dialog'));
  }
  document.addEventListener('toggle', event => {
    if (event.target.matches && event.target.matches('[data-plot]')) setPref('plot', event.target.open ? 'open' : 'closed');
  }, true);
  $('[data-skip]')?.addEventListener('click', () => { const main = $('#main'); main?.focus(); });
  window.addEventListener('hashchange', route);
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const bar = $('#readbar');
      if (bar && !bar.hidden) {
        const span = Math.max(1, state.docH - innerHeight);
        bar.style.setProperty('--p', clamp(scrollY / span, 0, 1).toFixed(3));
      }
      document.body.classList.toggle('stuck', scrollY > 8);
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener('resize', debounce(measureChrome, 150), { passive: true });
  window.addEventListener('pagehide', () => { if (state.meta) saveReading(); });
  window.addEventListener('storage', event => {
    if (event.key !== STORE.reading || !state.meta) return;
    state.reading = readReading();
    updateReadingControls();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs);

  /* ================================================================================
     12. THE VIEWS
     12a shared pieces (the sanitiser, the two reading toggles), 12b the reading view,
     12c the ledger, the observing log, the method page and the settings. Every one of
     them renders from the data the catalogue already holds, paints immediately, and
     fills in whatever needs a second file once it arrives.
     ================================================================================ */

  function sanitise(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const allowed = new Set(['P', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BR']);
    const visit = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        if (!allowed.has(child.tagName)) { child.remove(); continue; }
        const href = child.tagName === 'A' ? safeURL(child.getAttribute('href')) : '';
        for (const attribute of [...child.attributes]) child.removeAttribute(attribute.name);
        if (href) { child.setAttribute('href', href); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
        visit(child);
      }
    };
    visit(parsed.body);
    /* Every sanitised table becomes a labelled, keyboard-reachable scroll region. */
    for (const table of [...parsed.body.querySelectorAll('table')]) {
      const wrap = parsed.createElement('div');
      wrap.className = 'table-wrap';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', 'Table, scrollable');
      table.replaceWith(wrap);
      wrap.append(table);
    }
    return parsed.body.innerHTML;
  }

  const actionButton = (action, entry, primary) => {
    const on = record(entry.id)[action === 'queue' ? 'queued' : 'read'];
    const label = action === 'queue' ? (on ? 'In queue' : 'Add to queue') : (on ? 'Read' : 'Mark as read');
    return `<button type="button" class="button${primary && !on ? ' button-primary' : ''}" data-action="${action}" data-id="${esc(entry.id)}" data-labelled="text" aria-pressed="${on}">${esc(label)}</button>`;
  };

  /* ==================================================================================
     12b. THE READING VIEW  —  #report/<id> and #report/<id>/<anchor>

     Header → at a glance → prose → ratings → bibliography. The verdict and the
     shape of the rating are on the first screen; the long form is the evidence
     behind them. Everything is painted from the catalogue entry at once, so the
     route is never blank, and the parts that only exist in reports/<id>.json —
     the prose, the use cases, the limits, the rationale and the bibliography —
     arrive as skeletons and fill in.

     Progress is measured by observeProgress over #report-body and nothing else,
     so a contents link or a deep link can never inflate it. Contents links are
     #report/<id>/<anchor>, which the global click handler turns into a
     replaceState, so one Back press still lands on the library.
     ================================================================================== */

  let tocIO = null;
  /* One destination, one name: the contents entry and the heading it lands on
     are the same words. The old build called this place two different things. */
  const RATINGS_TITLE = 'Two readings, five dimensions';
  const SOURCES_TITLE = 'Sources and research notes';

  /* A rating is a position on the rubric's own 1–10 scale, so the gauge starts
     at 1 and may not be truncated. (The library bar is a length, so it starts
     at zero. Both are stated on Method.) */
  const scalePct = v => `${clamp((((num(v) === null ? 1 : num(v)) - 1) / 9) * 100, 0, 100).toFixed(2)}%`;
  const spanPct = (lo, hi) => `${clamp(((hi - lo) / 9) * 100, 0, 100).toFixed(2)}%`;
  const fmtVal = v => (num(v) === null ? '–' : Number.isInteger(num(v)) ? String(num(v)) : num(v).toFixed(1));
  const shortHash = value => (typeof value === 'string' && value.length > 12 ? `${value.slice(0, 12)}…` : value || 'Not established');
  const isRunA = review => /_a\d*$/.test(String((review && review.reviewerId) || ''));
  const runMean = review => {
    const values = DIMENSIONS.map(d => num((review.scores || {})[d.key])).filter(v => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const normURL = value => { try { const u = new URL(String(value)); return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`; } catch (_) { return ''; } };

  /* Run A is the caret above the rail, run B the caret below it; they fuse into
     a closed hourglass where the two runs agree. The tinted band is the only
     chroma in the mark and it only ever means "the runs differ here". */
  function gaugeHTML(d, small) {
    const cls = `g-scale${small ? ' sm' : ''}`;
    if (d.a === null || d.mean === null) return `<div class="${cls}" aria-hidden="true"><span class="g-rail"></span></div>`;
    const lo = Math.min(d.a, d.b), hi = Math.max(d.a, d.b);
    return `<div class="${cls}" aria-hidden="true"><span class="g-rail"></span><span class="g-ticks"></span>${d.differs ? `<span class="g-span" style="--plo:${scalePct(lo)};--pspan:${spanPct(lo, hi)}"></span><span class="g-m" style="--pm:${scalePct(d.mean)}"></span>` : ''}<span class="g-a" style="--p:${scalePct(d.a)}"></span><span class="g-b" style="--p:${scalePct(d.b)}"></span></div>`;
  }
  function dimState(d, two) {
    if (d.a === null) return { both: 'Not established', a: 'Not established', b: 'Not established' };
    const a = `Run A ${esc(fmtVal(d.a))}`, b = `Run B ${esc(fmtVal(d.b))}`;
    if (!two) return { both: `One recorded run: ${esc(fmtVal(d.a))}`, a, b: a };
    if (!d.differs) return { both: `Both runs ${esc(fmtVal(d.a))}`, a, b };
    const by = Math.abs(d.a - d.b);
    return { both: `A ${esc(fmtVal(d.a))} · B ${esc(fmtVal(d.b))} · <em>${by === 1 ? 'one point' : `${esc(String(by))} points`} apart</em>`, a, b };
  }
  /* One value, shown three ways: the mean, run A alone, run B alone. The
     vantage control swaps them in CSS; nothing re-renders. */
  const vantageSpans = (both, a, b, tag = 'span') =>
    `<${tag} class="v-both">${both}</${tag}><${tag} class="v-a">${a}</${tag}><${tag} class="v-b">${b}</${tag}>`;

  /* ---------------------------------------------------------------- the header */
  function reportHeadHTML(entry) {
    const sourceCount = entry.sourceCount !== undefined ? entry.sourceCount : (entry.sources || []).length;
    const meta = [
      `${esc(fmtInt(entry.readMinutes || 0))} min read`,
      entry.wordCount ? `${esc(fmtInt(entry.wordCount))} words` : '',
      sourceCount ? esc(plural(sourceCount, 'source')) : '',
      entry.publishedAt ? `Released ${esc(fmtDate(entry.publishedAt))}` : '',
      `Found ${esc(fmtDate(entry.discoveredAt))}`
    ].filter(Boolean);
    return `<header class="report-hero">
  <p class="rkicker">
    <span class="rkicker-cat">${esc(CATEGORY_GLYPH[entry.category] || '◇')} ${esc(entry.category || 'Not established')}</span>
    <span>${esc(CHANGE_LABEL[entry.changeType] || 'Report')}</span>
    ${entry.entity ? `<span>${esc(entry.entity)}</span>` : ''}
  </p>
  <h1>${esc(entry.title)}</h1>
  ${entry.summary ? `<p class="rstandfirst">${esc(entry.summary)}</p>` : ''}
  <p class="rmeta">${meta.map(m => `<span>${m}</span>`).join('')}<span data-reading-label="${esc(entry.id)}">${esc(readingLabel(entry.id))}</span></p>
  <div class="actions">
    ${actionButton('queue', entry, true)}
    ${actionButton('read', entry)}
    ${entry.officialUrl ? external(entry.officialUrl, 'Official source', 'class="textlink"') : ''}
  </div>
</header>`;
  }

  /* ------------------------------------------------------------- at a glance */
  function pointersHTML(items, count, cls, labelledBy) {
    if (Array.isArray(items)) {
      if (!items.length) return '<p class="glance-note">Not established for this report.</p>';
      return `<ul class="pointers ${cls}" aria-labelledby="${labelledBy}">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    }
    const n = clamp(Number(count) || 3, 1, 6);
    return `<div class="sk-block" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="sk ${i % 2 ? 'sk-60' : 'sk-80'}"></div>`).join('')}</div>`;
  }
  function glanceHTML(entry, runs) {
    const mini = runs.dims.map(d => `<div class="mini-row">
      <span class="mini-name">${esc(d.label)}</span>${gaugeHTML(d, true)}<span class="mini-val">${esc(fmtScore(d.mean))}</span>
    </div>`).join('');
    return `<section class="glance card" aria-labelledby="glance-h">
  <div class="glance-top">
    <div class="glance-say">
      <p class="eyebrow" id="glance-h">At a glance</p>
      <p class="glance-judgment">${esc(entry.judgment || 'No editorial judgment is recorded for this report.')}</p>
    </div>
    <div class="glance-marks">
      <p class="glance-score"><b>${esc(fmtScore(entry.score))}</b><span>out of 10</span></p>
      <p class="arith">${esc(arithmetic(entry))}</p>
      <p class="mini-ends" aria-hidden="true"><i><span>1</span><span>10</span></i></p>
      <div class="mini" role="img" aria-label="${esc(`${sentenceCase(runs.dims.map(d => `${d.label.toLowerCase()} ${d.mean === null ? 'not established' : fmtScore(d.mean)}`).join(', '))}. ${agreementSentence(entry)}`)}">${mini}</div>
      <p class="mini-legend" aria-hidden="true">${GAUGE_LEGEND}</p>
      <p class="glance-note">${esc(agreementLine(entry))}.${runs.both ? ` ${esc(HONESTY)}` : ''} <a href="#method">How the ratings work</a>.</p>
    </div>
  </div>
  <div class="glance-cols">
    <div><p class="glance-h" id="try-h">Try it for</p>${pointersHTML(entry.useCases, entry.useCaseCount, 'pointers-try', 'try-h')}</div>
    <div><p class="glance-h" id="limits-h">Know the limits</p>${pointersHTML(entry.limitations, entry.limitationCount, 'pointers-limit', 'limits-h')}</div>
  </div>
</section>`;
  }

  /* The At a glance card is the triage surface, and a report is 15,000px long,
     so it is reachable from anywhere in it. The card itself is moved into the
     dialog and moved back on close: one card, one set of ids, no copy of the
     judgment that could fall out of step with the one above the prose. */
  let glanceSlot = null;
  function glanceDialog() {
    let dialog = $('#glance-pop');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'glance-pop';
    dialog.className = 'glance-pop';
    dialog.setAttribute('aria-label', 'At a glance');
    dialog.innerHTML = `<div class="glance-pop-inner"><div class="glance-pop-head"><button type="button" class="icon-btn" data-close-dialog aria-label="Close at a glance"><svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg></button></div><div class="glance-host"></div></div>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      const card = $('.glance-host > .glance', dialog);
      if (card && glanceSlot && glanceSlot.parentNode) glanceSlot.replaceWith(card);
      glanceSlot = null;
      document.documentElement.classList.remove('has-dialog');
    });
    return dialog;
  }
  function openGlance() {
    const card = $('#app .glance');
    if (!card) return;
    const dialog = glanceDialog();
    glanceSlot = document.createComment('glance');
    card.replaceWith(glanceSlot);
    $('.glance-host', dialog).append(card);
    showDialog(dialog);
    $('[data-close-dialog]', dialog)?.focus();
  }

  /* -------------------------------------------------- the rail: place + contents */
  function railHTML(entry) {
    const rec = record(entry.id);
    const sections = entry.sections || [];
    /* The contents stand open only where they have a column of their own;
       everywhere else they are a disclosure, so the prose starts near the top. */
    const open = typeof matchMedia === 'function' ? matchMedia('(min-width: 74em)').matches : true;
    const link = (anchor, number, title, end) =>
      `<li${end ? ' class="toc-end"' : ''}><a href="${reportURL(entry.id, anchor)}" data-sec="${esc(anchor)}"><span class="toc-n" aria-hidden="true">${number}</span><span>${esc(title)}</span></a></li>`;
    const resumable = rec.progress >= 5 && rec.progress < 97 && !rec.read;
    return `<aside class="rail">
  <div class="rail-place">
    <div class="rail-row"><span class="rail-h">Your place</span><span class="rail-pct" id="progress-label">${rec.progress}% read</span></div>
    <div class="bar" id="report-progress" role="progressbar" aria-labelledby="progress-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rec.progress}"><span style="--p:${rec.progress}%"></span></div>
    <p class="rail-left">${esc(rec.read ? 'Marked as read' : `About ${plural(minutesLeft(entry), 'minute')} left`)}</p>
    <div class="rail-acts">
      <button type="button" class="button button-quiet rail-resume" data-action="resume" data-id="${esc(entry.id)}"${resumable ? '' : ' hidden'}>Resume reading</button>
      <button type="button" class="button button-quiet rail-glance" data-action="glance">At a glance</button>
    </div>
  </div>
  <nav class="toc" data-toc aria-label="Sections of this report">
    <details class="toc-box"${open ? ' open' : ''}>
      <summary class="toc-sum"><span>Contents</span><span class="toc-n-of">${esc(plural(sections.length, 'section'))}</span></summary>
      <ol class="toc-list">
        ${sections.map((s, i) => link(`section-${s.id}`, i + 1, s.title, false)).join('')}
        ${link('ratings', '·', RATINGS_TITLE, true)}
        ${link('sources', '·', SOURCES_TITLE, true)}
      </ol>
    </details>
  </nav>
</aside>`;
  }

  /* ------------------------------------------------------------------ the prose */
  function citedFor(html, sources) {
    if (!Array.isArray(sources) || !sources.length) return [];
    const byKey = new Map();
    for (const s of sources) { const key = normURL(s.url); if (key && !byKey.has(key)) byKey.set(key, s); }
    const out = [], seen = new Set();
    for (const match of String(html).matchAll(/href="([^"]*)"/g)) {
      const source = byKey.get(normURL(match[1].replace(/&amp;/g, '&')));
      if (source && !seen.has(source.url)) { seen.add(source.url); out.push(source); }
    }
    return out;
  }
  /* The margin column carries nothing but links and dates: no p, li, h3, table
     or blockquote, because observeProgress counts those inside #report-body. */
  function citedHTML(sources) {
    if (!sources.length) return '';
    return `<div class="rsec-cited"><span class="cited-h">Cited here</span>${sources.map(s => `<div class="cited-item">${external(s.url, s.title || hostOf(s.url) || 'Source')}<span class="cited-when">${esc(s.accessedAt ? `Accessed ${fmtDate(s.accessedAt)}` : s.publishedAt ? `Published ${fmtDate(s.publishedAt)}` : hostOf(s.url) || 'Date not established')}</span></div>`).join('')}</div>`;
  }
  function proseHTML(entry) {
    const sections = entry.sections || [];
    if (!sections.length) return '<div id="report-body"><div class="state"><h2>This report has no sections.</h2></div></div>';
    const body = sections.map((s, i) => {
      const head = `<div class="rsec-head"><span class="rsec-n" aria-hidden="true">${i + 1}</span><h2>${esc(s.title)}</h2></div>`;
      if (typeof s.html !== 'string') {
        return `<section id="section-${esc(s.id)}" class="rsec">${head}<div class="rsec-prose sk-block" aria-hidden="true"><div class="sk"></div><div class="sk"></div><div class="sk sk-80"></div><div class="sk sk-60"></div></div></section>`;
      }
      const html = sanitise(s.html);
      return `<section id="section-${esc(s.id)}" class="rsec">${head}<div class="rsec-prose">${html}</div>${citedHTML(citedFor(html, entry.sources))}</section>`;
    }).join('');
    return `<div id="report-body">${body}</div>`;
  }

  /* --------------------------------------------------------------- the ratings */
  function reasonsHTML(d, runs) {
    const a = runs.a && runs.a.rationale ? runs.a.rationale[d.key] : '';
    const b = runs.b && runs.b.rationale ? runs.b.rationale[d.key] : '';
    if (!a && !b) return '<div class="sk sk-40" aria-hidden="true"></div>';
    return `<details class="why"${d.differs ? ' open' : ''}>
  <summary>${d.differs ? 'Why the two runs differ' : 'Why this rating'}</summary>
  <div class="g-reasons">
    ${a ? `<div class="g-reason g-reason-a"><span class="g-reason-who">A</span><p>${esc(a)}</p></div>` : ''}
    ${b ? `<div class="g-reason g-reason-b"><span class="g-reason-who">B</span><p>${esc(b)}</p></div>` : ''}
  </div>
</details>`;
  }
  function gaugeRowHTML(d, runs, index) {
    const state = dimState(d, runs.both);
    /* An agreeing dimension is one line: a name, a mark, a number and a
       disclosure. The tall treatment belongs to a contested one. */
    return `<div class="grow${d.differs ? '' : ' g-agree'}" role="row" style="--i:${index}">
  <div class="g-name" role="rowheader"><span class="g-label">${esc(d.label)}</span><span class="g-def">${esc(d.text)}</span></div>
  <div class="g-track" role="cell">${gaugeHTML(d)}</div>
  <div class="g-val" role="cell">${vantageSpans(esc(fmtScore(d.mean)), esc(fmtVal(d.a)), esc(fmtVal(d.b)))}</div>
  <div class="g-why" role="cell"><p class="g-state">${vantageSpans(state.both, state.a, state.b)}</p>${reasonsHTML(d, runs)}</div>
</div>`;
  }
  function facingPageHTML(review, which) {
    if (!review) return `<div class="page page-${which}"><p class="page-h">Run ${which.toUpperCase()}</p><p class="glance-note">No second run is recorded for this report.</p></div>`;
    const concerns = Array.isArray(review.concerns) ? review.concerns.filter(Boolean) : [];
    const mean = runMean(review);
    return `<div class="page page-${which}">
  <p class="page-h">Run ${which.toUpperCase()} <span>· its own mean ${esc(fmtScore(mean))}</span></p>
  <dl class="page-meta">
    <dt>Verdict</dt><dd>${esc(sentenceCase(review.verdict || 'not established'))}</dd>
    <dt>Confidence</dt><dd>${esc(sentenceCase(review.confidence || 'not established'))}</dd>
    <dt>Model</dt><dd>${esc(review.model || 'Not established')}${review.effort ? esc(`, ${review.effort} effort`) : ''}</dd>
    <dt>Recorded</dt><dd>${esc(fmtDate(review.reviewedAt))}</dd>
    <dt>Its ratings</dt><dd class="page-scores">${DIMENSIONS.map(d => `<span>${esc(d.label)} ${esc(fmtVal((review.scores || {})[d.key]))}</span>`).join('')}</dd>
    <dt>Report hash</dt><dd><code>${esc(shortHash(review.reportHash))}</code></dd>
    <dt>Evidence hash</dt><dd><code>${esc(shortHash(review.evidenceHash))}</code></dd>
    <dt>Rubric</dt><dd>${esc(review.rubricVersion || 'Not established')}</dd>
  </dl>
  ${concerns.length ? `<details class="why"><summary>${esc(plural(concerns.length, 'note'))} recorded by this run</summary><ul class="page-concerns">${concerns.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
</div>`;
  }
  function ratingsHTML(entry, runs) {
    /* The widest split reads first: the contested dimension is the news. */
    const dims = [...runs.dims].sort((x, y) => Math.abs((y.a || 0) - (y.b || 0)) - Math.abs((x.a || 0) - (x.b || 0)));
    const a = runs.a && isRunA(runs.a) ? runs.a : runs.b && isRunA(runs.b) ? runs.b : runs.a;
    const b = a === runs.a ? runs.b : runs.a;
    const hasPages = !!(a && a.model);
    return `<section id="ratings" class="ratings card${hasPages ? ' ratings-live' : ''}" aria-labelledby="ratings-h">
  <div class="ratings-top">
    <p class="eyebrow">Ratings</p>
    ${runs.both ? `<div class="segmented" id="vantage" role="radiogroup" aria-label="Which run to show">
      <label class="seg"><input type="radio" name="vantage" id="vantage-both" value="both" checked><span>Both</span></label>
      <label class="seg"><input type="radio" name="vantage" id="vantage-a" value="a"><span>Run A</span></label>
      <label class="seg"><input type="radio" name="vantage" id="vantage-b" value="b"><span>Run B</span></label>
    </div>` : ''}
  </div>
  <h2 class="title-2" id="ratings-h">${RATINGS_TITLE}.</h2>
  <p class="ratings-order">Ordered by the widest split first, so the contested dimension reads first. The card at the top of the report lists the same five in rubric order.</p>
  <div class="ratings-sum">
    <p class="ratings-figure" aria-live="polite">${vantageSpans(esc(fmtScore(entry.score)), esc(fmtScore(a ? runMean(a) : null)), esc(fmtScore(b ? runMean(b) : null)), 'b')}<span>out of 10</span></p>
    <div class="ratings-says">
      <p class="arith">${esc(arithmetic(entry))}</p>
      <p class="agree-say">${esc(agreementSentence(entry))}</p>
      <p class="honesty">${esc(HONESTY)} Ratings are editorial judgments recorded against a published rubric, not benchmark results. <a href="#method">How the ratings work</a>.</p>
    </div>
  </div>
  <div class="gauges" role="table" aria-label="Five dimensions, as run A and run B recorded them">
    <div class="g-head" role="row">
      <span class="sr-only" role="columnheader">Dimension</span>
      <span class="g-axis" role="columnheader" aria-label="Position on the rubric's 1 to 10 scale"><i style="--p:0%">1</i><i style="--p:44.44%">5</i><i>10</i></span>
      <span class="sr-only" role="columnheader">${vantageSpans('Mean of the two runs', 'Run A', 'Run B')}</span>
      <span class="sr-only" role="columnheader">Agreement and reasons</span>
    </div>
    ${dims.map((d, i) => gaugeRowHTML(d, runs, i)).join('')}
  </div>
  <p class="g-legend">
    <span><span class="g-key">▼</span> Run A, above the line</span>
    <span><span class="g-key">▲</span> Run B, below the line</span>
    <span><span class="g-key">▏</span> their mean</span>
    <span><span class="g-key g-key-gap">▭</span> the distance between them</span>
  </p>
  <div class="spread"><p class="spread-h">Each run, in full</p>${hasPages
    ? `${facingPageHTML(a, 'a')}${facingPageHTML(b, 'b')}`
    : `<div class="sk-block" aria-hidden="true"><div class="sk sk-60"></div><div class="sk"></div><div class="sk sk-80"></div></div><div class="sk-block" aria-hidden="true"><div class="sk sk-60"></div><div class="sk"></div><div class="sk sk-80"></div></div>`}</div>
</section>`;
  }

  /* ---------------------------------------------------------- the bibliography */
  function biblioHTML(entry) {
    const sources = entry.sources;
    const list = Array.isArray(sources)
      ? (sources.length
        ? `<ol class="bibliography">${sources.map(s => `<li>
    <div class="cite-body">
      <p class="cite-title">${external(s.url, s.title || hostOf(s.url) || 'Source')}</p>
      <p class="cite-host">${esc(hostOf(s.url) || 'Address not established')}</p>
      ${s.supports ? `<p class="cite-supports">${esc(s.supports)}</p>` : ''}
      ${s.locator ? `<p class="cite-locator">${esc(s.locator)}</p>` : ''}
      <p class="cite-dates"><span>${esc(s.accessedAt ? `Accessed ${fmtDate(s.accessedAt)}` : 'Access date not established')}</span>${s.publishedAt ? `<span>Published ${esc(fmtDate(s.publishedAt))}</span>` : ''}</p>
    </div>
  </li>`).join('')}</ol>`
        : '<p class="glance-note">No sources are recorded for this report.</p>')
      : `<div class="sk-block" aria-hidden="true" style="margin-top:var(--s-6)">${Array.from({ length: clamp(entry.sourceCount || 3, 1, 8) }, () => '<div class="sk sk-80"></div><div class="sk sk-40"></div>').join('')}</div>`;
    return `<section id="sources" class="report-biblio" aria-labelledby="sources-h">
  <div class="biblio-head">
    <h2 class="title-2" id="sources-h">${SOURCES_TITLE}</h2>
    ${entry.researchNote ? `<p class="research-note">${esc(entry.researchNote)}</p>` : ''}
  </div>
  ${list}
</section>`;
  }

  /* ------------------------------------------------------------------ the end
     The old build ended on a control and then a screen of blank scroll. This
     ends on a choice: mark it, keep it, or read the next one in its category. */
  function nextUpHTML(entry) {
    const others = state.entries.filter(e => e.id !== entry.id);
    const rank = (a, b) => (record(a.id).read ? 1 : 0) - (record(b.id).read ? 1 : 0) || (num(b.score) || 0) - (num(a.score) || 0);
    const sameKind = others.filter(e => e.category && e.category === entry.category).sort(rank);
    const picks = sameKind.slice(0, 3);
    for (const e of [...others].sort(rank)) { if (picks.length >= 3) break; if (!picks.includes(e)) picks.push(e); }
    if (!picks.length) return '';
    const where = sameKind.length ? `Read next in ${entry.category.toLowerCase()}` : 'Read next';
    return `<div class="end-next">
    <p class="glance-h" id="next-h">${esc(where)}</p>
    <ul class="end-list" aria-labelledby="next-h">${picks.map(e => `<li><a href="${reportURL(e.id)}">
      <span class="end-title">${esc(e.title)}</span>
      <span class="end-meta">${esc(`${fmtScore(e.score)} out of 10 · ${agreementLine(e)} · ${fmtInt(e.readMinutes || 0)} min read`)}</span>
    </a></li>`).join('')}</ul>
  </div>`;
  }
  function reportEndHTML(entry) {
    return `<footer class="report-end">
  <div class="end-row">
    <p class="eyebrow">End of the report</p>
    <div class="actions">${actionButton('read', entry, true)}${actionButton('queue', entry)}<a class="textlink" href="#index">Back to the library</a></div>
  </div>
  ${nextUpHTML(entry)}
</footer>`;
  }

  /* ------------------------------------------------------------------- render */
  function reportShellHTML(entry, body) {
    if (!entry._runs) entry._runs = runsOf(entry);
    return `<article class="report pane">
${reportHeadHTML(entry)}
${glanceHTML(entry, entry._runs)}
${railHTML(entry)}
${body}
${reportEndHTML(entry)}
</article>`;
  }
  function reportBodyHTML(entry) {
    if (!entry._runs) entry._runs = runsOf(entry);
    return `${proseHTML(entry)}
${ratingsHTML(entry, entry._runs)}
${biblioHTML(entry)}`;
  }

  /* One observer over the sections, the ratings and the bibliography marks the
     place in the contents. It never writes progress: that is observeProgress,
     over the prose alone. */
  function wireReport(entry) {
    const order = (entry.sections || []).map(s => `section-${s.id}`).concat(['ratings', 'sources']);
    const links = new Map($$('.toc-list a[data-sec]').map(a => [a.dataset.sec, a]));
    const targets = order.map(id => document.getElementById(id)).filter(Boolean);
    if (typeof IntersectionObserver === 'function' && targets.length) {
      const inView = new Set();
      tocIO = new IntersectionObserver(items => {
        for (const item of items) { if (item.isIntersecting) inView.add(item.target.id); else inView.delete(item.target.id); }
        const current = order.find(id => inView.has(id));
        for (const [key, link] of links) {
          if (key === current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }, { rootMargin: '-18% 0px -72% 0px', threshold: 0 });
      for (const target of targets) tocIO.observe(target);
    }
    const vantage = $('#vantage');
    if (vantage) vantage.addEventListener('change', event => {
      const said = { both: 'Showing both runs and their mean.', a: 'Showing run A only.', b: 'Showing run B only.' };
      announce(said[event.target.value] || '');
    });
  }

  function renderReport(next, token) {
    const light = state.byId.get(next.id);
    if (tocIO) { tocIO.disconnect(); tocIO = null; }
    if (!light) { renderMissing('report'); app.setAttribute('aria-busy', 'false'); return; }
    /* Paint everything the catalogue already knows, immediately: the route is
       never blank and the layout never jumps when the rest arrives. */
    app.innerHTML = reportShellHTML(light, reportBodyHTML(light));
    measureChrome();
    loadReport(next.id).then(entry => {
      if (token !== state.routeToken) return;
      state.activeReport = entry;
      app.innerHTML = reportShellHTML(entry, reportBodyHTML(entry));
      app.setAttribute('aria-busy', 'false');
      updateReadingControls(entry.id);
      observeProgress(entry);
      wireReport(entry);
      measureChrome();
      if (next.anchor) scrollToAnchor(next.anchor);
    }).catch(() => {
      if (token !== state.routeToken) return;
      if (tocIO) { tocIO.disconnect(); tocIO = null; }
      renderMissing('report');
      app.setAttribute('aria-busy', 'false');
    });
  }

  /* ==================================================================================
     12c. THE LEDGER, THE LOG, THE METHOD AND THE SETTINGS

     Four pages, one question each, answered with recorded facts only:
       #sources   what this project watches, what it reached, what it never opened
       #editions  what each scan did, labelled correctly, with its own limits attached
       #method    how a report earns its place, and what the two runs do not establish
       #settings  how this reads, what is stored here, and when the next scan is due

     They share the reading view's anatomy: a rail of orientation on the left, one
     column of content on the right, the same cards, chips and marks. The rail is the
     only sticky thing these pages add and it lives in its own grid column, so
     measureChrome() still sees --toolbar-h: 0 on every one of them.

     Every listener is attached to the element a render just created, never to #app,
     so a second visit to a route cannot stack a second copy of the same handler.
     ================================================================================== */

  /* ------------------------------------------------------------ shared page parts */
  let pageIO = null;                     /* marks the current section in a page rail */
  const stopPageWiring = () => { if (pageIO) { pageIO.disconnect(); pageIO = null; } };
  const viewRoot = () => app.firstElementChild;

  function pageHeadHTML(o) {
    return `<header class="folio-head">
  <p class="eyebrow">${esc(o.eyebrow)}</p>
  <h1 class="title-1" id="${esc(o.id)}">${esc(o.title)}</h1>
  ${o.lede ? `<p class="lede folio-lede">${o.lede}</p>` : ''}
</header>`;
  }

  /* The rail is a real list of links. Each carries the route in front of the anchor
     (#method/limits), and the click handler below replaces the history entry instead
     of adding one, so one Back press still leaves the page. */
  function pageRailHTML(route, title, items, noun = 'section') {
    const open = typeof matchMedia === 'function' ? matchMedia('(min-width: 74em)').matches : true;
    return `<aside class="rail folio-rail">
  <nav class="toc" aria-label="${esc(title)}">
    <details class="toc-box"${open ? ' open' : ''}>
      <summary class="toc-sum"><span>${esc(title)}</span><span class="toc-n-of">${esc(plural(items.length, noun))}</span></summary>
      <ol class="toc-list">${items.map((it, i) => `<li><a href="#${esc(route)}/${esc(it.id)}" data-jump="${esc(it.id)}"><span class="toc-n" aria-hidden="true">${esc(String(it.n === undefined ? i + 1 : it.n))}</span><span>${esc(it.title)}</span></a></li>`).join('')}</ol>
    </details>
  </nav>
</aside>`;
  }

  /* One click handler and one observer per page: in-page jumps replace the history
     entry, and the rail marks where the reader is, exactly as a report does. */
  function wirePage(route, ids) {
    stopPageWiring();
    const root = viewRoot();
    if (!root) return;
    const links = new Map($$('.folio-rail a[data-jump]', root).map(a => [a.dataset.jump, a]));
    root.addEventListener('click', event => {
      const link = event.target.closest('a[data-jump]');
      if (!link) return;
      event.preventDefault();
      history.replaceState(null, '', link.getAttribute('href'));
      state.route = { ...state.route, id: link.dataset.jump };
      scrollToAnchor(link.dataset.jump);
    });
    const targets = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (typeof IntersectionObserver === 'function' && targets.length && links.size) {
      const inView = new Set();
      pageIO = new IntersectionObserver(items => {
        for (const item of items) { if (item.isIntersecting) inView.add(item.target.id); else inView.delete(item.target.id); }
        const current = ids.find(id => inView.has(id));
        for (const [key, link] of links) {
          if (key === current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
      for (const target of targets) pageIO.observe(target);
    }
    /* A page opened at #<route>/<anchor> lands on that section. */
    const anchor = state.route.name === route ? state.route.id : '';
    if (anchor && ids.includes(anchor)) requestAnimationFrame(() => scrollToAnchor(anchor));
  }

  /* A length encoding, drawn from zero, with its number beside it. */
  const pct = (n, max) => `${clamp(max > 0 ? (Number(n) / max) * 100 : 0, 0, 100).toFixed(2)}%`;

  /* Relative time, with the recorded timestamp kept in the element's title. */
  const relFmt = (() => { try { return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }); } catch (_) { return null; } })();
  function relWhen(value) {
    const d = new Date(value);
    if (!value || !Number.isFinite(d.getTime())) return '';
    if (!relFmt) return fmtDate(value);
    const days = Math.round((d.getTime() - Date.now()) / 86400000);
    if (Math.abs(days) < 1) return relFmt.format(0, 'day');
    if (Math.abs(days) < 45) return relFmt.format(days, 'day');
    return relFmt.format(Math.round(days / 30), 'month');
  }
  const whenHTML = (value, prefix) => {
    const rel = relWhen(value);
    if (!rel) return '';
    return `<time datetime="${esc(isoDate(value))}" title="${esc(fmtDate(value, { time: true }))}">${esc(prefix ? `${prefix} ${rel}` : sentenceCase(rel))}</time>`;
  };

  /* ---------------------------------------------------------------- 12c.1 LEDGER */
  const KIND_LABEL = kind => sentenceCase(String(kind || 'not established').replace(/_/g, ' '));
  const STATUS = {
    active: { word: 'Reached', say: 'This project opened it and recorded a response.' },
    unverified: { word: 'Never reached', say: 'A lead: written down, never opened.' },
    blocked: { word: 'Blocked', say: 'The last attempt was refused or returned nothing usable.' }
  };
  const SCOPES = [
    { value: '', label: 'Entrypoints watched' },
    { value: 'evidence', label: 'Pages found through them' },
    { value: 'all', label: 'Every record' }
  ];
  const inScope = (s, scope) => (scope === 'all' ? true : scope === 'evidence' ? s.monitor === false : s.monitor !== false);

  /* Two maps, built once per load: a record by id, and how many records name it as
     the place they were found. 2,473 of the 3,009 records trace back to 115 parents. */
  let srcIndex = null;
  function sourceIndex() {
    if (srcIndex && srcIndex.of === state.sources) return srcIndex;
    const byId = new Map(), children = new Map();
    for (const s of state.sources || []) byId.set(s.id, s);
    for (const s of state.sources || []) {
      if (s.discoveredFrom && byId.has(s.discoveredFrom)) children.set(s.discoveredFrom, (children.get(s.discoveredFrom) || 0) + 1);
    }
    srcIndex = { of: state.sources, byId, children };
    return srcIndex;
  }

  function ledgerOpeningHTML(stats) {
    const total = stats.total || 0;
    const byStatus = stats.byStatus || {}, byKind = stats.byKind || {};
    const reached = byStatus.active || 0, never = byStatus.unverified || 0, blocked = byStatus.blocked || 0;
    const kinds = Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]);
    const bar = [
      { n: reached, cls: 'is-reached', word: STATUS.active.word },
      { n: never, cls: 'is-never', word: STATUS.unverified.word },
      { n: blocked, cls: 'is-blocked', word: STATUS.blocked.word }
    ].filter(part => part.n > 0);
    return `<section class="ledger-open card" aria-labelledby="ledger-open-h">
  <h2 class="glance-h" id="ledger-open-h">What the ledger holds</h2>
  <div class="figures ledger-figures">
    <p class="figure"><b>${esc(fmtInt(total))}</b><span>records in all</span></p>
    <p class="figure"><b>${esc(fmtInt(stats.monitored || 0))}</b><span>entrypoints watched</span></p>
    <p class="figure"><b>${esc(fmtInt(reached))}</b><span>reached at least once</span></p>
  </div>
  <div class="statbar" role="img" aria-label="${esc(`Of ${fmtInt(total)} records, ${fmtInt(reached)} were reached, ${fmtInt(never)} were never reached and ${fmtInt(blocked)} were blocked.`)}">
    ${bar.map(part => `<span class="statbar-seg ${part.cls}" style="--w:${pct(part.n, total)}"></span>`).join('')}
  </div>
  <ul class="statkey">
    ${bar.map(part => `<li class="${part.cls}"><span class="statkey-mark" aria-hidden="true"></span><b class="num">${esc(fmtInt(part.n))}</b> ${esc(part.word.toLowerCase())}</li>`).join('')}
  </ul>
  <p class="glance-note ledger-honest">A record is a place this project knows about, not a claim that it was read. ${esc(fmtInt(never))} of them have never been opened: they were found as links and written down so the trail stays visible. Access is what the scanner last recorded, never what a report asserts.</p>
  <h3 class="glance-h ledger-kinds-h" id="ledger-kinds-h">By kind</h3>
  <ul class="kinds" aria-labelledby="ledger-kinds-h">
    ${kinds.map(kind => `<li><button type="button" class="kindrow" data-kind="${esc(kind)}" aria-pressed="false"><span class="kind-name">${esc(KIND_LABEL(kind))}</span><span class="kind-n num">${esc(fmtInt(byKind[kind]))}</span><span class="kind-share">${esc(total ? `${Math.round((byKind[kind] / total) * 100)}%` : '–')}</span></button></li>`).join('')}
  </ul>
</section>`;
  }

  function sourceFiltersHTML(stats) {
    const f = state.sourceFilters;
    const byKind = stats.byKind || {}, byStatus = stats.byStatus || {};
    const counts = { '': stats.monitored || 0, evidence: (stats.total || 0) - (stats.monitored || 0), all: stats.total || 0 };
    return `<form id="source-filters" role="search" aria-label="Search and filter the ledger">
  <div class="toolbar toolbar-flat">
    <div class="toolbar-row">
      <div class="field">
        <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.4"/><path d="M15.7 15.7 20.5 20.5"/></svg>
        <label class="sr-only" for="source-search">Search the ledger</label>
        <input id="source-search" name="q" type="search" value="${esc(f.q)}" placeholder="Search names, addresses, topics and notes…" autocomplete="off" spellcheck="false">
      </div>
      <div class="filter-group">
        <span class="select-wrap">
          <label class="sr-only" for="source-scope">Which records</label>
          <select class="input" id="source-scope" name="scope">${SCOPES.map(s => `<option value="${esc(s.value)}"${f.scope === s.value ? ' selected' : ''}>${esc(s.label)} (${esc(fmtInt(counts[s.value]))})</option>`).join('')}</select>
        </span>
        <span class="select-wrap">
          <label class="sr-only" for="source-kind">Kind</label>
          <select class="input" id="source-kind" name="kind"><option value="">Every kind</option>${Object.keys(byKind).sort().map(k => `<option value="${esc(k)}"${f.kind === k ? ' selected' : ''}>${esc(KIND_LABEL(k))} (${esc(fmtInt(byKind[k]))})</option>`).join('')}</select>
        </span>
        <span class="select-wrap">
          <label class="sr-only" for="source-status">Access</label>
          <select class="input" id="source-status" name="status"><option value="">Any access</option>${Object.keys(byStatus).sort().map(k => `<option value="${esc(k)}"${f.status === k ? ' selected' : ''}>${esc((STATUS[k] || { word: sentenceCase(k) }).word)} (${esc(fmtInt(byStatus[k]))})</option>`).join('')}</select>
        </span>
        <button type="button" class="button button-quiet" data-ledger="reset">Reset</button>
      </div>
    </div>
  </div>
</form>`;
  }

  function renderSources(token) {
    stopPageWiring();
    const stats = state.sourceStats || { total: 0, monitored: 0, checked: 0, byKind: {}, byStatus: {} };
    const f = state.sourceFilters;
    if (!('parent' in f)) { f.parent = ''; f.only = ''; }
    /* #sources/<record id> opens that record on its own. Opening one from the list
       writes the same address back with replaceState, so a record can be linked to
       without the page ever re-rendering or the Back button filling up. A render of
       this route always matches the address: arriving at plain #sources clears both
       of the context filters. */
    const deep = state.route.name === 'sources' ? state.route.id : '';
    f.only = deep;
    f.parent = '';
    if (deep) f.q = '';
    app.innerHTML = `<div class="folio ledger">
  ${pageHeadHTML({
    eyebrow: 'Provenance', id: 'sources-page-h', title: 'Sources',
    lede: 'Every place this project watches, and every page it has followed from one. This is the trail behind the reports: what was opened, when, and what was only ever a lead. <a href="#method/evidence">How sources are used</a>.'
  })}
  ${ledgerOpeningHTML(stats)}
  <section class="ledger-list" aria-labelledby="ledger-list-h">
    <h2 class="title-2" id="ledger-list-h">The records</h2>
    ${sourceFiltersHTML(stats)}
    <p class="statusline"><span id="source-count">${esc(plural(stats.total, 'record'))}</span><span class="ledger-hint">Open a record for its notes, its feed and where it was found.</span></p>
    <div id="source-list">${Array.from({ length: 6 }, () => '<div class="skeleton-row sk-src" aria-hidden="true"></div>').join('')}<p class="sr-only">Loading the ledger.</p></div>
  </section>
</div>`;
    measureChrome();
    wireLedger();
    loadSources().then(() => {
      if (token !== state.routeToken) return;
      renderSourceList();
      if (deep && sourceIndex().byId.has(deep)) openRecord(deep);
      else if (deep) { f.only = ''; renderSourceList(); announce('That record is not in this ledger.'); }
    }).catch(() => {
      if (token !== state.routeToken) return;
      const list = $('#source-list');
      if (!list) return;
      list.innerHTML = `<div class="empty-state"><h3>The ledger could not be loaded.</h3><p>The file holding the records did not arrive. Everything else on the site, including the reports already open, is unaffected.</p><button type="button" class="button button-primary" data-ledger="retry">Try again</button></div>`;
    });
  }

  /* The list never renders more than one page of records: the ledger is 3,009 rows
     and the old build turned it into 72,371 elements. Details fill in on demand. */
  function renderSourceList() {
    const list = $('#source-list');
    if (!list || !state.sources) return;
    const f = state.sourceFilters;
    /* Re-listing drops whatever record was open, so the address stops naming one. */
    if (state.route.id && f.only !== state.route.id) clearRecordAddress();
    const q = f.q.trim().toLowerCase();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];
    /* A search is a search: it covers the whole ledger, and the control says so. */
    if (words.length && f.scope !== 'all') {
      f.scope = 'all';
      const select = $('#source-scope');
      if (select) select.value = 'all';
    }
    const index = sourceIndex();
    const pinned = f.only ? index.byId.get(f.only) : null;
    const parent = f.parent ? index.byId.get(f.parent) : null;
    const all = pinned ? [pinned] : state.sources.filter(s =>
      (parent ? s.discoveredFrom === parent.id : inScope(s, f.scope)) &&
      (!words.length || words.every(w => s._hay.includes(w))) &&
      (!f.kind || s.kind === f.kind) &&
      (!f.status || s.status === f.status));

    const total = state.sources.length;
    const count = $('#source-count');
    if (count) count.textContent = all.length === total ? plural(total, 'record') : `${fmtInt(all.length)} of ${plural(total, 'record')}`;
    for (const button of $$('.kindrow')) button.setAttribute('aria-pressed', String(button.dataset.kind === f.kind));

    const context = pinned
      ? `<p class="tokens"><button type="button" class="token" data-ledger="clear-context">One record: ${esc(pinned.name || hostOf(pinned.url))}<span class="token-x" aria-hidden="true">✕</span></button></p>`
      : parent
        ? `<p class="tokens"><button type="button" class="token" data-ledger="clear-context">Pages found at ${esc(parent.name || hostOf(parent.url))}<span class="token-x" aria-hidden="true">✕</span></button></p>`
        : '';
    if (!all.length) {
      list.innerHTML = `${context}<div class="empty-state"><h3>${q ? `No record matches “${esc(f.q.trim())}”.` : 'No record matches these filters.'}</h3><p>The ledger holds ${esc(fmtInt(total))} records, and a search reads their names, addresses, topics and the scanner's own notes. Try a domain, a publisher, or a single word.</p><button type="button" class="button" data-ledger="reset">Clear the filters</button></div>`;
      return;
    }
    /* Grouped by kind while the ledger is in its default order: the whole result is
       ordered by kind first, so a group is never split by paging and its count is
       the real one, not the number that happens to be on this page. */
    const grouped = !words.length && !f.kind && !parent && !pinned;
    const totals = new Map();
    let ordered = all;
    if (grouped) {
      for (const s of all) totals.set(s.kind || '', (totals.get(s.kind || '') || 0) + 1);
      const rank = new Map([...totals].sort((a, b) => b[1] - a[1]).map(([kind], i) => [kind, i]));
      ordered = [...all].sort((a, b) =>
        (rank.get(a.kind || '') || 0) - (rank.get(b.kind || '') || 0) ||
        collator.compare(a.name || '', b.name || ''));
    }
    const shown = Math.min(state.sourceShown, ordered.length);
    const page = ordered.slice(0, shown);
    const groups = grouped ? groupByKind(page) : [{ key: '', label: '', items: page }];
    let i = 0;
    const html = groups.map((g, gi) => {
      const headId = `kind-${gi}`;
      const whole = totals.get(g.key) || g.items.length;
      const head = g.label ? `<h3 class="group-head" id="${headId}">${esc(g.label)}<span class="group-n">${esc(g.items.length < whole ? `${fmtInt(g.items.length)} of ${plural(whole, 'record')}` : plural(whole, 'record'))}</span></h3>` : '';
      return `<section class="group"${g.label ? ` aria-labelledby="${headId}"` : ''} style="contain-intrinsic-size: auto ${Math.max(8, g.items.length * 4)}rem">${head}<ol class="srcs">${g.items.map(s => sourceRowHTML(s, i++, all.length)).join('')}</ol></section>`;
    }).join('');
    const foot = all.length > shown
      ? `<div class="list-foot"><button type="button" class="button" data-action="more-sources">Show ${esc(fmtInt(Math.min(PAGE.sources, all.length - shown)))} more of ${esc(plural(all.length - shown, 'record'))}</button></div>`
      : `<p class="list-end">End of ${esc(plural(all.length, 'record'))}.</p>`;
    list.innerHTML = context + html + foot;
  }
  function groupByKind(items) {
    const map = new Map();
    for (const s of items) {
      const key = s.kind || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map].map(([key, list]) => ({ key, label: KIND_LABEL(key), items: list }));
  }

  /* A ledger row uses the width it has. At 1,440px the old row packed everything
     into the left 450px and pinned a chevron 900px away; the topics the record
     carries, which the specification lists as a column, were not shown at all
     until the row was opened. Below 60em the columns fold back into the one
     meta line, which is why both are in the markup and only one is ever shown. */
  function sourceRowHTML(s, index, total) {
    const status = STATUS[s.status] || { word: sentenceCase(s.status || 'not established') };
    const kids = sourceIndex().children.get(s.id) || 0;
    const when = s.lastCheckedAt ? whenHTML(s.lastCheckedAt, status.word.toLowerCase()) : esc(status.word);
    const topics = (s.topics || []).filter(Boolean);
    const sub = [
      esc(hostOf(s.url) || 'address not established'),
      kids ? esc(`${plural(kids, 'page')} found here`) : ''
    ].filter(Boolean);
    const meta = [esc(KIND_LABEL(s.kind)), when].filter(Boolean);
    return `<li class="src" data-source-id="${esc(s.id)}" aria-posinset="${index + 1}" aria-setsize="${total}">
  <details class="src-box">
    <summary class="src-sum">
      <span class="src-dot" data-status="${esc(s.status || '')}" aria-hidden="true"></span>
      <span class="src-main"><span class="src-name">${esc(s.name || hostOf(s.url) || 'Untitled record')}</span><span class="src-sub src-meta-always">${sub.join('<span aria-hidden="true"> · </span>')}</span><span class="src-meta">${meta.join('<span aria-hidden="true"> · </span>')}</span></span>
      <span class="src-col src-col-kind">${esc(KIND_LABEL(s.kind))}</span>
      <span class="src-col src-col-when">${when}</span>
      <span class="src-col src-col-topics">${topics.length ? esc(topics.join(', ')) : '<span class="src-none">No topic recorded</span>'}</span>
      <span class="src-chev" aria-hidden="true"></span>
    </summary>
    <div class="src-detail" data-src-detail></div>
  </details>
</li>`;
  }

  function sourceDetailHTML(s) {
    const index = sourceIndex();
    const status = STATUS[s.status] || { word: sentenceCase(s.status || 'not established'), say: '' };
    const parent = s.discoveredFrom && index.byId.get(s.discoveredFrom);
    const kids = index.children.get(s.id) || 0;
    const notes = String(s.notes || '').split('\n').map(line => line.trim()).filter(Boolean);
    const rows = [
      ['Address', safeURL(s.url) ? external(s.url, normURL(s.url) || s.url) : esc(s.url || 'Not established')],
      ['Kind', esc(KIND_LABEL(s.kind))],
      ['Access', `${esc(status.word)}${status.say ? ` <span class="src-say">${esc(status.say)}</span>` : ''}`],
      ['In the rota', s.monitor === false ? 'No: found through another record' : 'Yes: revisited by every scan'],
      ['First seen', esc(fmtDate(s.discoveredAt))],
      ['Last checked', s.lastCheckedAt ? esc(fmtDate(s.lastCheckedAt, { time: true })) : 'Never opened'],
      ['Last success', s.lastSuccessAt ? esc(fmtDate(s.lastSuccessAt, { time: true })) : 'Not established'],
      ['Last full window', s.lastCoverageAt ? esc(fmtDate(s.lastCoverageAt, { time: true })) : 'No complete window recorded'],
      ['Feed', s.feedUrl ? external(s.feedUrl, normURL(s.feedUrl) || s.feedUrl) : 'None recorded'],
      ['Found via', parent ? `<button type="button" class="textlink src-jump" data-ledger="parent" data-src="${esc(parent.id)}">${esc(parent.name || hostOf(parent.url))}</button>` : esc(s.discoveredFrom || 'Not established')],
      ['Topics', (s.topics || []).length ? esc((s.topics || []).join(', ')) : 'None recorded'],
      ['Record', `<code>${esc(s.id)}</code>`]
    ];
    return `<dl class="page-meta src-meta-list">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
${notes.length ? `<div class="src-notes"><p class="cited-h">What the scanner recorded</p>${notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
<div class="actions src-actions">
  ${safeURL(s.url) ? external(s.url, 'Open the source', 'class="button"') : ''}
  ${kids ? `<button type="button" class="button button-quiet" data-ledger="children" data-src="${esc(s.id)}">Show the ${esc(plural(kids, 'page'))} found here</button>` : ''}
</div>`;
  }

  function wireLedger() {
    const root = viewRoot();
    if (!root) return;
    /* `toggle` does not bubble, so the capture phase is the only way to delegate it. */
    root.addEventListener('toggle', event => {
      const box = event.target;
      if (!box.classList || !box.classList.contains('src-box')) return;
      const row = box.closest('[data-source-id]');
      if (!row) return;
      /* The address follows the open record, so it can be copied and shared. */
      if (state.route.name === 'sources') {
        const id = box.open ? row.dataset.sourceId : '';
        state.route = { ...state.route, id };
        history.replaceState(null, '', id ? `#sources/${encodeURIComponent(id)}` : '#sources');
      }
      const host = $('[data-src-detail]', box);
      if (!box.open || !host || host.dataset.filled === '1') return;
      const record = sourceIndex().byId.get(row.dataset.sourceId);
      if (!record) return;
      host.innerHTML = sourceDetailHTML(record);
      host.dataset.filled = '1';
    }, true);
    root.addEventListener('click', event => {
      const f = state.sourceFilters;
      const kind = event.target.closest('.kindrow');
      if (kind) {
        const select = $('#source-kind');
        const value = f.kind === kind.dataset.kind ? '' : kind.dataset.kind;
        if (select) { select.value = value; select.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
      const action = event.target.closest('[data-ledger]');
      if (!action) return;
      switch (action.dataset.ledger) {
        case 'reset':
          Object.assign(f, { q: '', kind: '', status: '', scope: '', parent: '', only: '' });
          state.sourceShown = PAGE.sources;
          clearRecordAddress();
          renderSources(state.routeToken);
          $('#source-search')?.focus();
          break;
        case 'retry':
          state.sources = null;
          renderSources(state.routeToken);
          break;
        case 'parent':
          Object.assign(f, { q: '', kind: '', status: '', parent: '', only: action.dataset.src });
          state.sourceShown = PAGE.sources;
          renderSourceList();
          openRecord(action.dataset.src);
          break;
        case 'children':
          Object.assign(f, { q: '', kind: '', status: '', parent: action.dataset.src, only: '' });
          state.sourceShown = PAGE.sources;
          renderSourceList();
          $('#source-list')?.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'instant' : 'smooth' });
          announce(`Showing the pages found at one entrypoint.`);
          break;
        case 'clear-context':
          Object.assign(f, { parent: '', only: '' });
          state.sourceShown = PAGE.sources;
          renderSourceList();
          $('#source-list')?.scrollIntoView({ block: 'start', behavior: 'instant' });
          break;
        default: break;
      }
    });
  }
  /* The address stops naming a record as soon as no record is open. */
  function clearRecordAddress() {
    if (state.route.name !== 'sources' || !state.route.id) return;
    state.route = { ...state.route, id: '' };
    history.replaceState(null, '', '#sources');
  }
  function openRecord(id) {
    const box = document.querySelector(`[data-source-id="${CSS.escape(id)}"] .src-box`);
    if (!box) return;
    box.open = true;
    box.scrollIntoView({ block: 'start', behavior: 'instant' });
    $('summary', box)?.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------- 12c.2 THE EDITIONS */
  /* Small multiples: one column per edition, drawn from zero, with every number
     repeated in the cards below. Nothing is inferred — the library size is the
     recorded total after a scan, never "the reports it published". */
  /* One chart at the full content width instead of three 155x70px panels, each
     of which needed a three-line caption to mean anything. The bars are the
     entrypoints a scan reached and did not; the step line over them is the size
     of the library after it, and every value is repeated as a number. */
  function edChartHTML(runs, label) {
    const maxSrc = Math.max(1, ...runs.map(r => (num(r.sourcesChecked) || 0) + (num(r.sourcesFailed) || 0)));
    const maxLib = Math.max(1, ...runs.map(r => num(r.publishedCount) || 0));
    const n = runs.length;
    const points = runs.map((r, i) => {
      const x = n === 1 ? 50 : ((i + 0.5) / n) * 100;
      const y = 100 - ((num(r.publishedCount) || 0) / maxLib) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<div class="chart">
  <p class="chart-h">Every scan, and what the library did</p>
  <div class="chart-plot" role="img" aria-label="${esc(label)}">
    <span class="chart-max" aria-hidden="true">Entrypoints, 0 to ${esc(fmtInt(maxSrc))}</span>
    <svg class="chart-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="${points}"/></svg>
    ${runs.map(r => `<span class="col">${num(r.sourcesFailed) ? `<i class="col-b" style="--h:${pct(num(r.sourcesFailed) || 0, maxSrc)}"></i>` : ''}<i class="col-a" style="--h:${pct(num(r.sourcesChecked) || 0, maxSrc)}"></i></span>`).join('')}
  </div>
  <p class="chart-axis" aria-hidden="true">${runs.map(r => `<span><b>${esc(fmtInt(r.publishedCount || 0))}</b>${esc(fmtDate(r.finishedAt || r.startedAt, { short: true }))}</span>`).join('')}</p>
  <ul class="chart-legend">
    <li class="is-line"><span class="chart-key" aria-hidden="true"></span>Reports in the library after the scan</li>
    <li class="is-a"><span class="chart-key" aria-hidden="true"></span>Entrypoints reached</li>
    <li class="is-b"><span class="chart-key" aria-hidden="true"></span>Failed or never visited</li>
  </ul>
  <p class="chart-note">The line is the running total after each scan, not the number any one scan added, and it is scaled to its own maximum of ${esc(fmtInt(maxLib))}. The bars are scaled to the entrypoint maximum above. Which reports belong to which edition is only recorded for the most recent scans, so this page never claims it.</p>
</div>`;
  }

  function editionCardHTML(run, i, runs) {
    const previous = runs[i - 1];
    const grew = previous && num(run.publishedCount) !== null && num(previous.publishedCount) !== null
      ? num(run.publishedCount) - num(previous.publishedCount) : null;
    const latest = i === runs.length - 1;
    const failed = num(run.sourcesFailed) || 0;
    const worst = failed > 0 && failed === Math.max(...runs.map(r => num(r.sourcesFailed) || 0));
    const figures = [
      /* The library's size after the scan, and how much it changed. Which reports
         belong to an edition is not recorded for older scans, so it is never said. */
      { b: fmtInt(run.publishedCount || 0), s: 'reports in the library', more: grew === null ? '' : grew === 0 ? 'unchanged' : `${grew > 0 ? 'grew by' : 'shrank by'} ${fmtInt(Math.abs(grew))}` },
      { b: fmtInt(run.sourcesChecked || 0), s: 'entrypoints reached' },
      { b: fmtInt(failed), s: 'failed or unvisited' },
      { b: fmtInt(run.candidatesFound || 0), s: 'leads assessed' }
    ];
    return `<li class="edition card" id="edition-${i + 1}">
  <div class="ed-head">
    <div class="ed-when">
      <p class="eyebrow">Edition ${esc(String(i + 1))}${latest ? ' <span class="pill">Latest</span>' : ''}</p>
      <h3 class="ed-date">${esc(fmtDate(run.finishedAt || run.startedAt))}</h3>
    </div>
    <p class="ed-window">${esc(run.windowStart ? `Looked at ${fmtDate(run.windowStart)} to ${fmtDate(run.windowEnd)}` : 'Window not established')}${run.status ? esc(` · ${sentenceCase(run.status)}`) : ''}</p>
  </div>
  <div class="ed-figs">${figures.map(f => `<p class="figure"><b>${esc(f.b)}</b><span>${esc(f.s)}</span>${f.more ? `<span class="ed-delta">${esc(f.more)}</span>` : ''}</p>`).join('')}</div>
  ${worst ? '<p class="ed-flag">More failed or unvisited entrypoints than any other edition.</p>' : ''}
  ${run.coverageNote ? `<p class="research-note ed-note">${esc(run.coverageNote)}</p>` : ''}
  ${run.limitationCount ? `<details class="why ed-lims" data-edition="${esc(String(i))}"${latest ? ' open' : ''}>
    <summary>${esc(plural(run.limitationCount, 'recorded coverage limitation'))}</summary>
    <div class="lim-host" data-lims><p class="glance-note">Loading the recorded limitations…</p></div>
  </details>` : '<p class="glance-note ed-none">No coverage limitation was recorded for this edition.</p>'}
</li>`;
  }

  function renderEditions(token) {
    stopPageWiring();
    const runs = state.runsLight || [];
    const rail = runs.map((run, i) => ({ id: `edition-${i + 1}`, n: i + 1, title: fmtDate(run.finishedAt || run.startedAt) })).reverse();
    const meta = state.meta || {};
    const shortLabel = run => fmtDate(run.finishedAt || run.startedAt, { short: true });
    const charts = runs.length ? `<div class="ed-charts">
    ${edChartHTML(runs, `Edition by edition: ${runs.map(r => `${shortLabel(r)}, ${fmtInt(r.sourcesChecked || 0)} entrypoints reached, ${fmtInt(r.sourcesFailed || 0)} failed or never visited, ${fmtInt(r.publishedCount || 0)} reports in the library afterwards`).join('; ')}.`)}
  </div>` : '';
    app.innerHTML = `<div class="folio editions-page">
  ${pageHeadHTML({
    eyebrow: 'The observing log', id: 'editions-h', title: 'Editions',
    lede: `Every scan, what it reached and what it could not. A scan reads the places in the ledger, assesses what is new, and adds a report only when a candidate survives two review runs.${meta.nextScanAt ? ` The next edition is expected after ${esc(fmtDate(meta.nextScanAt))}.` : ''}`
  })}
  ${runs.length ? pageRailHTML('editions', 'Editions', rail, 'edition') : ''}
  <div class="folio-col">
    ${runs.length ? `<section class="ed-top" aria-labelledby="ed-charts-h">
      <h2 class="title-2" id="ed-charts-h">What each scan did</h2>
      ${charts}
    </section>` : ''}
    ${runs.length
      ? `<section class="ed-all" aria-labelledby="ed-all-h">
      <h2 class="title-2" id="ed-all-h">Every edition, newest first</h2>
      <ol class="editions">${runs.map((run, i) => editionCardHTML(run, i, runs)).reverse().join('')}</ol>
    </section>`
      : '<div class="empty-state"><h2>No scan has been recorded yet.</h2><p>This log fills in as soon as the first edition finishes.</p></div>'}
    <section class="folio-note" aria-labelledby="ed-limits-h">
      <h2 class="title-2" id="ed-limits-h">What this log does not say</h2>
      <p>Which reports belong to which edition is only recorded for the most recent scans, so this page never claims it. “Reports in the library” is the total after a scan; where the edition before it is known, the change is shown beside it.</p>
      <p>Coverage limitations are the scanner's own record of what it could not establish: a page that shows only its latest cards, a feed that stopped, an entrypoint it never reached. They are kept word for word.</p>
      <p>A failed access is not a judgment about a publisher. It means this project did not get a usable response inside that window.</p>
    </section>
  </div>
</div>`;
    app.setAttribute('aria-busy', 'false');
    measureChrome();
    wirePage('editions', rail.map(r => r.id));
    wireEditions();
    void token;
  }

  function wireEditions() {
    const root = viewRoot();
    if (!root) return;
    root.addEventListener('toggle', event => {
      const box = event.target;
      if (!box.classList || !box.classList.contains('ed-lims') || !box.open) return;
      const host = $('[data-lims]', box);
      if (!host || host.dataset.filled === '1') return;
      const index = Number(box.dataset.edition);
      loadRuns().then(runs => {
        const run = runs[index];
        const items = (run && Array.isArray(run.limitations) ? run.limitations : []).filter(Boolean);
        host.innerHTML = items.length
          ? `<ul class="lim-list">${items.map(line => `<li>${esc(line)}</li>`).join('')}</ul>`
          : '<p class="glance-note">The limitations recorded for this edition are not in the published file.</p>';
        host.dataset.filled = '1';
      }).catch(() => {
        host.innerHTML = '<p class="glance-note">The edition file could not be loaded, so these limitations cannot be shown.</p>';
      });
    }, true);
  }

  /* ------------------------------------------------------------- 12c.3 THE METHOD */
  function renderMethod() {
    stopPageWiring();
    const meta = state.meta || {};
    const runs = state.runsLight || [];
    const latest = runs[runs.length - 1] || {};
    const stats = state.sourceStats || {};
    const scores = state.entries.map(e => num(e.score)).filter(v => v !== null);
    /* A real split from the current library, so the worked example is data, not a drawing. */
    const example = state.entries.find(e => (e._runs || runsOf(e)).both && (e._runs || runsOf(e)).splits === 1)
      || state.entries.find(e => (e._runs || runsOf(e)).both) || state.entries[0] || null;
    const exRuns = example ? (example._runs || runsOf(example)) : null;
    const dim = exRuns ? (exRuns.differing[0] || exRuns.dims[0]) : null;
    const sections = [
      { id: 'place', title: 'How a report earns its place' },
      { id: 'dimensions', title: 'The five dimensions' },
      { id: 'runs', title: 'Two runs, one model' },
      { id: 'marks', title: 'How to read the marks' },
      { id: 'depth', title: 'How long a report is' },
      { id: 'evidence', title: 'Sources and evidence' },
      { id: 'limits', title: 'What this does not establish' },
      { id: 'keys', title: 'Keyboard' }
    ];
    app.innerHTML = `<div class="folio method">
  ${pageHeadHTML({
    eyebrow: 'How this works', id: 'method-h', title: 'Method',
    lede: `${esc(HONESTY)} Both runs read the same report against the same rubric, and where they disagree this site shows the distance instead of burying it in an average.`
  })}
  ${pageRailHTML('method', 'On this page', sections)}
  <div class="folio-col">
    <section class="msec" id="place" aria-labelledby="place-h">
      <h2 class="title-2" id="place-h">How a report earns its place</h2>
      <ol class="steps">
        <li><b>Watch.</b> ${esc(fmtInt(stats.monitored || 0))} entrypoints — official pages, repositories, model hubs, research and newsletters — are revisited on a fixed rota${meta.intervalHours ? esc(` of about ${meta.intervalHours} hours`) : ''}.</li>
        <li><b>Follow.</b> Whatever they link to that looks relevant is written into the ledger as a record, opened or not. The ledger holds ${esc(fmtInt(stats.total || 0))} records today.</li>
        <li><b>Assess.</b> The newest scan read ${esc(fmtInt(latest.candidatesFound || 0))} leads. Most are set aside: a lead becomes a report only when there is enough documented evidence to write one without guessing.</li>
        <li><b>Write.</b> A report is original prose with every claim tied to a page that was actually opened, plus a practical judgment, the uses it suits and the limits to keep in view.</li>
        <li><b>Review, twice.</b> The same reviewer model reads the finished report twice, in two separate runs, and each run records five ratings with a written reason for every one.</li>
        <li><b>Publish.</b> The report joins the library and both runs are published with it. ${esc(plural(meta.reportCount || state.entries.length, 'report'))} have been through this.</li>
      </ol>
    </section>

    <section class="msec" id="dimensions" aria-labelledby="dimensions-h">
      <h2 class="title-2" id="dimensions-h">The five dimensions</h2>
      <p class="mpara">Every report is rated on the same five dimensions, each from 1 to 10, under rubric version ${esc(meta.rubricVersion || 'not established')}. The rubric reads 1 as low, 5 as moderate and 10 as exceptional. A rating is a judgment recorded against that rubric: nothing is executed, timed or measured to produce it.</p>
      <dl class="dims">${DIMENSIONS.map(d => `<dt>${esc(d.label)}</dt><dd>${esc(d.text)}</dd>`).join('')}</dl>
      <p class="mpara">The overall score is the mean of the five.${example ? esc(` For ${example.entity || example.title}: ${arithmetic(example).replace('Mean of five dimensions: ', '')}.`) : ''}${scores.length ? esc(` Across the library those overall scores run from ${fmtScore(Math.min(...scores))} to ${fmtScore(Math.max(...scores))}, so a small difference between two reports is a small difference.`) : ''}</p>
    </section>

    <section class="msec" id="runs" aria-labelledby="runs-h">
      <h2 class="title-2" id="runs-h">Two runs, one model</h2>
      <p class="honesty mhonest">${esc(HONESTY)}</p>
      <p class="mpara">They are called run A and run B, and nothing else. They are not two experts, not two opinions and not an independent check: they share a model, a prompt and a rubric, so they share the same blind spots. What they can show is whether a rating was stable — and exactly where it was not.</p>
      ${dim && exRuns && exRuns.both ? `<figure class="example card">
        <figcaption class="glance-h">A worked example, taken from the library</figcaption>
        <p class="ex-which">${esc(dim.label)} · ${esc(example.title)}</p>
        <div class="ex-gauge">${gaugeHTML(dim)}</div>
        <p class="ex-read">${esc(dim.differs
          ? `Run A recorded ${fmtVal(dim.a)} and run B recorded ${fmtVal(dim.b)}. The caret above the line is A, the caret below it is B, the short upright is their mean of ${fmtScore(dim.mean)}, and the tinted band is the distance between them.`
          : `Both runs recorded ${fmtVal(dim.a)}. The two carets meet, the mark closes into an hourglass, and there is no band.`)}</p>
        <p class="ex-read">${esc(agreementSentence(example))}</p>
        <p><a class="textlink" href="${reportURL(example.id, 'ratings')}">See it in the report</a></p>
      </figure>` : ''}
      <p class="mpara">Colour carries exactly one meaning on this site: the distance between the two runs. Everything else is drawn in ink. A tint inside a mark always means the runs did not agree there.</p>
    </section>

    <section class="msec" id="marks" aria-labelledby="marks-h">
      <h2 class="title-2" id="marks-h">How to read the marks</h2>
      <p class="mpara">There are two marks, and they stand on different scales on purpose.</p>
      <dl class="dims">
        <dt>The five bars on a row</dt>
        <dd>One bar per dimension, in rubric order: usefulness, impact, novelty, maturity, openness. The bar reaches the higher of the two runs, the ink reaches the lower, and the tinted cap between them is the disagreement. It starts at zero, because it encodes a length.</dd>
        <dt>The gauge in a report</dt>
        <dd>A 1–10 track with run A as a caret above the line and run B as a caret below it, their mean as a short upright, and a tinted band spanning the gap. It starts at 1, because it encodes a position on the rubric's own scale and may not be truncated.</dd>
      </dl>
      <p class="mpara">Both stay legible with colour switched off: A is above the line, B is below it, and the agreement is written in words on every row, tile and card as well.</p>
    </section>

    <section class="msec" id="depth" aria-labelledby="depth-h">
      <h2 class="title-2" id="depth-h">How long a report is</h2>
      <p class="mpara">Depth follows the final mean impact rating: about 1,000 body words below 5, about 2,000 from 5 to 7, and about 3,000 above 7, with ten per cent of tolerance either way. Titles, summaries and bibliographies do not count toward it. The length is a floor for evidence, not an invitation to pad: a thin case stays a short report and is rated as one.</p>
    </section>

    <section class="msec" id="evidence" aria-labelledby="evidence-h">
      <h2 class="title-2" id="evidence-h">Sources and evidence</h2>
      <p class="mpara">Every claim in a report is tied to a page that was actually opened, with the date it was accessed. Each bibliography entry says what its source supports and where in it to look, and every section lists the sources it cites beside the prose. Nothing is cited from memory.</p>
      <p class="mpara">The <a href="#sources">ledger</a> holds the rest of the trail: the entrypoints on the rota, the pages found through them, and the ${esc(fmtInt((stats.byStatus || {}).unverified || 0))} records that were written down but never opened. Coverage is bounded, and the <a href="#editions">observing log</a> records where it fell short.</p>
    </section>

    <section class="msec" id="limits" aria-labelledby="limits-h">
      <h2 class="title-2" id="limits-h">What this does not establish</h2>
      <ul class="pointers pointers-limit mlimits" aria-labelledby="limits-h">
        <li>Nothing is executed. No model is run, no tool is installed and no benchmark is reproduced; a report is a documentation review of what a maker and its sources state.</li>
        <li>Ratings are editorial judgments against a published rubric, recorded twice by one model. Agreement between the runs is consistency, not corroboration.</li>
        <li>Coverage is bounded by what the scanner could reach inside a window. Silence about a product is not evidence that nothing happened.</li>
        <li>A vendor's performance claim stays a vendor's claim, and is labelled as one wherever it appears.</li>
      </ul>
      ${meta.coverageNote ? `<p class="glance-h ex-which">The latest scan's own note</p><p class="research-note">${esc(meta.coverageNote)}</p>` : ''}
    </section>

    <section class="msec" id="keys" aria-labelledby="keys-h">
      <h2 class="title-2" id="keys-h">Keyboard</h2>
      <ul class="keylist">
        <li><span class="keycap"><kbd data-kbd>⌘K</kbd></span><span>Find a report, or jump to a page</span></li>
        <li><span class="keycap"><kbd>/</kbd></span><span>Focus the search field on the library or the ledger</span></li>
        <li><span class="keycap"><kbd>↑</kbd><kbd>↓</kbd></span><span>Move through the results while finding</span></li>
        <li><span class="keycap"><kbd>↵</kbd></span><span>Open the selected result</span></li>
        <li><span class="keycap"><kbd data-kbd="mod">⌘</kbd><kbd>↵</kbd></span><span>Save the selected report to your queue</span></li>
        <li><span class="keycap"><kbd>esc</kbd></span><span>Clear a search field, or close a dialog</span></li>
      </ul>
      <p class="mpara">Single-key shortcuts can be switched off in <a href="#settings/keys">Settings</a>.</p>
    </section>
  </div>
</div>`;
    measureChrome();
    wirePage('method', sections.map(s => s.id));
  }

  /* ----------------------------------------------------------- 12c.4 THE SETTINGS */
  const THEME_PREVIEW = { auto: 'pv-auto', plate: 'pv-light', darkroom: 'pv-dark', redlight: 'pv-night' };
  const THEME_SAY = {
    auto: 'Follows this device',
    plate: 'Light, for a lit room',
    darkroom: 'Dark, for a dim one',
    redlight: 'Red only, to keep dark-adapted eyes'
  };
  const TEXT_SAY = { s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large' };

  const segHTML = (name, options, selected, labelledBy) => `<div class="segmented" role="radiogroup" aria-labelledby="${esc(labelledBy)}">
      ${options.map(o => `<label class="seg"><input type="radio" name="${esc(name)}" value="${esc(o.value)}"${selected === o.value ? ' checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}
    </div>`;

  function renderSettings() {
    stopPageWiring();
    const prefs = {
      theme: state.prefs.theme || 'auto',
      text: state.prefs.text || 'm',
      motion: state.prefs.motion || 'allow',
      transparency: state.prefs.transparency || 'system',
      keys: state.prefs.keys || 'on'
    };
    const ids = Object.keys(state.reading);
    const read = ids.filter(id => state.reading[id].read).length;
    const queued = ids.filter(id => state.reading[id].queued).length;
    const going = ids.filter(id => { const r = state.reading[id]; return !r.read && r.progress >= 5 && r.progress < 97; }).length;
    const elsewhere = ids.filter(id => !state.byId.has(id)).length;
    const meta = state.meta || {};
    const sections = [
      { id: 'appearance', title: 'Appearance' },
      { id: 'text', title: 'Text size' },
      { id: 'motion', title: 'Motion' },
      { id: 'transparency', title: 'Transparency' },
      { id: 'keys', title: 'Shortcuts' },
      { id: 'data', title: 'Your reading data' },
      { id: 'scan', title: 'The scan schedule' },
      { id: 'feeds', title: 'Feeds and source' }
    ];
    app.innerHTML = `<div class="folio settings">
  ${pageHeadHTML({
    eyebrow: 'This browser only', id: 'settings-h', title: 'Settings',
    lede: 'How this site reads, and what it keeps. Preferences and reading data stay in this browser: no accounts, no cookies, no requests to anyone else.'
  })}
  ${pageRailHTML('settings', 'On this page', sections)}
  <div class="folio-col">
    <form id="preferences" class="panels">
      <section class="panel card" id="appearance" aria-labelledby="pref-appearance-h">
        <h2 class="panel-h" id="pref-appearance-h">Appearance</h2>
        <p class="panel-say">Automatic follows this device. Night vision is red only — no white, no blue, no lit fills — so dark-adapted eyes stay adapted.</p>
        <div class="tiles" role="radiogroup" aria-labelledby="pref-appearance-h">
          ${PREF_VALUES.theme.map(value => `<label class="ptile ${THEME_PREVIEW[value]}">
            <input type="radio" name="theme" value="${esc(value)}"${prefs.theme === value ? ' checked' : ''}>
            <span class="pv" aria-hidden="true"><span class="pv-sky"></span><span class="pv-card"><i></i><i></i></span></span>
            <span class="ptile-name">${esc(THEME_LABEL[value])}</span>
            <span class="ptile-say">${esc(THEME_SAY[value])}</span>
          </label>`).join('')}
        </div>
      </section>
      <section class="panel card" id="text" aria-labelledby="pref-text-h">
        <h2 class="panel-h" id="pref-text-h">Text size</h2>
        <p class="panel-say">Everything on the site is sized in relative units, so this rescales the whole page — the data marks with it — and the layout recomposes as it grows.</p>
        <div class="tiles tiles-text" role="radiogroup" aria-labelledby="pref-text-h">
          ${PREF_VALUES.text.map(value => `<label class="ptile ptile-aa">
            <input type="radio" name="text" value="${esc(value)}"${prefs.text === value ? ' checked' : ''}>
            <span class="aa aa-${esc(value)}" aria-hidden="true">Aa</span>
            <span class="ptile-name">${esc(TEXT_SAY[value])}</span>
          </label>`).join('')}
        </div>
        <p class="aa-sample">Two runs of the same reviewer model read every report, and both readings are shown. This paragraph is set in the reading face, at the size you have chosen.</p>
      </section>
      <section class="panel card" id="motion" aria-labelledby="pref-motion-h">
        <h2 class="panel-h" id="pref-motion-h">Motion</h2>
        <p class="panel-say">Reduce removes every transition and animation here. Following the device does the same whenever the system asks for reduced motion.</p>
        ${segHTML('motion', [{ value: 'allow', label: 'Follow the device' }, { value: 'reduce', label: 'Reduce' }], prefs.motion, 'pref-motion-h')}
      </section>
      <section class="panel card" id="transparency" aria-labelledby="pref-transparency-h">
        <h2 class="panel-h" id="pref-transparency-h">Transparency</h2>
        <p class="panel-say">The masthead, the sticky toolbar and the phone tab bar are translucent, because the page really does scroll beneath them. Reduce makes every one of them a solid surface. Following the device does the same whenever the system asks for reduced transparency.</p>
        ${segHTML('transparency', [{ value: 'system', label: 'Follow the device' }, { value: 'reduce', label: 'Reduce' }], prefs.transparency, 'pref-transparency-h')}
      </section>
      <section class="panel card" id="keys" aria-labelledby="pref-keys-h">
        <h2 class="panel-h" id="pref-keys-h">Single-key shortcuts</h2>
        <p class="panel-say"><kbd>/</kbd> jumps to the search field. Switch it off if one keystroke should never act on its own; <kbd data-kbd>⌘K</kbd> and the rest keep working.</p>
        ${segHTML('keys', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], prefs.keys, 'pref-keys-h')}
      </section>
    </form>

    <section class="panel card" id="data" aria-labelledby="data-h">
      <h2 class="panel-h" id="data-h">Your reading data</h2>
      <div class="figures data-figs">
        <p class="figure"><b>${esc(fmtInt(ids.length))}</b><span>${esc(ids.length === 1 ? 'report remembered' : 'reports remembered')}</span></p>
        <p class="figure"><b>${esc(fmtInt(read))}</b><span>marked read</span></p>
        <p class="figure"><b>${esc(fmtInt(going))}</b><span>in progress</span></p>
        <p class="figure"><b>${esc(fmtInt(queued))}</b><span>in your queue</span></p>
      </div>
      <p class="panel-say">Your queue, your read marks and how far you have read sit in this browser's local storage under <code>parallax.v1.reading</code>. Nothing is sent anywhere, and clearing your browser data clears them.${elsewhere ? esc(` ${plural(elsewhere, 'record')} belong to reports that are not in this edition; they are kept untouched.`) : ''}${state.storageOK ? '' : ' Storage is unavailable in this browser, so anything you do now lasts until you close the tab.'}</p>
      <div class="actions data-actions">
        <button type="button" class="button" data-action="export">Export as a file</button>
        <span class="file-field">
          <input id="reading-import" name="import" type="file" accept="application/json,.json">
          <span class="button button-file" aria-hidden="true">Import a file</span>
          <label class="sr-only" for="reading-import">Import a reading-data file</label>
        </span>
      </div>
      ${ids.length ? `<details class="why danger">
        <summary>Clear everything stored here</summary>
        <div class="danger-body">
          <p class="panel-say">This removes all ${esc(plural(ids.length, 'record'))} from this browser: the queue, the read marks and your place in every report. It cannot be undone, and there is no copy anywhere else. Export first if you want one.</p>
          <button type="button" class="button button-danger" data-action="clear-reading">Clear reading data</button>
        </div>
      </details>` : '<p class="panel-say nothing-stored">Nothing is stored in this browser yet. Save a report, or read one, and it will be remembered here.</p>'}
      <p id="settings-status" class="settings-status"></p>
    </section>

    <section class="panel card" id="scan" aria-labelledby="scan-h">
      <h2 class="panel-h" id="scan-h">The scan schedule</h2>
      <p class="panel-say">Public information about this edition. The schedule belongs to the project, not to this browser, and nothing here is adjustable from the site.</p>
      <dl class="page-meta scan-meta">
        <dt>Last scan</dt><dd>${esc(fmtDate(meta.lastScanAt, { time: true }))}</dd>
        <dt>Next expected</dt><dd>${esc(fmtDate(meta.nextScanAt, { time: true }))}${meta.enabled === false ? ' · scanning is paused' : ''}</dd>
        <dt>Rota</dt><dd>${esc(meta.intervalHours ? `About every ${meta.intervalHours} hours` : 'Not established')}</dd>
        <dt>Edition built</dt><dd>${esc(fmtDate(meta.generatedAt, { time: true }))}</dd>
        <dt>Times shown in</dt><dd>${esc(meta.timezone || 'UTC')}</dd>
        <dt>Rubric</dt><dd>Version ${esc(meta.rubricVersion || 'not established')} · <code>${esc(shortHash(meta.rubricHash))}</code></dd>
        <dt>In this edition</dt><dd>${esc(`${plural(meta.reportCount || state.entries.length, 'report')}, ${plural(meta.sourceCount || 0, 'source record')}`)}</dd>
      </dl>
      <p class="panel-say"><a href="#editions">The observing log</a> has what each scan reached, and <a href="#method">Method</a> has how a report earns its place.</p>
    </section>

    <section class="panel card" id="feeds" aria-labelledby="feeds-h">
      <h2 class="panel-h" id="feeds-h">Feeds and source</h2>
      <p class="panel-say">Reports are published as plain files, so they can be read without this interface.</p>
      <ul class="end-list feeds-list">
        <li><a href="feed.xml"><span class="end-title">RSS feed</span><span class="end-meta">Every report, newest first</span></a></li>
        <li><a href="catalog.json"><span class="end-title">catalog.json</span><span class="end-meta">The whole library as data, every rating included</span></a></li>
        ${meta.repository ? `<li><a href="${esc(safeURL(`https://github.com/${meta.repository}`))}" target="_blank" rel="noopener noreferrer"><span class="end-title">Source and research archive<span class="ext" aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span></span><span class="end-meta">${esc(meta.repository)}</span></a></li>` : ''}
      </ul>
    </section>
  </div>
</div>`;
    measureChrome();
    wirePage('settings', sections.map(s => s.id));
  }

  /* ------------------------------------------------------- 12c.5 THE OTHER STATES */
  function renderMissing(kind) {
    stopPageWiring();
    const report = kind === 'report';
    const picks = sortList(state.entries, 'latest').slice(0, 3);
    app.innerHTML = `<div class="folio missing">
  ${pageHeadHTML({
    eyebrow: 'Not found', id: 'missing-h',
    title: report ? 'This report is not in this edition.' : 'That page is not part of this site.',
    lede: report
      ? 'It may have been renamed, or withdrawn from the library. Nothing else is affected: the rest of the edition is loaded, and your reading data is untouched.'
      : `The address <code>${esc(location.hash || '#')}</code> does not match any page here.`
  })}
  <div class="folio-col">
    <div class="actions missing-actions">
      <a class="button button-primary" href="#index">Go to the library</a>
      <a class="textlink" href="#method">How reports are made</a>
    </div>
    ${picks.length ? `<div class="end-next"><p class="glance-h" id="missing-next-h">The newest reports</p><ul class="end-list" aria-labelledby="missing-next-h">${picks.map(e => `<li><a href="${reportURL(e.id)}"><span class="end-title">${esc(e.title)}</span><span class="end-meta">${esc(`${fmtScore(e.score)} out of 10 · ${agreementLine(e)} · ${fmtInt(e.readMinutes || 0)} min read`)}</span></a></li>`).join('')}</ul></div>` : ''}
  </div>
</div>`;
    measureChrome();
  }

  function renderBootError(error) {
    stopPageWiring();
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `<div class="folio missing">
  ${pageHeadHTML({
    eyebrow: 'Edition unavailable', id: 'boot-h', title: 'The library could not be loaded.',
    lede: 'Every report on this site is a plain file, and the file that lists them did not arrive. A new edition may still be deploying, or the connection may have dropped.'
  })}
  <div class="folio-col">
    <div class="actions missing-actions"><button type="button" class="button button-primary" id="retry-load">Try again</button><a class="textlink" href="feed.xml">Read the feed instead</a></div>
    <p class="boot-detail">${esc(error && error.message ? error.message : String(error))}</p>
  </div>
</div>`;
    $('#retry-load')?.addEventListener('click', start);
  }

  /* Offline: one quiet line above the view, never a dialog. Everything already
     loaded stays readable, so nothing is blocked and nothing has to be dismissed. */
  function paintNet() {
    const main = $('#main');
    if (!main) return;
    let line = $('#net-state');
    if (!line) {
      line = document.createElement('p');
      line.id = 'net-state';
      line.className = 'netline';
      line.setAttribute('role', 'status');
      main.insertBefore(line, main.firstChild);
    }
    const off = navigator.onLine === false;
    line.hidden = !off;
    line.textContent = off ? 'Offline — showing what is already loaded.' : '';
  }
  window.addEventListener('offline', () => { paintNet(); announce('Offline. The site is showing what is already loaded.'); });
  window.addEventListener('online', paintNet);
  paintNet();

  /* Single-key shortcuts have an off switch (WCAG 2.1.4). This capture listener runs
     before the document handler that owns "/", so switching them off really does stop
     them, and that handler does not have to know the preference exists. */
  document.addEventListener('keydown', event => {
    if (state.prefs.keys !== 'off' || event.key !== '/') return;
    const target = event.target;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.stopImmediatePropagation();
  }, true);

  /* ------------------------------------------------------------------ 13. Boot */
  function paintShell() {
    const repo = $('#colophon-repo');
    if (repo && state.meta) {
      const meta = state.meta;
      const parts = [
        `${esc(plural(meta.reportCount || state.entries.length, 'report'))} in the edition built ${esc(fmtDate(meta.generatedAt))}`,
        meta.nextScanAt ? `next scan expected after ${esc(fmtDate(meta.nextScanAt))}` : '',
        '<a href="#editions">every edition</a>',
        meta.repository ? external(`https://github.com/${meta.repository}`, 'source and research archive') : '',
        '<a href="feed.xml">RSS</a>'
      ].filter(Boolean);
      repo.innerHTML = parts.join(' · ');
    }
    if (!/mac/i.test(navigator.platform || '') && !/mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || '')) {
      for (const el of $$('[data-kbd]')) el.textContent = el.dataset.kbd === 'mod' ? 'Ctrl' : 'Ctrl K';
    }
  }
  async function start() {
    try {
      await loadCatalog();
      state.reading = readReading();
      state.prefs = validPrefs(readStorage(STORE.prefs, {}));
      applyPrefs();
      paintShell();
      route();
    } catch (error) {
      renderBootError(error);
    }
  }
  if (app) start();
})();
