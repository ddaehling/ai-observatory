/* Parallax · AI Observatory — app.js, assembled from 7 fragments. Do not edit; edit the fragments. */

/* ===== 00-core.js ===== */
/* Parallax · AI Observatory — 00-core.js: the engine and the shell behaviour.
   Buildless vanilla JS, no dependencies, no third-party requests. This fragment OPENS the
   single IIFE that tools/assemble.sh builds into app.js:
     00-core.js  (this)  →  10-marks.js 20-plate.js 30-library.js 40-report.js 50-pages.js  →  99-boot.js
   Everything below is in scope for every later fragment. Function declarations hoist across
   the whole IIFE, so route() calls the view render functions by name when they exist.

   RULES FOR VIEW FRAGMENTS
   • Write top-level declarations at column 0 (the IIFE body is not indented). Never redeclare
     a name listed here: a duplicate const/let is a SyntaxError, and assemble.sh fails on a
     duplicate top-level function (a later function declaration would silently replace one).
   • Do not attach listeners for things the engine already owns: [data-action] clicks, '/',
     Escape-in-search, Cmd/Ctrl+K, #reading-import, form#preferences, hashchange, scroll.
   • Views never write data-theme / data-text / data-motion; only setPref()/applyPrefs() do.

   VIEW RENDER FUNCTIONS (optional; a missing one falls back to renderPlaceholder(name))
     renderLibrary(route, token)   #index and #queue (route.name tells which)
     renderReport(route, token)    #report/<id>[/<anchor>] — only called for IDs in the catalogue
     renderSources(route, token)   #sources[/<id>]
     renderAccounts(route, token)  #accounts[/<id>]
     renderEditions(route, token)  #editions[/<section>]
     renderMethod(route, token)    #method[/<section>]
     renderSettings(route, token)  #settings[/<section>]
   OPTIONAL DECORATION HOOKS (declare them in a view fragment; checked with typeof)
     paletteOptionExtra(item) → HTML appended to each palette option inside an aria-hidden
         span.palette-extra (item = {kind:'report'|'page'|'action', label, detail, url, entry?});
         it must not contain links, buttons or inputs.
     queueProgressHTML(entry, record) → HTML that replaces the default .meter in a queue-sheet
         item (unread items only); give it its own accessible name if it conveys progress.
   route = {name, id, anchor} (decoded). Write into `app` (#app). Return nothing for a
   synchronous render, or a Promise for an async one: #app keeps aria-busy="true" until it
   settles. After every await, `if (!isCurrent(token)) return;`. A rejected promise or a throw
   shows renderViewError(). The router then: sets aria-busy="false", updateReadingControls(),
   measureChrome(), scrolls (top / restored library position / route anchor), and moves focus
   (the view's h1, made tabindex=-1; or the row link of the report the reader came from).

   1. UTILITIES
     $(sel, root=document) → Element|null          $$(sel, root=document) → Element[]
     esc(value) → HTML-escaped string (& < > " ')   cssEsc(value) → CSS.escape
     num(value) → finite Number or null             clamp(value, lo, hi)
     safeURL(value) → absolute http(s) href or ''   hostOf(url) → hostname without www. or ''
     external(url, text, attrs='') → '<a href target=_blank rel="noopener noreferrer" attrs>text
         <span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>';
         unsafe url → escaped text only. attrs is a trusted, pre-escaped attribute string.
     reportURL(id, anchor?) → '#report/<id>[/<anchor>]' (encoded)
     fmtDate(value, {time=false, short=false}) → '14 Nov 2026' | short '14 Nov' | time
         '14 Nov 2026, 07:34' in state.meta.timezone; 'YYYY-MM-DD' shown as recorded;
         missing/invalid → 'Not established' (dates are never guessed)
     isoDate(value) → 'YYYY-MM-DD' or ''
     fmtScore(value, fallback='Not established') → one decimal: '6.5', '7.0'
     fmtInt(value) → en-GB integer, always grouped: '3,851', '12,480'
     plural(n, one, many=one+'s') → '1 report' / '57 reports' (number via fmtInt)
     debounce(fn, ms=150) → wrapped fn with .cancel() and .flush()
     motionReduced() → true when data-motion="reduce" or prefers-reduced-motion: reduce
     collator → Intl.Collator('en', base sensitivity, numeric)
     isVisible(el) → connected, not inside [hidden], has layout boxes
     mq(query) → matchMedia result (safe when matchMedia is missing)

   2. CONSTANTS
     DIMENSIONS  [{key,label,text}] in rubric order: usefulness, impact, novelty, maturity, openness
     HONESTY     'Two runs of the same reviewer model: a consistency check, not independent validation.'
     STORE       {reading:'parallax.v1.reading', prefs:'parallax.v1.prefs'}
     PREF_VALUES {theme:['auto','darkroom','plate','redlight'], text:['s','m','l','xl'],
                  motion:['allow','reduce'], keys:['on','off'], transparency:['system','reduce']}
     PREF_DEFAULTS {theme:'auto', text:'m', motion:'allow', keys:'on', transparency:'system'}
     THEME_LABEL {auto:'Automatic', darkroom:'Night', plate:'Day', redlight:'Night vision'}
     ROUTE_NAMES, ROUTE_TITLES, PAGES (palette pages: {label, detail, url, words})
     FILTER_DEFAULTS {q:'',category:'',min:'',reading:'',sort:'latest'}
     SOURCE_FILTER_DEFAULTS {q:'',kind:'',status:'',scope:''}
     ACCOUNT_FILTER_DEFAULTS {q:'',platform:'',status:'assessed'}
     PROSE_BLOCKS 'p, li, h2, h3, table, blockquote, pre' (what reading progress counts)

   3. STATE  (const app = #app; const state = {…})
     meta            catalogue metadata (generatedAt, lastScanAt, nextScanAt, timezone, reportCount,
                     sourceCount, monitoringSourceCount, repository, rubricVersion, rubricHash, …)
     entries         catalogue entries in data order (newest discoveredAt first); each has the
                     catalog.json fields plus non-enumerable _search {title,entity,category,tags[],
                     sections[],summary} and _hay (one lowercase haystack)
     byId            Map id → catalogue entry
     details         Map id → full report entry (filled by loadReport, or wholesale by data.json)
     sources         null until loadSources(); then records (each with non-enumerable _hay)
     sourceById      Map id → source record
     runs            null until loadRuns(); then full runs (with limitations)
     runsLight       catalogue runs (no limitations; limitationCount)
     sourceStats     {total, monitored, checked, byKind{}, byStatus{}}
     accounts        null until loadAccounts(); then accounts (each with _hay); accountsUpdatedAt
     reading         id → {queued, read, progress 0–100, order?, savedAt?, readAt?, …extra fields kept}
     prefs           validated stored prefs (absent key = default)
     storageOK       false once localStorage failed
     filters         {q, category, min, reading, sort}        (library; the view owns its meaning)
     sourceFilters   {q, kind, status, scope}
     accountFilters  {q, platform, status:'assessed'}          ('assessed' | 'all' | a status)
     route           {name, id, anchor}; routeToken (increments per render); booted
     activeReport    the full entry of the open report — the report view sets it
     listScroll      library scrollY saved when leaving #index/#queue

   4. DATA LAYER (all relative URLs, cache:'no-cache')
     fetchJSON(path) → Promise<json>; one shared promise per path; failures are forgotten so a
         retry refetches. Errors: name NetworkError (status 0) | NotFoundError (404) | HTTPError |
         ParseError | ShapeError, with .status and .path.   forget(path) drops a cached promise.
     loadCatalog()      catalog.json, else data.json reshaped identically (and its bodies, sources
                        and runs kept so nothing is fetched twice). Fills meta/entries/byId/runsLight/sourceStats.
     loadReport(id)     → full entry: details cache → reports/<id>.json → data.json; NotFoundError if absent
     loadSources()      → state.sources (sources.json → data.json)
     loadRuns()         → state.runs (editions.json → data.json)
     loadAccounts()     → state.accounts (accounts.json only; throws ShapeError/HTTP errors; retryable)
     lightEntry(entry), sourceStatsOf(sources), isMonitoring(source)

   5. SEARCH
     queryWords(q) → lowercase words;  matchesQuery(entry, words) → every word in entry._hay
     searchEntries(q, list=state.entries) → matching entries ranked (title prefix > word start >
         substring; title > entity > tags > category > section titles > summary); empty q → copy
     sortEntries(list, sort) — 'latest' (discoveredAt desc) | 'score' | 'title' | 'spread'

   6. AGREEMENT (views depend on these)
     runsOf(entry) → {a, b, dims:[{key,label,text,a,b,mean,diff}], differing, pairs, both, agree}
         a/b are the review objects of run A (reviewerId …_a) and run B (…_b), or null;
         dims a/b are their integers, mean the published mean, diff |a−b|. Cached per object.
     agreementSentence(entry) → 'Runs agree on all 5' | 'Runs differ on 2 of 5' | 'One recorded run'
     arithmetic(entry) → 'Mean of five dimensions: (8.0 + 6.5 + 7.0 + 5.0 + 6.0) ÷ 5 = 6.5'

   7. READING STATE
     record(id) → copy of {queued, read, progress, …}
     setRecord(id, change) → merges, saves, repaints, emits 'parallax:reading'. queued:true appends
         to the queue (order, savedAt); queued:false drops them; read:true stamps readAt;
         read:false resets progress to 0 unless progress is given.
     toggleQueued(id), toggleRead(id) (read → progress 100; unread → 0), moveQueued(id, ±1)
     queuedEntries() → queued catalogue entries in saved order
     inProgress(id), minutesLeft(entry), readingLabel(id) → 'Read' | 'N% read' | 'In queue' | '',
     readingState(id) → 'read' | 'progress' | 'queued' | ''
     saveReading(); readReading(); validateReading(value, {strict=true}) → {records, count, known}
         — shapes only; records for IDs not in the catalogue are kept untouched; strict throws
         (imports), lenient repairs/skips (storage, other tabs).
     exportReading() → downloads parallax-reading-YYYY-MM-DD.json {schemaVersion:1, exportedAt,
         records, preferences}
     importReading(eventOrFile) → merges by ID; announces 'Imported reading data: N records, K of
         them in this edition.' or the reason nothing was imported. Wired automatically for
         input#reading-import and input[type=file][data-import].
     clearReading()
     updateReadingControls(id?) → syncs every [data-action="queue"|"read"][data-id] aria-pressed
         (names stay stable; opt-in text swap with data-on/data-off, into a [data-label] child),
         every [data-reading-label="<id>"] (text) and its closest [data-report-id] (data-reading=
         read|progress|queued|''), #queue-count (hidden at 0), #open-queue aria-label, the open sheet.

   8. PROGRESS (the report view calls these)
     observeProgress(entry, bodyEl=#report-body) — IntersectionObserver over PROSE_BLOCKS in
         bodyEl (skip any inside [data-progress-ignore]); counts blocks seen while scrolling;
         programmatic jumps are guarded; stored progress only increases; saves debounced 300 ms.
     paintProgress(id, pct) → #report-progress (role=progressbar: aria-valuenow, aria-valuetext,
         --p:'N%'), #progress-label ('N% read'), #readbar (--p: 0–1), [data-action="resume"][data-id]
         hidden unless 5 ≤ pct < 97 and not read; then emits 'parallax:progress' {id, pct}.
     stopProgress() (router calls it on leave); guardProgress() before any programmatic scroll;
     resumeReading(id) → scrolls to the stored block, focuses it.

   9. PREFERENCES
     applyPrefs() — theme auto/absent → no data-theme (CSS follows the OS); else data-theme;
         data-text when chosen; data-motion="reduce" / data-transparency="reduce" only; one
         <meta name="theme-color"> = computed --bg; #toggle-theme aria-pressed (dark) + data-shows;
         then emits 'parallax:prefs' {prefs} (also after an OS colour-scheme change or another tab).
     savePrefs(), setPref(key, value) → bool, pref(key) → value or default, validPrefs(obj),
     effectiveTheme() → 'darkroom' | 'plate' | 'redlight', toggleTheme({red=false}).
     The inline script in index.html is the only pre-paint path.

   10. ANNOUNCE
     announce(message, {toast=false}) → the one polite live region #announcer; mirrored as plain
         text into #settings-status and [data-status-mirror] (never make those live regions);
         toast: a visual, aria-hidden echo (#toast, class .toast).

   11. ROUTER
     parseRoute(hash=location.hash) → {name, id, anchor}; '' / #discover / #library → index;
         unknown or malformed → {name:'missing'}.   routeHref(route), isList(name), sameView(a, b)
     route()  hashchange handler. Same view (same name; for reports the same id) → in-view
         navigation; otherwise a new render with a stale-load token, title, aria-current, closed
         dialogs, View Transition when motion is allowed (never on first load).
     rerender() → Promise; re-render the current view in place (no transition/focus/scroll change)
     isCurrent(token) → token is still the current route's
     setTitle(text) → document.title = text + ' · Parallax'
     onLeave(fn(prev, next)) — run once when the route leaves this view (before the next render
         and before the View Transition snapshot). Also onScroll subscriptions end there.
     onSubroute(fn(next, prev)) — handle address changes inside this view (#sources/<id>,
         #accounts/<id>, #method/<section>, #report/<id>/<anchor>). Return false to fall back to
         the default: scroll to the anchor (report) / element id (pages), or to the top.
     Same-view links are followed with history.replaceState (no history entry): one Back press
         from anywhere inside a report returns to the library. A plain fragment link (#some-id)
         to an element inside #app scrolls to it and leaves the address unchanged.
     setTransitionNames(fromEl, toEl, name='vt-shared') — call before the route changes (click
         handler or onLeave). fromEl is named now; toEl (Element | selector inside #app |
         () => Element) is named after the new view renders; cleared when the transition ends.
     transition(update, animate=true), scrollToAnchor(id, {focus=true}) (clears the masthead via
         scroll-padding), replaceRoute(href), measureChrome() (sets --mast-live on <html>),
         focusHeading(), rowLinkFor(id) → '[data-report-id=id] a[href="#report/id"]'.
     Titles: 'Library · Parallax · AI Observatory', '<report title> · Parallax', 'Sources · …'.
     aria-current="page" on a[data-nav]: report and queue light 'index'; accounts lights
         'accounts' (or 'sources' when no accounts link exists).

   12–14. DIALOGS, PALETTE, QUEUE SHEET
     showDialog(dialog) (modal; closes others; focus returns to the opener on close; backdrop
         click closes), openPalette(query=''), renderPalette(), selectPalette(i), runPaletteItem(item),
         openQueue(), renderQueue(), removeFromQueue(id), undoRemove(), searchLibrary(q)
     Palette: #palette-input (combobox, aria-expanded, aria-controls, aria-activedescendant) and
         #palette-list (listbox) with li[role=option].palette-opt#palette-option-N
         [data-palette-index][data-kind=report|page|action] > .palette-label + .palette-detail,
         and li[role=presentation].palette-group headings. Empty query: Continue reading, Pages,
         Recent reports. ↑/↓ PageUp/PageDown, Enter opens, Cmd/Ctrl+Enter saves the report,
         Escape closes, Cmd/Ctrl+K anywhere.
     Queue sheet: #queue-body ol.queue-list > li.queue-item[data-report-id] (link, .meter,
         .queue-meta, .queue-tools with data-action queue-up / queue-down / queue-remove) or an
         empty .state; #queue-foot (.queue-total, Undo [data-action=queue-undo], #queue link, Export).

   15. sanitize(html) → contract tags only (p h3 ul ol li strong em a code pre blockquote table
       thead tbody tr th td br), no attributes except safe hrefs (new tab), tables wrapped in
       div.table-wrap[role=region][tabindex=0][aria-label].

   16. ACTIONS AND EVENTS
     registerAction(name, handler(el, event)) → restore(); replaces a built-in of the same name.
       Built-ins (on any [data-action] element; data-id names the report):
       queue, read, resume, export, import (clicks #reading-import or #<data-input>),
       reset-filters (state.filters = FILTER_DEFAULTS; rerender list; focus its search),
       queue-up, queue-down, queue-remove, queue-undo, clear-reading, palette (data-query),
       open-queue, theme (data-value), retry (rerender), retry-boot (start).
     onScroll(fn(y, dy), {persist=false}) → unsubscribe; rAF-throttled, passive.
     Events on document: 'parallax:reading' {id|null} after any reading change;
       'parallax:route' {route, prev, same} after a route settles;
       'parallax:progress' {id, pct} after reading progress is painted (paintProgress);
       'parallax:prefs' {prefs} after preferences are applied (applyPrefs).
     Keys: '/' (off when prefs.keys='off') focuses searchField() — the first visible
       [data-search], #report-search, #source-search or #account-search in #app — or goes to
       #index and focuses it; Escape clears a focused non-empty search field (type=search,
       role=searchbox or [data-search]) and dispatches 'input'; Cmd/Ctrl+K opens the palette.
     Forms: form#preferences controls named theme|text|motion|keys|transparency call setPref;
       forms without an action attribute never submit.
     Also: pagehide/visibilitychange save; 'storage' syncs reading and prefs across tabs;
       prefers-color-scheme change re-applies prefs; offline sets html[data-offline].

   17. STATES
     renderPlaceholder(name, route?, token?) — neutral working stand-ins (data-placeholder=name)
     renderMissing(kind='page'|'report') — h1, explanation, link to #index (data-missing=kind)
     renderViewError(error), renderBootError(error) (Try again → start())

   18. BOOT
     start() → Promise<boolean>: loadCatalog, read storage, paintShell (colophon #colophon-repo,
       [data-kbd] labels: '⌘K' on Apple platforms, 'Ctrl K' elsewhere; data-kbd="mod" → 'Ctrl'),
       route(). 99-boot.js calls start() and closes the IIFE.

   IDS AND HOOKS VIEWS MUST EMIT
     #report-search (or [data-search]) in the library; #report-count; #report-list with rows
       [data-report-id="<id>"] containing a[href="#report/<id>"]; [data-action="queue"|"read"]
       buttons with data-id and aria-pressed; [data-reading-label="<id>"].
     Report: an h1; #report-body around the prose only; section ids section-<id>; #ratings;
       #sources; contents links '#report/<id>/<anchor>'; #report-progress, #progress-label,
       [data-action="resume"][data-id]; set state.activeReport and call observeProgress(entry, body).
     Sources: #source-search, #source-count; Accounts: #account-search, #account-platform,
       #account-status, #account-count, entries id="account-<id>"; Settings: form#preferences,
       input#reading-import, #settings-status (not live), [data-action="export"].

   CSS (10-base.css) — layers: reset, tokens, base, components, views, themes, print.
     base: html/body, focus ring (:focus-visible outline 2px var(--focus)), .skip, #readbar,
       .masthead .brand .brand-mark .brand-word .brand-sub .masthead-nav .masthead-tools .tool
       .tool-icon .tool-label .tool-count #open-menu, .colophon, reduced motion, forced colours.
     components: .sr-only .wrap .measure .stack .cluster .card .button (.button-primary
       .button-quiet .button-danger, [aria-pressed=true]) .icon-btn .chip (label.chip > input)
       .field .input .tag kbd/.kbd .skeleton .skeleton-line(.short) .skeleton-block .meter (>span,
       --p) .table-wrap .state .ext .toast dialog.palette dialog.sheet .sheet-head .sheet-body
       .sheet-foot .palette-field .palette-group .palette-note .palette-opt .palette-label
       .palette-detail .palette-empty .palette-foot .queue-list .queue-item .queue-meta
       .queue-tools .menu-list .placeholder .placeholder-list.
     Run-time custom properties: --mast-live (measured masthead), --sticky-extra (a view's extra
       sticky height under the masthead), --p.
     Run-time attributes: html[data-scrolled] (scrollY > 8), html[data-offline],
       html.has-dialog (a modal is open), body[data-route=<route name>],
       #masthead[data-compact~="labels"|"nav"|"sub"] (set by measureChrome only when the masthead
       content does not fit: hide tool labels, then .brand-sub, then swap the nav for #open-menu),
       #toggle-theme[aria-pressed][data-shows=darkroom|plate|redlight].
     Shell slots: footer.colophon > .colophon-line, #colophon-schedule (edition + next scan),
       nav.colophon-cols > .colophon-col (Read / Your reading / Follow), #colophon-repo (an li
       holding the archive link; hidden without a repository), .colophon-honesty, .colophon-privacy.
*/
(() => {
'use strict';

/* =========================================================================== 1. UTILITIES */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);
const cssEsc = value => (window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/["\\\]]/g, '\\$&'));
const num = value => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

function safeURL(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch (_) { return ''; }
}
function hostOf(value) {
  const href = safeURL(value);
  if (!href) return '';
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}
/* An external link: new tab, no opener, no referrer, an arrow that is not read, and an
   accessible name that starts with the visible text. Unsafe URLs return the text only.
   `attrs` is a trusted, pre-escaped attribute string written by the caller. */
function external(url, text, attrs = '') {
  const href = safeURL(url);
  const label = esc(text === undefined || text === null || text === '' ? hostOf(url) || url : text);
  if (!href) return label;
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${attrs ? ` ${attrs}` : ''}>${label}<span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`;
}
const reportURL = (id, anchor) => `#report/${encodeURIComponent(id)}${anchor ? `/${encodeURIComponent(anchor)}` : ''}`;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dateFormats = new Map();
function dateFormat(opts, zone) {
  const key = `${zone}|${JSON.stringify(opts)}`;
  if (!dateFormats.has(key)) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: zone }); }
    catch (_) { fmt = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }); }
    dateFormats.set(key, fmt);
  }
  return dateFormats.get(key);
}
/* "14 Nov 2026"; short: "14 Nov"; time: "14 Nov 2026, 07:34" in the edition's time zone.
   A date-only value ("2026-11-12") is shown as recorded, never shifted by a zone.
   Missing or invalid values read "Not established" — dates are never guessed. */
function fmtDate(value, { time = false, short = false } = {}) {
  if (value === null || value === undefined || value === '') return 'Not established';
  const text = String(value);
  const dateOnly = DATE_ONLY.test(text);
  const d = new Date(dateOnly ? `${text}T12:00:00Z` : text);
  if (!Number.isFinite(d.getTime())) return 'Not established';
  const opts = short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  if (time && !dateOnly) Object.assign(opts, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const zone = dateOnly ? 'UTC' : (state.meta && state.meta.timezone) || 'UTC';
  try { return dateFormat(opts, zone).format(d); } catch (_) { return d.toISOString().slice(0, 10); }
}
function isoDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  if (DATE_ONLY.test(text)) return text;
  const d = new Date(text);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}
/* Scores always carry one decimal: 6.5, 7.0. */
const fmtScore = (value, fallback = 'Not established') => (num(value) === null ? fallback : num(value).toFixed(1));
/* Integers in en-GB. Four-figure numbers are written without a separator (3851) and
   five figures and up are grouped (12,480): the house style the integration suite pins
   (#source-count must contain the raw total). */
const intFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
function fmtInt(value) {
  const n = num(value);
  if (n === null) return '0';
  const r = Math.round(n);
  return intFormat.format(r);   /* 3,851 — grouped from four figures, the same everywhere */
}
const plural = (n, one, many = `${one}s`) => `${fmtInt(n)} ${Number(n) === 1 ? one : many}`;
function debounce(fn, ms = 150) {
  let timer = 0, args = null, self = null;
  const run = () => { timer = 0; const a = args; args = null; fn.apply(self, a || []); };
  const wrapped = function debounced(...a) { args = a; self = this; clearTimeout(timer); timer = setTimeout(run, ms); };
  wrapped.cancel = () => { clearTimeout(timer); timer = 0; args = null; };
  wrapped.flush = () => { if (timer) { clearTimeout(timer); run(); } };
  return wrapped;
}
const mq = query => (typeof matchMedia === 'function' ? matchMedia(query) : { matches: false, addEventListener() {} });
const motionReduced = () => document.documentElement.getAttribute('data-motion') === 'reduce' || mq('(prefers-reduced-motion: reduce)').matches;
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const isVisible = el => !!(el && el.isConnected && !el.closest('[hidden]') && el.getClientRects().length);

/* =========================================================================== 2. CONSTANTS */
const DIMENSIONS = Object.freeze([
  { key: 'usefulness', label: 'Usefulness', text: 'Actionable value for people who teach and build.' },
  { key: 'impact', label: 'Impact', text: 'Potential significance to AI development, grounded in evidence.' },
  { key: 'novelty', label: 'Novelty', text: 'Demonstrated difference, rather than promotional claims.' },
  { key: 'maturity', label: 'Maturity', text: 'Documented readiness and reliability; no assumed benchmark performance.' },
  { key: 'openness', label: 'Openness', text: 'Inspectability, licensing, portability and reproducibility.' }
].map(Object.freeze));
const HONESTY = 'Two runs of the same reviewer model: a consistency check, not independent validation.';
const STORE = Object.freeze({ reading: 'parallax.v1.reading', prefs: 'parallax.v1.prefs' });
const PREF_VALUES = Object.freeze({
  theme: ['auto', 'darkroom', 'plate', 'redlight'],
  text: ['s', 'm', 'l', 'xl'],
  motion: ['allow', 'reduce'],
  /* WCAG 2.1.4: the single-key "/" shortcut has an off switch. */
  keys: ['on', 'off'],
  transparency: ['system', 'reduce']
});
const PREF_DEFAULTS = Object.freeze({ theme: 'auto', text: 'm', motion: 'allow', keys: 'on', transparency: 'system' });
const THEME_LABEL = Object.freeze({ auto: 'Automatic', darkroom: 'Night', plate: 'Day', redlight: 'Night vision' });
const ROUTE_NAMES = Object.freeze(['index', 'queue', 'report', 'sources', 'accounts', 'editions', 'method', 'settings']);
const ROUTE_TITLES = Object.freeze({ index: 'Library', queue: 'Reading queue', report: 'Report', sources: 'Sources', accounts: 'AI accounts', editions: 'Editions', method: 'Method', settings: 'Settings', missing: 'Not found' });
const PAGES = Object.freeze([
  { label: 'Library', detail: 'Every report', url: '#index', words: 'index home reports discover' },
  { label: 'Reading queue', detail: 'Reports you saved', url: '#queue', words: 'saved list later' },
  { label: 'Sources', detail: 'The source ledger', url: '#sources', words: 'ledger evidence provenance' },
  { label: 'AI accounts', detail: 'Public accounts worth watching', url: '#accounts', words: 'directory people x github' },
  { label: 'Editions', detail: 'Every scan and its limits', url: '#editions', words: 'scans runs coverage log' },
  { label: 'Method', detail: 'How reports are researched and rated', url: '#method', words: 'rubric ratings review' },
  { label: 'Settings', detail: 'Appearance, text size, your reading data', url: '#settings', words: 'preferences theme export import' }
]);
const FILTER_DEFAULTS = Object.freeze({ q: '', category: '', min: '', reading: '', sort: 'latest' });
const SOURCE_FILTER_DEFAULTS = Object.freeze({ q: '', kind: '', status: '', scope: '' });
const ACCOUNT_FILTER_DEFAULTS = Object.freeze({ q: '', platform: '', status: 'assessed' });
const PROSE_BLOCKS = 'p, li, h2, h3, table, blockquote, pre';

/* =============================================================================== 3. STATE */
const app = document.getElementById('app');
const state = {
  meta: null,                 /* catalogue metadata (title, generatedAt, lastScanAt, timezone, counts…) */
  entries: [],                /* catalogue entries, data order (newest discoveredAt first) */
  byId: new Map(),            /* id → catalogue entry */
  details: new Map(),         /* id → full report entry (reports/<id>.json or data.json) */
  sources: null,              /* source records once loadSources() resolved, else null */
  sourceById: new Map(),      /* id → source record */
  runs: null,                 /* full edition runs once loadRuns() resolved, else null */
  runsLight: [],              /* catalogue runs: no limitations, plus limitationCount */
  sourceStats: null,          /* {total, monitored, checked, byKind, byStatus} */
  accounts: null,             /* account directory once loadAccounts() resolved, else null */
  accountsUpdatedAt: null,
  reading: Object.create(null), /* id → {queued, read, progress, order?, savedAt?, readAt?, …} */
  prefs: {},                  /* validated stored preferences; absent key = default */
  storageOK: true,
  filters: { ...FILTER_DEFAULTS },
  sourceFilters: { ...SOURCE_FILTER_DEFAULTS },
  accountFilters: { ...ACCOUNT_FILTER_DEFAULTS },
  route: { name: '', id: '', anchor: '' },
  routeToken: 0,
  booted: false,
  activeReport: null,         /* full entry of the open report, set by the report view */
  listScroll: 0
};

/* ========================================================================== 4. DATA LAYER */
const inflight = new Map();
function dataError(name, message, props = {}) {
  const error = new Error(message);
  error.name = name;
  return Object.assign(error, { status: 0, path: '' }, props);
}
/* GET a JSON file relative to the page. Revalidates with the server (cache: no-cache),
   shares one promise per path for the whole visit, and forgets failures so a retry
   refetches. Errors are typed: NetworkError (status 0), NotFoundError (404),
   HTTPError (other status), ParseError (invalid JSON) — each with .status and .path. */
function fetchJSON(path) {
  if (inflight.has(path)) return inflight.get(path);
  const request = (async () => {
    let response;
    try { response = await fetch(path, { cache: 'no-cache' }); }
    catch (cause) { throw dataError('NetworkError', `${path} could not be reached.`, { path, cause }); }
    if (!response.ok) {
      throw dataError(response.status === 404 ? 'NotFoundError' : 'HTTPError', `${path} returned ${response.status}.`, { path, status: response.status });
    }
    try { return await response.json(); }
    catch (cause) { throw dataError('ParseError', `${path} is not valid JSON.`, { path, status: response.status, cause }); }
  })();
  inflight.set(path, request);
  request.catch(() => { if (inflight.get(path) === request) inflight.delete(path); });
  return request;
}
const forget = path => { inflight.delete(path); };

const lower = value => String(value ?? '').toLowerCase();
const LIGHT_KEYS = ['id', 'title', 'entity', 'category', 'tags', 'summary', 'changeType', 'publishedAt', 'discoveredAt', 'updatedAt', 'officialUrl', 'judgment', 'scores', 'score', 'wordCount', 'readMinutes'];
function lightEntry(entry) {
  const out = {};
  for (const key of LIGHT_KEYS) if (key in entry) out[key] = entry[key];
  if (Array.isArray(entry.sections)) out.sections = entry.sections.filter(Boolean).map(s => ({ id: s.id, title: s.title }));
  if (Array.isArray(entry.reviews)) out.reviews = entry.reviews.filter(Boolean).map(r => ({ reviewerId: r.reviewerId, verdict: r.verdict, confidence: r.confidence, reviewedAt: r.reviewedAt, scores: r.scores }));
  out.sourceCount = Array.isArray(entry.sources) ? entry.sources.length : 0;
  out.useCaseCount = Array.isArray(entry.useCases) ? entry.useCases.length : 0;
  out.limitationCount = Array.isArray(entry.limitations) ? entry.limitations.length : 0;
  return out;
}
function tally(list, field) {
  const counts = {};
  for (const item of list) {
    const value = item && typeof item[field] === 'string' && item[field] ? item[field] : 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
const isMonitoring = s => s && s.monitor !== false && s.status !== 'retired';
function sourceStatsOf(sources) {
  return {
    total: sources.length,
    monitored: sources.filter(isMonitoring).length,
    checked: sources.filter(s => s && s.lastCheckedAt).length,
    byKind: tally(sources, 'kind'),
    byStatus: tally(sources, 'status')
  };
}
/* Search fields are built once per entry: search never rebuilds strings per keystroke. */
function indexEntry(entry) {
  const tags = Array.isArray(entry.tags) ? entry.tags.map(lower) : [];
  const sections = Array.isArray(entry.sections) ? entry.sections.map(s => lower(s && s.title)) : [];
  const fields = { title: lower(entry.title), entity: lower(entry.entity), category: lower(entry.category), tags, sections, summary: lower(entry.summary) };
  Object.defineProperty(entry, '_search', { value: fields, configurable: true });
  Object.defineProperty(entry, '_hay', { value: [fields.title, fields.entity, fields.category, ...tags, fields.summary, ...sections].join(' \u0001 '), configurable: true });
}
function setSources(list) {
  state.sources = list.filter(s => s && typeof s === 'object');
  state.sourceById = new Map();
  for (const s of state.sources) {
    if (typeof s.id === 'string') state.sourceById.set(s.id, s);
    Object.defineProperty(s, '_hay', { value: [s.name, s.url, s.notes, s.kind, s.status, ...(Array.isArray(s.topics) ? s.topics : [])].map(lower).join(' '), configurable: true });
  }
  if (!state.sourceStats) state.sourceStats = sourceStatsOf(state.sources);
  return state.sources;
}
/* data.json carries everything: use it to rebuild the catalogue's exact shape, and keep
   its report bodies, sources and runs so nothing is fetched twice. */
function catalogFromData(data) {
  const entries = data.entries.filter(e => e && typeof e.id === 'string');
  for (const entry of entries) state.details.set(entry.id, entry);
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const runs = Array.isArray(data.runs) ? data.runs : [];
  if (!state.sources) setSources(sources);
  if (!state.runs) state.runs = runs;
  return {
    schemaVersion: 1,
    metadata: data.metadata,
    entries: entries.map(lightEntry),
    runs: runs.map(run => { const { limitations, ...rest } = run || {}; return { ...rest, limitationCount: Array.isArray(limitations) ? limitations.length : 0 }; }),
    sourceStats: sourceStatsOf(sources)
  };
}
async function loadCatalog() {
  let catalog;
  try {
    catalog = await fetchJSON('./catalog.json');
    if (!catalog || typeof catalog !== 'object' || !catalog.metadata || !Array.isArray(catalog.entries)) {
      forget('./catalog.json');
      throw dataError('ShapeError', 'catalog.json has an unexpected shape.', { path: './catalog.json', status: 200 });
    }
  } catch (primary) {
    let data;
    try { data = await fetchJSON('./data.json'); }
    catch (fallback) { fallback.primary = primary; throw fallback; }
    if (!data || typeof data !== 'object' || !data.metadata || !Array.isArray(data.entries)) {
      forget('./data.json');
      throw dataError('ShapeError', 'The edition data has an unexpected shape.', { path: './data.json', status: 200, primary });
    }
    catalog = catalogFromData(data);
  }
  const seen = new Set();
  state.meta = catalog.metadata;
  state.entries = catalog.entries.filter(e => e && typeof e.id === 'string' && e.id && !seen.has(e.id) && seen.add(e.id));
  state.byId = new Map(state.entries.map(e => [e.id, e]));
  for (const entry of state.entries) indexEntry(entry);
  state.runsLight = Array.isArray(catalog.runs) ? catalog.runs : [];
  state.sourceStats = catalog.sourceStats && typeof catalog.sourceStats === 'object' ? catalog.sourceStats : (state.sources ? sourceStatsOf(state.sources) : null);
  return catalog;
}
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
async function loadReport(id) {
  if (state.details.has(id)) return state.details.get(id);
  let entry = null;
  if (SAFE_ID.test(String(id))) {
    try {
      const payload = await fetchJSON(`./reports/${encodeURIComponent(id)}.json`);
      entry = payload && payload.entry && payload.entry.id === id ? payload.entry : null;
    } catch (_) { entry = null; }
  }
  if (!entry) {
    const data = await fetchJSON('./data.json');
    entry = (data && Array.isArray(data.entries) ? data.entries : []).find(item => item && item.id === id) || null;
    if (!entry) throw dataError('NotFoundError', 'This report is not in the current edition.', { status: 404, path: `./reports/${id}.json` });
  }
  state.details.set(id, entry);
  return entry;
}
async function loadSources() {
  if (state.sources) return state.sources;
  let list;
  try {
    const payload = await fetchJSON('./sources.json');
    if (!payload || !Array.isArray(payload.sources)) { forget('./sources.json'); throw dataError('ShapeError', 'sources.json has an unexpected shape.', { path: './sources.json', status: 200 }); }
    list = payload.sources;
  } catch (_) {
    const data = await fetchJSON('./data.json');
    list = data && Array.isArray(data.sources) ? data.sources : [];
  }
  return state.sources || setSources(list);
}
async function loadRuns() {
  if (state.runs) return state.runs;
  let runs;
  try {
    const payload = await fetchJSON('./editions.json');
    if (!payload || !Array.isArray(payload.runs)) { forget('./editions.json'); throw dataError('ShapeError', 'editions.json has an unexpected shape.', { path: './editions.json', status: 200 }); }
    runs = payload.runs;
  } catch (_) {
    const data = await fetchJSON('./data.json');
    runs = data && Array.isArray(data.runs) ? data.runs : [];
  }
  if (!state.runs) state.runs = runs.filter(r => r && typeof r === 'object');
  return state.runs;
}
/* accounts.json has no fallback: data.json does not carry the directory. */
async function loadAccounts() {
  if (state.accounts) return state.accounts;
  const payload = await fetchJSON('./accounts.json');
  if (!payload || !Array.isArray(payload.accounts)) {
    forget('./accounts.json');
    throw dataError('ShapeError', 'accounts.json has an unexpected shape.', { path: './accounts.json', status: 200 });
  }
  state.accountsUpdatedAt = payload.updatedAt || null;
  state.accounts = payload.accounts.filter(a => a && typeof a.id === 'string');
  for (const a of state.accounts) {
    Object.defineProperty(a, '_hay', { value: [a.name, a.url, a.platform, a.editorialRole, a.whyMonitor, ...(Array.isArray(a.topics) ? a.topics : [])].map(lower).join(' '), configurable: true });
  }
  return state.accounts;
}

/* ========================================================================= 5. SEARCH */
/* One ranked search, shared by the palette and any view. Every word must occur
   somewhere in the entry; prefix and word-start matches outrank substrings. */
const queryWords = q => lower(q).trim().split(/\s+/).filter(Boolean);
const matchesQuery = (entry, words) => !words.length || (entry._hay ? words.every(w => entry._hay.includes(w)) : false);
function wordScore(text, word, prefix, start, sub) {
  if (!text) return 0;
  if (text.startsWith(word)) return prefix;
  const at = text.indexOf(word);
  if (at < 0) return 0;
  return /[\s\-_/:(.,'"]/.test(text[at - 1]) ? start : sub;
}
function rankEntry(entry, words) {
  const f = entry._search;
  if (!f) return 0;
  let total = 0;
  for (const w of words) {
    let best = Math.max(
      wordScore(f.title, w, 12, 9, 4),
      wordScore(f.entity, w, 10, 8, 3),
      ...f.tags.map(t => wordScore(t, w, 6, 5, 2)),
      wordScore(f.category, w, 4, 3, 1),
      ...f.sections.map(t => wordScore(t, w, 3, 3, 1)),
      wordScore(f.summary, w, 2, 2, 1)
    );
    if (!best) return 0;
    total += best;
  }
  if (words.length > 1 && f.title.includes(words.join(' '))) total += 6;
  return total;
}
function searchEntries(q, list = state.entries) {
  const words = queryWords(q);
  if (!words.length) return list.slice();
  return list.map((entry, i) => ({ entry, i, s: matchesQuery(entry, words) ? rankEntry(entry, words) : 0 }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.entry);
}
const SORTS = Object.freeze({
  latest: (a, b) => String(b.discoveredAt || '').localeCompare(String(a.discoveredAt || '')) || collator.compare(a.title || '', b.title || ''),
  score: (a, b) => (num(b.score) ?? -1) - (num(a.score) ?? -1) || collator.compare(a.title || '', b.title || ''),
  title: (a, b) => collator.compare(a.title || '', b.title || ''),
  spread: (a, b) => runsOf(b).differing - runsOf(a).differing || (num(b.score) ?? -1) - (num(a.score) ?? -1)
});
const sortEntries = (list, sort = 'latest') => list.slice().sort(SORTS[sort] || SORTS.latest);

/* ======================================================================= 6. AGREEMENT */
const RUN_A = /_a\d*$/i;
const RUN_B = /_b\d*$/i;
const runCache = new WeakMap();
/* Run A and run B of the same reviewer model, per dimension, from the recorded integers.
   Returns {a, b, dims:[{key,label,text,a,b,mean,diff}], differing, pairs, both, agree}. */
function runsOf(entry) {
  if (!entry || typeof entry !== 'object') return { a: null, b: null, dims: [], differing: 0, pairs: 0, both: false, agree: false };
  if (runCache.has(entry)) return runCache.get(entry);
  const reviews = Array.isArray(entry.reviews) ? entry.reviews.filter(r => r && typeof r === 'object' && r.scores && typeof r.scores === 'object') : [];
  const a = reviews.find(r => RUN_A.test(String(r.reviewerId || ''))) || reviews[0] || null;
  const b = reviews.find(r => r !== a && RUN_B.test(String(r.reviewerId || ''))) || reviews.find(r => r !== a) || null;
  const dims = DIMENSIONS.map(d => {
    const av = a ? num(a.scores[d.key]) : null;
    const bv = b ? num(b.scores[d.key]) : null;
    let mean = num(entry.scores && entry.scores[d.key]);
    if (mean === null && av !== null && bv !== null) mean = Math.round(((av + bv) / 2) * 10) / 10;
    return { key: d.key, label: d.label, text: d.text, a: av, b: bv, mean, diff: av !== null && bv !== null ? Math.abs(av - bv) : null };
  });
  const pairs = dims.filter(d => d.diff !== null).length;
  const differing = dims.filter(d => d.diff !== null && d.diff !== 0).length;
  const result = { a, b, dims, differing, pairs, both: !!(a && b), agree: !!(a && b) && pairs > 0 && differing === 0 };
  runCache.set(entry, result);
  return result;
}
function agreementSentence(entry) {
  const r = runsOf(entry);
  if (!r.both || !r.pairs) return 'One recorded run';
  return r.differing ? `Runs differ on ${r.differing} of ${r.pairs}` : `Runs agree on all ${r.pairs}`;
}
function arithmetic(entry) {
  const r = runsOf(entry);
  const parts = r.dims.map(d => (d.mean === null ? '–' : fmtScore(d.mean)));
  let overall = num(entry && entry.score);
  if (overall === null && r.dims.length && r.dims.every(d => d.mean !== null)) overall = Math.round((r.dims.reduce((s, d) => s + d.mean, 0) / r.dims.length) * 10) / 10;
  return `Mean of five dimensions: (${parts.join(' + ')}) ÷ 5 = ${fmtScore(overall, '–')}`;
}

/* =================================================================== 7. READING STATE */
const DEFAULT_RECORD = Object.freeze({ queued: false, read: false, progress: 0 });
const record = id => {
  const r = Object.prototype.hasOwnProperty.call(state.reading, id) ? state.reading[id] : null;
  return r ? { ...r } : { ...DEFAULT_RECORD };
};
const isShaped = r => !!r && typeof r === 'object' && !Array.isArray(r) && typeof r.queued === 'boolean' && typeof r.read === 'boolean' &&
  typeof r.progress === 'number' && Number.isFinite(r.progress) && r.progress >= 0 && r.progress <= 100;
const READING_SCHEMA_ERROR = 'That is not a Parallax reading-data export (schema version 1). Nothing was imported.';
const READING_VALUE_ERROR = 'The reading data contains invalid values. Nothing was imported.';
/* Checks shapes only. Records for report IDs that are not in this catalogue are kept
   untouched (with every extra field): a withdrawn report, or one in a part of the
   library this visit never loaded, must not lose the reader's place.
   strict (imports): any malformed record throws and nothing is taken.
   lenient (storage, other tabs): malformed records are repaired or skipped, never thrown. */
function validateReading(value, { strict = true } = {}) {
  const records = Object.create(null);
  let count = 0, known = 0;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 ||
      !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) {
    if (strict) throw new Error(READING_SCHEMA_ERROR);
    return { records, count, known };
  }
  for (const [id, item] of Object.entries(value.records)) {
    if (!id || id.length > 200) { if (strict) throw new Error(READING_VALUE_ERROR); continue; }
    if (strict && !isShaped(item)) throw new Error(READING_VALUE_ERROR);
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const progress = num(item.progress);
    records[id] = { ...item, queued: item.queued === true, read: item.read === true, progress: progress === null ? 0 : clamp(Math.round(progress), 0, 100) };
    count++;
    if (state.byId.has(id)) known++;
  }
  return { records, count, known };
}
function readStorage(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch (error) { if (!(error instanceof SyntaxError)) state.storageOK = false; return null; }
}
const readReading = () => validateReading(readStorage(STORE.reading), { strict: false }).records;
let storageWarned = false;
function saveReading() {
  clearTimeout(progress.timer);
  progress.timer = 0;
  try {
    localStorage.setItem(STORE.reading, JSON.stringify({ schemaVersion: 1, records: state.reading }));
    state.storageOK = true;
  } catch (_) {
    state.storageOK = false;
    if (!storageWarned) { storageWarned = true; announce('Browser storage is unavailable. Export your reading data before closing this tab.'); }
  }
}
function nextQueueOrder() {
  let max = -1;
  for (const r of Object.values(state.reading)) if (r && r.queued && Number.isFinite(Number(r.order))) max = Math.max(max, Number(r.order));
  return max + 1;
}
/* Merge a change into one record, save, and repaint every control that shows it.
   Saving appends to the end of the queue (order, savedAt); unqueueing forgets the slot;
   marking read stamps readAt; unmarking read resets progress to 0. */
function setRecord(id, change = {}) {
  if (typeof id !== 'string' || !id) return { ...DEFAULT_RECORD };
  const prev = Object.prototype.hasOwnProperty.call(state.reading, id) ? state.reading[id] : null;
  const next = { ...record(id), ...change };
  next.queued = next.queued === true;
  next.read = next.read === true;
  next.progress = clamp(Math.round(num(next.progress) ?? 0), 0, 100);
  if (change.queued === true && !(prev && prev.queued)) { next.order = nextQueueOrder(); next.savedAt = new Date().toISOString(); }
  if (change.queued === false) { delete next.order; delete next.savedAt; }
  if (change.read === true && !(prev && prev.read)) next.readAt = new Date().toISOString();
  if (change.read === false) { delete next.readAt; if (!('progress' in change)) next.progress = 0; }
  state.reading[id] = next;
  saveReading();
  updateReadingControls(id);
  if (progress.id === id) paintProgress(id, next.progress);
  emitReading(id);
  return { ...next };
}
const inProgress = id => { const r = record(id); return !r.read && r.progress >= 5 && r.progress < 97; };
const minutesLeft = entry => Math.max(1, Math.round((num(entry && entry.readMinutes) || 0) * (1 - record(entry.id).progress / 100)));
function readingLabel(id) {
  const r = record(id);
  if (r.read) return 'Read';
  if (r.progress >= 5) return `${r.progress}% read`;
  if (r.queued) return 'In queue';
  return '';
}
const readingState = id => { const r = record(id); return r.read ? 'read' : r.progress >= 5 ? 'progress' : r.queued ? 'queued' : ''; };
/* Queued reports in the order they were saved (or as the reader reordered them). */
function queuedEntries() {
  const order = e => { const r = record(e.id); return Number.isFinite(Number(r.order)) ? Number(r.order) : Number.MAX_SAFE_INTEGER; };
  return state.entries.filter(e => record(e.id).queued)
    .sort((a, b) => order(a) - order(b) || String(record(a.id).savedAt || '').localeCompare(String(record(b.id).savedAt || '')) || collator.compare(a.title || '', b.title || ''));
}
function moveQueued(id, delta) {
  const list = queuedEntries();
  const at = list.findIndex(e => e.id === id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= list.length) return false;
  list.splice(to, 0, list.splice(at, 1)[0]);
  list.forEach((entry, i) => { state.reading[entry.id] = { ...record(entry.id), order: i }; });
  saveReading();
  updateReadingControls();
  emitReading(id);
  announce(`${(state.byId.get(id) || {}).title || 'Report'} moved to position ${to + 1} of ${list.length}.`);
  return true;
}
function toggleQueued(id) {
  const on = !record(id).queued;
  setRecord(id, { queued: on });
  const title = (state.byId.get(id) || {}).title;
  announce(on ? `Saved${title ? ` ${title}` : ''} to your reading queue.` : `Removed${title ? ` ${title}` : ''} from your reading queue.`);
  return on;
}
function toggleRead(id) {
  const on = !record(id).read;
  setRecord(id, on ? { read: true, progress: 100 } : { read: false, progress: 0 });
  announce(on ? 'Marked as read.' : 'Marked as unread. Reading progress was reset.');
  return on;
}
/* Sync every reading control with the stored state. With an id, only that report's
   controls are touched. Toggles keep their accessible name; only aria-pressed changes,
   unless a button opts in with data-on / data-off (text swapped in its [data-label]
   child, or the button itself). */
function updateReadingControls(id) {
  const scope = id ? `[data-id="${cssEsc(id)}"]` : '[data-id]';
  for (const button of $$(`[data-action="queue"]${scope}, [data-action="read"]${scope}`)) {
    const r = record(button.dataset.id);
    const on = button.dataset.action === 'queue' ? r.queued : r.read;
    button.setAttribute('aria-pressed', String(on));
    if (button.dataset.on !== undefined && button.dataset.off !== undefined) {
      const target = $('[data-label]', button) || button;
      target.textContent = on ? button.dataset.on : button.dataset.off;
    }
  }
  for (const label of $$(id ? `[data-reading-label="${cssEsc(id)}"]` : '[data-reading-label]')) {
    const who = label.dataset.readingLabel;
    label.textContent = readingLabel(who);
    const row = label.closest('[data-report-id]');
    if (row) row.setAttribute('data-reading', readingState(who));
  }
  const n = state.entries.reduce((sum, e) => sum + (record(e.id).queued ? 1 : 0), 0);
  const badge = document.getElementById('queue-count');
  if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
  const tool = document.getElementById('open-queue');
  if (tool) tool.setAttribute('aria-label', n ? `Queue, ${plural(n, 'report')} saved` : 'Queue');
  const sheet = document.getElementById('queue');
  if (sheet && sheet.open) renderQueue();
}
function exportReading() {
  const value = { schemaVersion: 1, exportedAt: new Date().toISOString(), records: state.reading, preferences: validPrefs(state.prefs) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `parallax-reading-${new Date().toISOString().slice(0, 10)}.json`;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce('Reading data exported.');
}
/* Accepts a change event from a file input, or a File/Blob. Merges by report ID:
   imported records replace matching ones, every other stored record is left alone.
   Resolves to the result, or null when nothing was imported (the reason is announced). */
async function importReading(eventOrFile) {
  const input = eventOrFile && eventOrFile.target ? eventOrFile.target : null;
  const file = input ? input.files && input.files[0] : eventOrFile;
  if (!file) return null;
  let result = null;
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a reading-data file smaller than 1 MB. Nothing was imported.');
    const imported = JSON.parse(await file.text());
    result = validateReading(imported, { strict: true });
    Object.assign(state.reading, result.records);
    const prefs = validPrefs(imported.preferences);
    if (Object.keys(prefs).length) { state.prefs = { ...state.prefs, ...prefs }; applyPrefs(); savePrefs(); }
    saveReading();
    updateReadingControls();
    emitReading(null);
    announce(`Imported reading data: ${plural(result.count, 'record')}, ${fmtInt(result.known)} of them in this edition.`);
  } catch (error) {
    result = null;
    announce(error instanceof SyntaxError ? 'That file is not valid JSON. Nothing was imported.' : error.message);
  }
  if (input) input.value = '';
  return result;
}
function clearReading() {
  state.reading = Object.create(null);
  saveReading();
  updateReadingControls();
  emitReading(null);
  announce('Reading data cleared from this browser.');
}

/* ========================================================================= 8. PROGRESS */
/* Progress counts prose blocks that have actually been in view while the reader was
   scrolling. Jumps (contents links, score links, deep links, resume) are guarded: the
   blocks they land on do not count until the reader scrolls on from there. Stored
   progress only ever increases; unmarking "read" is the only reset. */
const progress = { io: null, id: '', blocks: [], seen: null, visible: null, guard: null, timer: 0 };
function observeProgress(entry, bodyEl) {
  // A jump made before the report's text arrived (a contents link, a deep link) stays guarded:
  // the blocks it landed on must not count once the text is in place.
  const kept = progress.guard;
  stopProgress();
  const id = entry && entry.id;
  const body = bodyEl || document.getElementById('report-body');
  if (!id || !body) return;
  const blocks = $$(PROSE_BLOCKS, body).filter(el => !el.closest('[data-progress-ignore]'));
  Object.assign(progress, { id, blocks, seen: new Set(), visible: new Set(), guard: kept });
  paintProgress(id, record(id).progress);
  if (!blocks.length || typeof IntersectionObserver !== 'function') return;
  blocks.forEach((el, i) => { el.dataset.block = String(i); });
  progress.io = new IntersectionObserver(items => {
    for (const item of items) {
      const i = Number(item.target.dataset.block);
      if (item.isIntersecting) progress.visible.add(i); else progress.visible.delete(i);
    }
    if (!progress.guard) countVisible();
  }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
  for (const el of blocks) progress.io.observe(el);
}
function countVisible() {
  if (!progress.id || !progress.seen) return;
  let changed = false;
  for (const i of progress.visible) if (!progress.seen.has(i)) { progress.seen.add(i); changed = true; }
  if (changed) commitProgress();
}
function commitProgress() {
  const { id, seen, blocks } = progress;
  if (!id || !blocks.length) return;
  const measured = Math.round((seen.size / blocks.length) * 100);
  const kept = record(id).progress;
  if (measured <= kept) return;
  state.reading[id] = { ...record(id), progress: measured };
  paintProgress(id, measured);
  updateReadingControls(id);
  clearTimeout(progress.timer);
  progress.timer = setTimeout(saveReading, 300);
}
function stopProgress() {
  if (progress.io) progress.io.disconnect();
  if (progress.timer) saveReading();
  Object.assign(progress, { io: null, id: '', blocks: [], seen: null, visible: null, guard: null });
}
/* Called before any programmatic jump. The guard lifts once the reader scrolls on, by their
   own hand: a wheel, a touch, a scrolling key or the scrollbar. Scrolling that the page does by
   itself (fonts and text arriving, images settling, a slow machine catching up) never lifts it,
   so a jump is never counted as reading. */
function guardProgress() {
  progress.guard = { y: null, at: performance.now(), input: false };
  requestAnimationFrame(() => { if (progress.guard && progress.guard.y === null) progress.guard.y = window.scrollY; });
}
function checkGuard(y) {
  const g = progress.guard;
  if (!g || !g.input || g.y === null || performance.now() - g.at < 250) return;
  if (Math.abs(y - g.y) > 32) { progress.guard = null; countVisible(); }
}
const READING_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar']);
function markReaderInput() { if (progress.guard) progress.guard.input = true; }
window.addEventListener('wheel', markReaderInput, { passive: true });
window.addEventListener('touchmove', markReaderInput, { passive: true });
window.addEventListener('keydown', ev => { if (READING_KEYS.has(ev.key)) markReaderInput(); });
window.addEventListener('pointerdown', ev => { if (ev.target === document.documentElement) markReaderInput(); }, { passive: true });
function paintProgress(id, pct) {
  const value = clamp(Math.round(num(pct) ?? 0), 0, 100);
  const bar = document.getElementById('report-progress');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(value));
    bar.setAttribute('aria-valuetext', `${value}% read`);
    bar.style.setProperty('--p', `${value}%`);
  }
  const label = document.getElementById('progress-label');
  if (label) label.textContent = `${value}% read`;
  const readbar = document.getElementById('readbar');
  if (readbar) readbar.style.setProperty('--p', String(value / 100));
  const r = record(id);
  for (const button of $$(`[data-action="resume"][data-id="${cssEsc(id)}"]`)) button.hidden = !(value >= 5 && value < 97 && !r.read);
  emit('parallax:progress', { id, pct: value });
}
/* Scroll to the stored place: the prose block at the stored percentage. */
function resumeReading(id) {
  const blocks = progress.id === id ? progress.blocks : [];
  if (!blocks.length) return false;
  const target = blocks[clamp(Math.floor((record(id).progress / 100) * blocks.length), 0, blocks.length - 1)];
  guardProgress();
  target.scrollIntoView({ block: 'start', behavior: 'instant' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  announce(`Resumed at ${record(id).progress}% of the report.`);
  return true;
}

/* ====================================================================== 9. PREFERENCES */
const validPrefs = value => (value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(PREF_VALUES).filter(key => PREF_VALUES[key].includes(value[key])).map(key => [key, value[key]]))
  : {});
const pref = key => state.prefs[key] || PREF_DEFAULTS[key];
const systemDark = () => mq('(prefers-color-scheme: dark)').matches;
const effectiveTheme = () => (['darkroom', 'plate', 'redlight'].includes(state.prefs.theme) ? state.prefs.theme : systemDark() ? 'darkroom' : 'plate');
/* Writes only what the reader chose: no data-theme for automatic, no data-motion unless
   "reduce". The inline script in index.html is the pre-paint path; this runs on change. */
function applyPrefs() {
  const root = document.documentElement;
  const p = state.prefs;
  if (p.theme && p.theme !== 'auto') root.setAttribute('data-theme', p.theme); else root.removeAttribute('data-theme');
  if (p.text) root.setAttribute('data-text', p.text); else root.removeAttribute('data-text');
  if (p.motion === 'reduce') root.setAttribute('data-motion', 'reduce'); else root.removeAttribute('data-motion');
  if (p.transparency === 'reduce') root.setAttribute('data-transparency', 'reduce'); else root.removeAttribute('data-transparency');
  syncThemeColor();
  syncThemeToggle();
  measureChrome();
  emit('parallax:prefs', { prefs: { ...state.prefs } });
}
function syncThemeColor() {
  const metas = $$('meta[name="theme-color"]');
  metas.slice(1).forEach(m => m.remove());
  const meta = metas[0];
  if (!meta) return;
  let bg = '';
  try { bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); } catch (_) { bg = ''; }
  meta.removeAttribute('media');
  meta.setAttribute('content', bg || (effectiveTheme() === 'plate' ? '#ffffff' : '#000000'));
}
function syncThemeToggle() {
  const button = document.getElementById('toggle-theme');
  if (!button) return;
  const theme = effectiveTheme();
  button.setAttribute('aria-pressed', String(theme !== 'plate'));
  button.dataset.shows = theme;
}
function savePrefs() {
  try { localStorage.setItem(STORE.prefs, JSON.stringify(validPrefs(state.prefs))); return true; }
  catch (_) { announce('This preference applies to this visit only; browser storage is unavailable.'); return false; }
}
function setPref(key, value) {
  if (!PREF_VALUES[key] || !PREF_VALUES[key].includes(value)) return false;
  state.prefs = { ...state.prefs, [key]: value };
  applyPrefs();
  savePrefs();
  return true;
}
/* Darkroom ⇄ plate from whatever is showing now; red: true selects redlight (or leaves it). */
function toggleTheme({ red = false } = {}) {
  const now = effectiveTheme();
  const next = red ? (now === 'redlight' ? 'darkroom' : 'redlight') : now === 'plate' ? 'darkroom' : 'plate';
  setPref('theme', next);
  announce(`Appearance: ${THEME_LABEL[next]}.`);
  return next;
}

/* ===================================================================== 10. ANNOUNCE */
/* One polite live region (#announcer). Visible mirrors ([data-status-mirror],
   #settings-status) and the toast are NOT live regions, so nothing is read twice. */
let toastTimer = 0;
function announce(message, { toast = false } = {}) {
  const text = String(message ?? '').trim();
  if (!text) return;
  const box = document.getElementById('announcer');
  if (box) { box.textContent = ''; requestAnimationFrame(() => { box.textContent = text; }); }
  for (const mirror of $$('[data-status-mirror], #settings-status')) mirror.textContent = text;
  if (toast) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('aria-hidden', 'true');
      document.body.append(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
}

/* ========================================================================== 11. ROUTER */
const ALIASES = { '': 'index', discover: 'index', library: 'index' };
function parseRoute(hash = location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/');
  let name, id, anchor;
  try {
    name = decodeURIComponent(parts[0] || '');
    id = decodeURIComponent(parts[1] || '');
    anchor = decodeURIComponent(parts.slice(2).join('/'));
  } catch (_) { return { name: 'missing', id: '', anchor: '' }; }
  if (Object.prototype.hasOwnProperty.call(ALIASES, name)) name = ALIASES[name];
  if (!ROUTE_NAMES.includes(name)) return { name: 'missing', id: '', anchor: '' };
  return { name, id, anchor };
}
const routeHref = r => `#${r.name}${r.id ? `/${encodeURIComponent(r.id)}` : ''}${r.anchor ? `/${encodeURIComponent(r.anchor)}` : ''}`;
const isList = name => name === 'index' || name === 'queue';
/* Same view = the address changed inside what is on screen: same report, or the same page. */
const sameView = (a, b) => !!a && !!b && a.name === b.name && a.name !== 'missing' && a.name !== '' && (a.name !== 'report' || a.id === b.id);
const isCurrent = token => token === state.routeToken;

let leaveHooks = [];
let subrouteHandler = null;
let pendingNames = null;
let focusSearchNext = false;
const onLeave = fn => { if (typeof fn === 'function') leaveHooks.push(fn); };
const onSubroute = fn => { subrouteHandler = typeof fn === 'function' ? fn : null; };
function setTitle(text) { document.title = text ? `${text} · Parallax` : 'Parallax · AI Observatory'; }
function titleFor(r) {
  if (r.name === 'report') { const e = state.byId.get(r.id); return e ? `${e.title} · Parallax` : 'Report not found · Parallax'; }
  return `${ROUTE_TITLES[r.name] || ROUTE_TITLES.missing} · Parallax · AI Observatory`;
}
/* aria-current on every a[data-nav]: report and queue light "index"; accounts lights
   "accounts" when such a link exists, otherwise "sources". */
function markNav(name) {
  const hasAccounts = !!document.querySelector('a[data-nav="accounts"]');
  const lit = name === 'report' || name === 'queue' ? 'index' : name === 'accounts' && !hasAccounts ? 'sources' : name;
  for (const link of $$('a[data-nav]')) {
    if (link.dataset.nav === lit) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
}
function closeDialogs() { for (const dialog of $$('dialog[open]')) dialog.close(); }

/* Shared-element View Transitions. Call before the route changes (for example in a
   click handler or an onLeave hook): fromEl is named now, for the old snapshot; toEl
   (an Element, a selector, or a function returning one) is resolved and named after
   the new view renders. Names are cleared when the transition ends, or at once when
   no transition runs (reduced motion, unsupported browser). */
function setTransitionNames(fromEl, toEl, name = 'vt-shared') {
  clearTransitionNames();
  if (fromEl && fromEl.style) fromEl.style.viewTransitionName = name;
  pendingNames = { fromEl: fromEl || null, toEl: toEl || null, name, applied: [] };
  if (fromEl && fromEl.style) pendingNames.applied.push(fromEl);
}
function applyPendingNames() {
  const p = pendingNames;
  if (!p || !p.toEl) return;
  let el = p.toEl;
  try { el = typeof el === 'function' ? el() : typeof el === 'string' ? app.querySelector(el) : el; } catch (_) { el = null; }
  if (el && el.style && el.isConnected) { el.style.viewTransitionName = p.name; p.applied.push(el); }
}
function clearTransitionNames() {
  if (!pendingNames) return;
  for (const el of pendingNames.applied) if (el && el.style) el.style.viewTransitionName = '';
  pendingNames = null;
}
const canTransition = () => state.booted && typeof document.startViewTransition === 'function' && !motionReduced();
/* Runs update() inside a View Transition when motion is allowed; resolves to update()'s
   return value once the DOM has been updated (it never waits for the view's data). */
function transition(update, animate = true) {
  if (!animate || !canTransition()) {
    let result;
    try { result = update(); } finally { clearTransitionNames(); }
    return Promise.resolve(result);
  }
  let result;
  let vt;
  try { vt = document.startViewTransition(() => { result = update(); }); }
  catch (_) { clearTransitionNames(); return Promise.resolve(update()); }
  vt.finished.catch(() => {}).then(clearTransitionNames);
  return vt.updateCallbackDone.then(() => result, () => result);
}

/* The views are optional function declarations in later fragments. */
function viewFor(name) {
  switch (name) {
    case 'index': case 'queue': return typeof renderLibrary === 'function' ? renderLibrary : null;
    case 'report': return typeof renderReport === 'function' ? renderReport : null;
    case 'sources': return typeof renderSources === 'function' ? renderSources : null;
    case 'accounts': return typeof renderAccounts === 'function' ? renderAccounts : null;
    case 'editions': return typeof renderEditions === 'function' ? renderEditions : null;
    case 'method': return typeof renderMethod === 'function' ? renderMethod : null;
    case 'settings': return typeof renderSettings === 'function' ? renderSettings : null;
    default: return null;
  }
}
function renderView(r, token) {
  if (r.name === 'missing') return renderMissing('page');
  if (r.name === 'report' && !state.byId.has(r.id)) return renderMissing('report');
  const view = viewFor(r.name);
  return view ? view(r, token) : renderPlaceholder(r.name, r, token);
}

function runLeave(prev, next) {
  const hooks = leaveHooks;
  leaveHooks = [];
  subrouteHandler = null;
  viewScrollSubs.clear();
  for (const fn of hooks) { try { fn(prev, next); } catch (error) { console.error(error); } }
}
function route() {
  if (!state.meta) return;
  const prev = state.route;
  const next = parseRoute();
  if (/^#\/?(discover|library)(\/|$)/.test(location.hash)) history.replaceState(history.state, '', routeHref(next));
  if (state.booted && sameView(prev, next)) { handleSameView(next, prev); return; }
  navigate(prev, next);
}
/* Re-render the current view in place: no transition, no focus move, no scroll reset. */
function rerender() {
  if (!state.meta || !state.route.name) return Promise.resolve();
  const r = state.route;
  const token = ++state.routeToken;
  runLeave(r, r);
  stopProgress();
  app.setAttribute('aria-busy', 'true');
  let result;
  try { result = renderView(r, token); } catch (error) { result = Promise.reject(error); }
  return Promise.resolve(result).catch(error => { if (isCurrent(token)) renderViewError(error); })
    .then(() => { if (isCurrent(token)) { app.setAttribute('aria-busy', 'false'); updateReadingControls(); measureChrome(); } });
}
function navigate(prev, next) {
  const token = ++state.routeToken;
  const first = !state.booted;
  if (isList(prev.name)) state.listScroll = window.scrollY;
  runLeave(prev, next);
  stopProgress();
  closeDialogs();
  const update = () => {
    if (!isCurrent(token)) return undefined;
    state.route = next;
    state.activeReport = null;
    document.body.dataset.route = next.name;
    markNav(next.name);
    document.title = titleFor(next);
    const readbar = document.getElementById('readbar');
    if (readbar) { readbar.hidden = next.name !== 'report'; readbar.style.setProperty('--p', '0'); }
    app.setAttribute('aria-busy', 'true');
    let result;
    try { result = renderView(next, token); } catch (error) { result = Promise.reject(error); }
    applyPendingNames();
    if (!(isList(next.name) && prev.name === 'report') && !(next.name === 'report' && next.anchor)) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return result;
  };
  state.booted = true;
  transition(update, !first)
    .then(result => Promise.resolve(result).catch(error => { if (isCurrent(token)) { console.error(error); renderViewError(error); } }))
    .then(() => {
      if (!isCurrent(token)) return;
      app.setAttribute('aria-busy', 'false');
      updateReadingControls();
      measureChrome();
      settleScroll(prev, next);
      focusAfterRoute(prev, next, first);
      emit('parallax:route', { route: { ...next }, prev: { ...prev }, same: false });
    });
}
function settleScroll(prev, next) {
  if (isList(next.name) && prev.name === 'report') { window.scrollTo({ top: state.listScroll, left: 0, behavior: 'instant' }); return; }
  if (next.name === 'report' && next.anchor) { scrollToAnchor(next.anchor, { focus: state.booted && prev.name !== '' }); return; }
  if (next.name !== 'report' && next.id && !subrouteHandler) scrollToAnchor(next.id, { focus: false });
}
const rowLinkFor = id => {
  const href = reportURL(id);
  return app.querySelector(`[data-report-id="${cssEsc(id)}"] a[href="${cssEsc(href)}"]`) || app.querySelector(`a[href="${cssEsc(href)}"]`);
};
function focusHeading() {
  const h1 = app.querySelector('h1');
  if (h1) {
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  } else {
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  }
}
/* After a route change: the view's h1 (never on first load, so the skip link stays the
   first Tab stop); the row you came from when returning to a list; the search field
   when "/" asked for it. */
function focusAfterRoute(prev, next, first) {
  if (focusSearchNext) {
    focusSearchNext = false;
    const field = searchField();
    if (field) { field.focus({ preventScroll: true }); if (field.select) field.select(); return; }
  }
  if (first) return;
  if (next.name === 'report' && next.anchor) return;
  if (prev.name === 'report' && isList(next.name)) {
    const link = rowLinkFor(prev.id);
    if (link) { link.focus({ preventScroll: true }); return; }
  }
  focusHeading();
}
/* Scroll an element of the current view to the top, clearing the sticky masthead via
   html { scroll-padding-top }. Guards reading progress against the jump. */
function scrollToAnchor(anchor, { focus = true } = {}) {
  if (!anchor) return false;
  const target = document.getElementById(anchor);
  if (!target || !app.contains(target)) return false;
  guardProgress();
  target.scrollIntoView({ block: 'start', behavior: 'instant' });
  if (focus) {
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  return true;
}
/* The address changed inside the current view: the view's onSubroute handler decides;
   otherwise the anchor (report) or the id (other pages) is scrolled to, or the top. */
function handleSameView(next, prev) {
  state.route = next;
  let handled = false;
  if (subrouteHandler) {
    try { handled = subrouteHandler(next, prev) !== false; } catch (error) { console.error(error); }
  }
  if (!handled) {
    const target = next.name === 'report' ? next.anchor : next.id;
    if (target) scrollToAnchor(target);
    else {
      guardProgress();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      focusHeading();
    }
  }
  emit('parallax:route', { route: { ...next }, prev: { ...prev }, same: true });
}
/* Follow a same-view link without adding a history entry. */
function replaceRoute(href) {
  const next = parseRoute(href);
  history.replaceState(history.state, '', href);
  if (sameView(state.route, next)) handleSameView(next, state.route);
  else route();
}
/* The masthead never overflows: when its content does not fit (large text, narrow or
   unusual widths, any design), it compacts in steps — tool labels, then the brand's
   subtitle, then the nav (the menu button takes over) — via data-compact on #masthead.
   The decorative subtitle always goes before the primary navigation. */
const COMPACT_STEPS = ['labels', 'sub', 'nav'];
function compactMasthead(masthead) {
  const nav = masthead.querySelector('.masthead-nav');
  const brand = masthead.querySelector('.brand');
  const over = () => masthead.scrollWidth > masthead.clientWidth + 1 ||
    (nav && nav.offsetParent !== null && nav.scrollWidth > nav.clientWidth + 1) ||
    (brand && brand.scrollWidth > brand.clientWidth + 1);
  masthead.removeAttribute('data-compact');
  const applied = [];
  for (const step of COMPACT_STEPS) {
    if (!over()) break;
    applied.push(step);
    masthead.setAttribute('data-compact', applied.join(' '));
  }
}
/* The sticky chrome is measured, never guessed: anchors and focus have to clear it. */
function measureChrome() {
  const masthead = document.getElementById('masthead');
  if (!masthead) return;
  compactMasthead(masthead);
  const style = getComputedStyle(masthead);
  const sticky = style.position === 'sticky' || style.position === 'fixed';
  document.documentElement.style.setProperty('--mast-live', `${sticky ? Math.round(masthead.getBoundingClientRect().height) : 0}px`);
}

/* ======================================================================== 12. DIALOGS */
const openers = new WeakMap();
function showDialog(dialog) {
  if (!dialog) return;
  for (const other of $$('dialog[open]')) if (other !== dialog) other.close();
  if (dialog.open) return;
  const active = document.activeElement;
  if (active && active !== document.body && !dialog.contains(active)) openers.set(dialog, active);
  dialog.showModal();
  document.documentElement.classList.add('has-dialog');
}
function wireDialog(dialog) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('has-dialog');
    if (dialog.id === 'palette') { const input = document.getElementById('palette-input'); if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); } announceCount.cancel(); }
    if (dialog.id === 'queue') lastRemoved = null;
    const opener = openers.get(dialog);
    openers.delete(dialog);
    const active = document.activeElement;
    if (opener && opener.isConnected && (!active || active === document.body || dialog.contains(active))) opener.focus({ preventScroll: true });
  });
}

/* ================================================================ 13. COMMAND PALETTE */
const palette = { items: [], index: 0 };
const PALETTE_REPORT_LIMIT = 50;
const reportDetail = e => [e.category, `${fmtScore(e.score, '–')} out of 10`, agreementSentence(e)].filter(Boolean).join(' · ');
const reportItem = (e, detail) => ({ kind: 'report', label: e.title || e.id, detail: detail || reportDetail(e), url: reportURL(e.id), entry: e });
function paletteActions() {
  return PREF_VALUES.theme.map(theme => ({
    kind: 'action', label: `Appearance: ${THEME_LABEL[theme]}`, detail: theme === 'auto' ? 'Follow this device' : 'Change the appearance',
    words: 'theme appearance dark light mode colour color night red', run: () => { setPref('theme', theme); announce(`Appearance: ${THEME_LABEL[theme]}.`); }
  })).concat([
    { kind: 'action', label: 'Open the reading queue', detail: 'Your saved reports', words: 'queue saved list', run: () => openQueue() },
    { kind: 'action', label: 'Export reading data', detail: 'Download a JSON file', words: 'export backup download data', run: () => exportReading() }
  ]);
}
const pageItem = p => ({ kind: 'page', label: p.label, detail: p.detail, url: p.url, words: p.words });
/* Pages and actions: every word must occur; "strong" when every word starts a word of the label. */
function matchItems(items, words) {
  return items.map(item => {
    const label = lower(item.label);
    const hay = `${label} ${lower(item.detail)} ${lower(item.words)}`;
    if (!words.every(w => hay.includes(w))) return null;
    const strong = words.every(w => label.startsWith(w) || label.includes(` ${w}`));
    return { item, strong };
  }).filter(Boolean);
}
function paletteGroups(query) {
  const words = queryWords(query);
  const groups = [];
  if (!words.length) {
    const going = state.entries.filter(e => inProgress(e.id)).sort((a, b) => record(b.id).progress - record(a.id).progress);
    if (going.length) groups.push({ title: 'Continue reading', items: going.slice(0, 5).map(e => reportItem(e, `${record(e.id).progress}% read · about ${plural(minutesLeft(e), 'minute')} left`)) });
    groups.push({ title: 'Pages', items: PAGES.map(pageItem) });
    const recent = sortEntries(state.entries, 'latest').slice(0, 5);
    if (recent.length) groups.push({ title: 'Recent reports', items: recent.map(e => reportItem(e)) });
    return groups;
  }
  const reports = searchEntries(query);
  const pages = matchItems(PAGES.map(pageItem), words);
  const actions = matchItems(paletteActions(), words);
  const reportGroup = reports.length ? { title: `Reports (${fmtInt(reports.length)})`, items: reports.slice(0, PALETTE_REPORT_LIMIT).map(e => reportItem(e)) } : null;
  if (reportGroup && reports.length > PALETTE_REPORT_LIMIT) {
    reportGroup.items.push({ kind: 'action', label: `Show all ${fmtInt(reports.length)} matches in the library`, detail: `Search the library for “${query.trim()}”`, run: () => searchLibrary(query.trim()) });
  }
  const pageGroup = pages.length ? { title: 'Pages', items: pages.map(x => x.item) } : null;
  const actionGroup = actions.length ? { title: 'Actions', items: actions.map(x => x.item) } : null;
  const pagesFirst = pages.some(x => x.strong) || (!reports.length && actions.some(x => x.strong));
  if (pagesFirst) groups.push(pageGroup, actionGroup, reportGroup); else groups.push(reportGroup, pageGroup, actionGroup);
  const found = groups.filter(Boolean);
  if (found.length) return found;
  const near = state.entries.map((e, i) => ({ e, i, hits: words.filter(w => e._hay && e._hay.includes(w)).length }))
    .filter(x => x.hits).sort((x, y) => y.hits - x.hits || x.i - y.i).slice(0, 5).map(x => reportItem(x.e));
  return near.length ? [{ title: `No match for “${query.trim()}”`, note: 'The closest titles:', items: near }] : [];
}
function searchLibrary(q) {
  state.filters = { ...state.filters, q };
  if (isList(state.route.name) && state.route.name === 'index') { rerender(); return; }
  location.hash = '#index';
}
const announceCount = debounce(n => announce(n ? `${plural(n, 'result')}.` : 'No results.'), 700);
function renderPalette() {
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  if (!input || !list) return;
  const groups = paletteGroups(input.value);
  const flat = [];
  let html = '';
  groups.forEach((group, g) => {
    html += `<li role="presentation" class="palette-group" id="palette-group-${g}">${esc(group.title)}${group.note ? `<span class="palette-note">${esc(group.note)}</span>` : ''}</li>`;
    for (const item of group.items) {
      const i = flat.push(item) - 1;
      const extra = typeof paletteOptionExtra === 'function' ? paletteOptionExtra(item) : '';
      html += `<li role="option" class="palette-opt" id="palette-option-${i}" data-palette-index="${i}" data-kind="${item.kind}" aria-selected="false"><span class="palette-label">${esc(item.label)}</span>${item.detail ? `<span class="palette-detail">${esc(item.detail)}</span>` : ''}${extra ? `<span class="palette-extra" aria-hidden="true">${extra}</span>` : ''}</li>`;
    }
  });
  if (!flat.length) html = `<li role="presentation" class="palette-empty">${state.meta ? `No report or page matches “${esc(input.value.trim())}”.` : 'The library is still loading.'}</li>`;
  list.innerHTML = html;
  list.scrollTop = 0;
  palette.items = flat;
  palette.index = 0;
  input.setAttribute('aria-expanded', String(flat.length > 0));
  selectPalette(0);
  if (input.value.trim()) announceCount(flat.length); else announceCount.cancel();
}
function selectPalette(index, { scroll = true } = {}) {
  const input = document.getElementById('palette-input');
  const n = palette.items.length;
  if (!n) { palette.index = 0; if (input) input.removeAttribute('aria-activedescendant'); return; }
  palette.index = ((index % n) + n) % n;
  for (const option of $$('#palette-list [role="option"]')) option.setAttribute('aria-selected', String(Number(option.dataset.paletteIndex) === palette.index));
  if (input) input.setAttribute('aria-activedescendant', `palette-option-${palette.index}`);
  const active = document.getElementById(`palette-option-${palette.index}`);
  if (scroll && active) active.scrollIntoView({ block: 'nearest' });
}
function openPalette(query = '') {
  const dialog = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  if (!dialog || !input) return;
  showDialog(dialog);
  input.value = query;
  renderPalette();
  input.focus();
  input.select();
}
function runPaletteItem(item) {
  if (!item) return;
  const dialog = document.getElementById('palette');
  if (dialog && dialog.open) dialog.close();
  if (item.run) { item.run(); return; }
  if (!item.url) return;
  if (location.hash === item.url) replaceRoute(item.url); else location.hash = item.url;
}
function onPaletteKey(event) {
  const n = palette.items.length;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (n) selectPalette(palette.index + (event.key === 'ArrowDown' ? 1 : -1));
  } else if (event.key === 'PageDown' || event.key === 'PageUp') {
    event.preventDefault();
    if (n) selectPalette(clamp(palette.index + (event.key === 'PageDown' ? 6 : -6), 0, n - 1));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const item = palette.items[palette.index];
    if ((event.metaKey || event.ctrlKey) && item && item.entry) { toggleQueued(item.entry.id); renderPaletteKeep(); return; }
    if (event.metaKey || event.ctrlKey) { announce('Select a report to save it to your queue.'); return; }
    runPaletteItem(item);
  }
}
/* Repaint the details (queue state can change them) without moving the selection. */
function renderPaletteKeep() {
  const index = palette.index;
  renderPalette();
  selectPalette(Math.min(index, Math.max(palette.items.length - 1, 0)));
}

/* ===================================================================== 14. QUEUE SHEET */
let lastRemoved = null;
function queueItemHTML(entry, index, total) {
  const r = record(entry.id);
  const title = entry.title || entry.id;
  const meta = r.read ? 'Marked as read'
    : inProgress(entry.id) ? `${r.progress}% read · about ${plural(minutesLeft(entry), 'minute')} left`
      : `${fmtInt(entry.readMinutes || 0)} min read`;
  return `<li class="queue-item" data-report-id="${esc(entry.id)}">
<a href="${esc(reportURL(entry.id))}" data-close>${esc(title)}</a>
${r.read ? '' : typeof queueProgressHTML === 'function' ? queueProgressHTML(entry, r) : `<span class="meter" role="progressbar" aria-label="Reading progress, ${esc(title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress}" style="--p:${r.progress}%"><span></span></span>`}
<span class="queue-meta">${esc(meta)}</span>
<span class="queue-tools">
<button type="button" class="icon-btn" data-action="queue-up" data-id="${esc(entry.id)}" aria-label="Move up: ${esc(title)}"${index === 0 ? ' disabled' : ''}><span aria-hidden="true">↑</span></button>
<button type="button" class="icon-btn" data-action="queue-down" data-id="${esc(entry.id)}" aria-label="Move down: ${esc(title)}"${index === total - 1 ? ' disabled' : ''}><span aria-hidden="true">↓</span></button>
<button type="button" class="button button-quiet" data-action="queue-remove" data-id="${esc(entry.id)}">Remove<span class="sr-only">: ${esc(title)}</span></button>
</span>
</li>`;
}
function renderQueue() {
  const body = document.getElementById('queue-body');
  const foot = document.getElementById('queue-foot');
  if (!body || !foot) return;
  const active = document.activeElement;
  const keep = active && (body.contains(active) || foot.contains(active)) ? { action: active.dataset.action || '', id: active.dataset.id || '', href: active.getAttribute('href') || '' } : null;
  if (!state.meta) {
    body.innerHTML = '<p class="queue-meta">Loading the library…</p>';
    foot.innerHTML = '';
    return;
  }
  const saved = queuedEntries();
  const minutes = saved.filter(e => !record(e.id).read).reduce((sum, e) => sum + minutesLeft(e), 0);
  body.innerHTML = saved.length
    ? `<ol class="queue-list" role="list">${saved.map((e, i) => queueItemHTML(e, i, saved.length)).join('')}</ol>`
    : '<div class="state"><h3>Your queue is empty.</h3><p>Save a report with its queue button and it will wait here, in this browser.</p><a class="button" href="#index" data-close>Browse the library</a></div>';
  const total = saved.length ? `${plural(saved.length, 'report')}${minutes ? ` · about ${plural(minutes, 'minute')} left` : ''}` : 'Nothing saved yet';
  foot.innerHTML = `<span class="queue-total">${esc(total)}</span>${lastRemoved && state.byId.has(lastRemoved.id) ? '<button type="button" class="button button-quiet" data-action="queue-undo">Undo remove</button>' : ''}<a class="button" href="#queue" data-close>Open as a page</a><button type="button" class="button" data-action="export">Export</button>`;
  if (keep) {
    const selector = keep.action ? `[data-action="${cssEsc(keep.action)}"]${keep.id ? `[data-id="${cssEsc(keep.id)}"]` : ''}` : keep.href ? `a[href="${cssEsc(keep.href)}"]` : '';
    let el = selector ? (body.querySelector(selector) || foot.querySelector(selector)) : null;
    if (el && el.disabled && keep.id) el = body.querySelector(`[data-report-id="${cssEsc(keep.id)}"] > a`);
    if (el) el.focus({ preventScroll: false });
  }
}
function openQueue() {
  lastRemoved = null;
  renderQueue();
  showDialog(document.getElementById('queue'));
}
/* Removing keeps focus in the sheet: the next item, else the previous, else Undo. */
function removeFromQueue(id) {
  const rows = $$('#queue-body [data-report-id]');
  const at = Math.max(0, rows.findIndex(li => li.dataset.reportId === id));
  lastRemoved = { id, order: record(id).order, savedAt: record(id).savedAt };
  if (document.activeElement && document.getElementById('queue') && document.getElementById('queue').contains(document.activeElement)) document.activeElement.blur();
  setRecord(id, { queued: false });
  if (!(document.getElementById('queue') || {}).open) renderQueue();
  const links = $$('#queue-body [data-report-id] > a');
  const target = links[Math.min(at, links.length - 1)] || $('#queue-foot [data-action="queue-undo"]') || $('#queue-body a') || $('#queue [data-close]');
  if (target) target.focus();
  const title = (state.byId.get(id) || {}).title || 'The report';
  announce(`Removed ${title} from your reading queue. Undo is available.`);
}
function undoRemove() {
  if (!lastRemoved || !state.byId.has(lastRemoved.id)) return;
  const { id, order, savedAt } = lastRemoved;
  lastRemoved = null;
  const restored = { ...record(id), queued: true };
  if (Number.isFinite(Number(order))) restored.order = Number(order); else restored.order = nextQueueOrder();
  restored.savedAt = savedAt || new Date().toISOString();
  state.reading[id] = restored;
  saveReading();
  updateReadingControls();
  emitReading(id);
  if (!(document.getElementById('queue') || {}).open) renderQueue();
  const link = $(`#queue-body [data-report-id="${cssEsc(id)}"] > a`);
  if (link) link.focus();
  announce(`${(state.byId.get(id) || {}).title || 'The report'} is back in your reading queue.`);
}

/* ======================================================================== 15. SANITISER */
/* Report HTML is untrusted: keep only the contract's semantic tags, drop every attribute
   except a safe http(s) href (opened in a new tab), and wrap tables in a labelled,
   focusable scroll region. */
const ALLOWED_TAGS = new Set(['P', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BR']);
function sanitize(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  const visit = node => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!ALLOWED_TAGS.has(child.tagName)) { child.remove(); continue; }
      const href = child.tagName === 'A' ? safeURL(child.getAttribute('href')) : '';
      for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
      if (href) { child.setAttribute('href', href); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
      visit(child);
    }
  };
  visit(doc.body);
  for (const table of Array.from(doc.body.querySelectorAll('table'))) {
    const wrap = doc.createElement('div');
    wrap.className = 'table-wrap';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Table, scrolls sideways');
    table.replaceWith(wrap);
    wrap.append(table);
  }
  return doc.body.innerHTML;
}

/* ============================================================ 16. ACTIONS AND EVENTS */
const actions = new Map();
/* Register (or replace) the handler for [data-action="name"]. handler(element, event).
   Returns a function that restores the previous handler. */
function registerAction(name, handler) {
  if (typeof name !== 'string' || !name || typeof handler !== 'function') return () => {};
  const previous = actions.get(name);
  actions.set(name, handler);
  return () => { if (actions.get(name) === handler) { if (previous) actions.set(name, previous); else actions.delete(name); } };
}
const scrollSubs = new Set();
const viewScrollSubs = new Set();
/* Subscribe to rAF-throttled scroll: fn(scrollY, deltaY). By default the subscription
   ends when the route leaves the current view; { persist: true } keeps it. */
function onScroll(fn, { persist = false } = {}) {
  if (typeof fn !== 'function') return () => {};
  const set = persist ? scrollSubs : viewScrollSubs;
  set.add(fn);
  return () => set.delete(fn);
}
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
const emitReading = id => emit('parallax:reading', { id: id || null });
const SEARCH_SELECTOR = '[data-search], #report-search, #source-search, #account-search';
const isSearchField = el => !!el && (el.type === 'search' || el.getAttribute('role') === 'searchbox' || el.hasAttribute('data-search'));
const searchField = () => $$(SEARCH_SELECTOR, app).find(isVisible) || null;
/* "/": the current page's search field, else the library's. */
function focusSearch() {
  const field = searchField();
  if (field) { field.focus(); if (typeof field.select === 'function') field.select(); return true; }
  if (state.meta && state.route.name !== 'index') { focusSearchNext = true; location.hash = '#index'; }
  return false;
}
function focusMain() {
  const main = document.getElementById('main');
  if (main) { main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start', behavior: 'instant' }); }
}
function resetFilters() {
  state.filters = { ...FILTER_DEFAULTS };
  if (isList(state.route.name)) rerender().then(() => { const field = searchField(); if (field) field.focus(); });
}

registerAction('queue', el => { toggleQueued(el.dataset.id); });
registerAction('read', el => { toggleRead(el.dataset.id); });
registerAction('export', () => exportReading());
registerAction('import', el => { const input = document.getElementById(el.dataset.input || 'reading-import'); if (input) input.click(); });
registerAction('reset-filters', () => resetFilters());
registerAction('resume', el => { resumeReading(el.dataset.id || (state.activeReport && state.activeReport.id)); });
registerAction('queue-up', el => { moveQueued(el.dataset.id, -1); });
registerAction('queue-down', el => { moveQueued(el.dataset.id, 1); });
registerAction('queue-remove', el => { removeFromQueue(el.dataset.id); });
registerAction('queue-undo', () => { undoRemove(); });
registerAction('clear-reading', () => clearReading());
registerAction('palette', el => openPalette(el.dataset.query || ''));
registerAction('open-queue', () => openQueue());
registerAction('theme', el => { if (setPref('theme', el.dataset.value)) announce(`Appearance: ${THEME_LABEL[el.dataset.value]}.`); });
registerAction('retry', () => { rerender(); });
registerAction('retry-boot', () => { start(); });

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const closer = target.closest('[data-close], [data-close-dialog]');
  if (closer) { const dialog = closer.closest('dialog'); if (dialog && dialog.open) dialog.close(); }
  const option = target.closest('#palette-list [data-palette-index]');
  if (option) { runPaletteItem(palette.items[Number(option.dataset.paletteIndex)]); return; }
  if (event.defaultPrevented) return;
  const actionEl = target.closest('[data-action]');
  if (actionEl && !actionEl.disabled && actionEl.getAttribute('aria-disabled') !== 'true' && actions.has(actionEl.dataset.action)) {
    if (actionEl.tagName === 'A') event.preventDefault();
    try { actions.get(actionEl.dataset.action)(actionEl, event); } catch (error) { console.error(error); }
    return;
  }
  const link = target.closest('a[href^="#"]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.hasAttribute('data-skip')) { event.preventDefault(); focusMain(); return; }
  if (!state.booted || link.target === '_blank') return;
  const href = link.getAttribute('href');
  if (href === '#') return;
  const next = parseRoute(href);
  if (next.name === 'missing') {
    /* A plain fragment link (#some-id) to an element on screen scrolls to it and leaves
       the address alone, instead of routing to "not found". */
    let id = '';
    try { id = decodeURIComponent(href.slice(1)); } catch (_) { id = ''; }
    const el = id ? document.getElementById(id) : null;
    if (el && (app.contains(el) || el.id === 'main')) {
      event.preventDefault();
      if (el.id === 'main') focusMain(); else scrollToAnchor(id);
    }
    return;
  }
  if (!sameView(state.route, next)) return;
  /* In-view addresses (report anchors, record and account deep links, page sections)
     replace the history entry: one Back press always leaves the view. */
  event.preventDefault();
  history.replaceState(history.state, '', href);
  handleSameView(next, state.route);
});
document.addEventListener('change', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.matches('#reading-import, input[type="file"][data-import]')) { importReading(event); return; }
  if (target.form && target.form.id === 'preferences' && PREF_VALUES[target.name]) setPref(target.name, target.value);
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target instanceof Element && target.form && target.form.id === 'preferences' && PREF_VALUES[target.name] && target.type !== 'radio') setPref(target.name, target.value);
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (form instanceof HTMLFormElement && !form.hasAttribute('action')) event.preventDefault();
});
document.addEventListener('keydown', event => {
  const target = event.target instanceof Element ? event.target : document.body;
  const editing = target.matches('input, textarea, select') || target.isContentEditable;
  const key = event.key || '';
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key.toLowerCase() === 'k') {
    event.preventDefault();
    const dialog = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    if (dialog && dialog.open && input) { input.focus(); input.select(); } else openPalette();
    return;
  }
  if (target.id === 'palette-input') { onPaletteKey(event); return; }
  if (key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey && pref('keys') !== 'off' && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (key === 'Escape' && editing && isSearchField(target) && target.value) {
    event.preventDefault();
    target.value = '';
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
let scrollTicking = false;
let lastScrollY = 0;
let scrolledFlag = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    const y = window.scrollY;
    const dy = y - lastScrollY;
    lastScrollY = y;
    checkGuard(y);
    if ((y > 8) !== scrolledFlag) { scrolledFlag = y > 8; document.documentElement.toggleAttribute('data-scrolled', scrolledFlag); }
    for (const fn of [...scrollSubs, ...viewScrollSubs]) { try { fn(y, dy); } catch (error) { console.error(error); } }
  });
}, { passive: true });
window.addEventListener('hashchange', () => route());
window.addEventListener('resize', debounce(measureChrome, 150), { passive: true });
window.addEventListener('pagehide', () => { if (state.meta) saveReading(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && progress.timer) saveReading(); });
window.addEventListener('storage', event => {
  if (event.storageArea && event.storageArea !== localStorage) return;
  if (event.key === STORE.reading || event.key === null) {
    state.reading = readReading();
    if (state.meta) {
      updateReadingControls();
      if (progress.id) paintProgress(progress.id, record(progress.id).progress);
      emitReading(null);
    }
  }
  if (event.key === STORE.prefs || event.key === null) { state.prefs = validPrefs(readStorage(STORE.prefs)); applyPrefs(); }
});
const darkQuery = mq('(prefers-color-scheme: dark)');
if (darkQuery.addEventListener) darkQuery.addEventListener('change', () => applyPrefs());
window.addEventListener('offline', () => { document.documentElement.setAttribute('data-offline', ''); announce('Offline. Showing what is already loaded.'); });
window.addEventListener('online', () => { document.documentElement.removeAttribute('data-offline'); });

/* ======================================================== 17. PLACEHOLDERS AND STATES */
/* Neutral stand-ins used only while a view's real render function does not exist.
   They exercise the engine's contract (ids, data-action hooks, progress, prefs) with
   plain markup and no design decisions. */
const toggleHTML = (action, entry) => {
  const r = record(entry.id);
  const on = action === 'queue' ? r.queued : r.read;
  const text = action === 'queue' ? 'Save to queue' : 'Mark as read';
  return `<button type="button" class="button" data-action="${action}" data-id="${esc(entry.id)}" aria-pressed="${on}">${text}<span class="sr-only">: ${esc(entry.title || entry.id)}</span></button>`;
};
function placeholderRow(entry) {
  return `<li data-report-id="${esc(entry.id)}" data-reading="${readingState(entry.id)}">
<h2><a href="${esc(reportURL(entry.id))}">${esc(entry.title || entry.id)}</a></h2>
<span>${esc(reportDetail(entry))} · ${esc(plural(entry.readMinutes || 0, 'minute'))} <span data-reading-label="${esc(entry.id)}">${esc(readingLabel(entry.id))}</span></span>
<span class="cluster">${toggleHTML('queue', entry)}${toggleHTML('read', entry)}</span>
</li>`;
}
function placeholderList(name) {
  const queue = name === 'queue';
  const draw = () => {
    const f = state.filters;
    let list = queue ? queuedEntries() : f.q.trim() ? searchEntries(f.q) : sortEntries(state.entries, f.sort);
    if (!queue) list = list.filter(e => (!f.category || e.category === f.category) && (!f.min || (num(e.score) ?? 0) >= Number(f.min)));
    const total = queue ? queuedEntries().length : state.entries.length;
    const count = document.getElementById('report-count');
    if (count) count.textContent = `${fmtInt(list.length)} of ${plural(total, 'report')}`;
    const ul = document.getElementById('report-list');
    if (ul) ul.innerHTML = list.length ? list.map(placeholderRow).join('') : `<li class="state"><p>No reports match.</p><button type="button" class="button" data-action="reset-filters">Reset filters</button></li>`;
  };
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="${name}">
<h1>${queue ? 'Reading queue' : 'Library'}</h1>
<p>${esc(HONESTY)}</p>
${queue ? '' : `<form id="report-filters" class="cluster" role="search"><label class="field">Search reports <input class="input" id="report-search" name="q" type="search" autocomplete="off" data-search value="${esc(state.filters.q)}"></label><button type="button" class="button" data-action="reset-filters">Reset</button></form>`}
<p id="report-count"></p>
<ul id="report-list" class="placeholder-list" role="list"></ul>
</div>`;
  draw();
  const search = document.getElementById('report-search');
  if (search) search.addEventListener('input', debounce(() => { state.filters.q = search.value; draw(); }, 120));
  if (queue) { const relist = () => draw(); document.addEventListener('parallax:reading', relist); onLeave(() => document.removeEventListener('parallax:reading', relist)); }
}
async function placeholderReport(r, token) {
  const light = state.byId.get(r.id);
  const id = light.id;
  const p = record(id).progress;
  const sections = Array.isArray(light.sections) ? light.sections : [];
  app.innerHTML = `<article class="wrap placeholder" data-placeholder="report">
<p>${esc(light.category || '')} · ${esc(light.entity || '')}</p>
<h1>${esc(light.title || id)}</h1>
<p>${esc(light.summary || '')}</p>
<p>${esc(arithmetic(light))}. ${esc(agreementSentence(light))}. ${esc(HONESTY)}</p>
<div class="cluster">${toggleHTML('queue', light)}${toggleHTML('read', light)}<button type="button" class="button" data-action="resume" data-id="${esc(id)}" hidden>Resume reading</button></div>
<div class="cluster"><span id="report-progress" class="meter" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" style="--p:${p}%;max-inline-size:12rem"><span></span></span><span id="progress-label">${p}% read</span></div>
<nav aria-label="Contents"><ol>${sections.map(s => `<li><a href="${esc(reportURL(id, `section-${s.id}`))}">${esc(s.title)}</a></li>`).join('')}<li><a href="${esc(reportURL(id, 'ratings'))}">Ratings</a></li><li><a href="${esc(reportURL(id, 'sources'))}">Sources</a></li></ol></nav>
<div id="report-body" class="prose measure"><p class="skeleton-line"></p><p class="skeleton-line short"></p><p class="sr-only">Loading the report.</p></div>
<section id="ratings"><h2>Ratings</h2><ul>${runsOf(light).dims.map(d => `<li>${esc(d.label)}: ${esc(fmtScore(d.mean, '–'))} (run A ${esc(d.a ?? '–')}, run B ${esc(d.b ?? '–')})</li>`).join('')}</ul></section>
<section id="sources"><h2>Sources</h2><ol id="report-sources"></ol></section>
</article>`;
  paintProgress(id, p);
  let entry;
  try { entry = await loadReport(id); }
  catch (_) { if (isCurrent(token)) renderMissing('report'); return; }
  if (!isCurrent(token)) return;
  state.activeReport = entry;
  const body = document.getElementById('report-body');
  body.innerHTML = (Array.isArray(entry.sections) ? entry.sections : []).map(s => `<section id="section-${esc(s.id)}"><h2>${esc(s.title)}</h2>${sanitize(s.html)}</section>`).join('');
  document.getElementById('report-sources').innerHTML = (Array.isArray(entry.sources) ? entry.sources : []).map(s => `<li>${external(s.url, s.title || s.id)}</li>`).join('');
  observeProgress(entry, body);
  updateReadingControls(id);
}
async function placeholderSources(r, token) {
  const total = state.sourceStats ? state.sourceStats.total : 0;
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="sources">
<h1>Sources</h1>
<form id="source-filters" role="search"><label class="field">Search the ledger <input class="input" id="source-search" name="q" type="search" autocomplete="off" data-search value="${esc(state.sourceFilters.q)}"></label></form>
<p id="source-count">${esc(plural(total, 'source record'))}</p>
<ul id="source-list" class="placeholder-list" role="list"></ul>
</div>`;
  const draw = only => {
    if (!state.sources) return;
    const words = queryWords(state.sourceFilters.q);
    const list = only ? state.sources.filter(s => s.id === only) : state.sources.filter(s => words.every(w => s._hay.includes(w)));
    document.getElementById('source-count').textContent = `${fmtInt(list.length)} of ${plural(state.sources.length, 'source record')}`;
    document.getElementById('source-list').innerHTML = list.slice(0, 50).map(s => `<li id="source-${esc(s.id)}">${external(s.url, s.name || s.url)} <span>${esc(s.kind || '')} · ${esc(s.status || '')}</span></li>`).join('');
  };
  const search = document.getElementById('source-search');
  search.addEventListener('input', debounce(() => { state.sourceFilters.q = search.value; draw(''); }, 120));
  onSubroute(next => { draw(next.id); return true; });
  try { await loadSources(); } catch (_) { if (isCurrent(token)) document.getElementById('source-count').textContent = 'The ledger could not be loaded.'; return; }
  if (isCurrent(token)) draw(r.id);
}
async function placeholderAccounts(r, token) {
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="accounts"><h1>AI accounts</h1><p id="account-count">Loading the account directory…</p><ul id="account-list" class="placeholder-list" role="list"></ul></div>`;
  const assessed = a => ['verified', 'specialist'].includes(a.status) && !!(a.access && a.access.entrypointInspected === true);
  const draw = only => {
    const f = state.accountFilters;
    const words = queryWords(f.q);
    const list = (state.accounts || []).filter(a => (only ? a.id === only : (!f.platform || a.platform === f.platform) && (f.status === 'all' || (f.status === 'assessed' ? assessed(a) : a.status === f.status)) && words.every(w => a._hay.includes(w))));
    document.getElementById('account-count').textContent = `${fmtInt(list.length)} of ${plural((state.accounts || []).length, 'account')}`;
    document.getElementById('account-list').innerHTML = list.slice(0, 40).map(a => `<li id="account-${esc(a.id)}">${external(a.url, a.name)} <span>${esc(a.platform || '')} · ${esc(a.status || '')}</span></li>`).join('');
  };
  onSubroute(next => { draw(next.id); return true; });
  try { await loadAccounts(); } catch (_) { if (isCurrent(token)) document.getElementById('account-count').textContent = 'The account directory could not be loaded.'; return; }
  if (isCurrent(token)) draw(r.id);
}
function placeholderEditions() {
  const runs = state.runsLight.slice().sort((a, b) => String(b.finishedAt || b.startedAt || '').localeCompare(String(a.finishedAt || a.startedAt || '')));
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="editions"><h1>Editions</h1><p>${esc(plural(runs.length, 'edition'))}. Each scan is bounded; its limitations are recorded with it.</p>
<ol class="placeholder-list" role="list">${runs.map(run => `<li><h2>${esc(fmtDate(run.finishedAt || run.startedAt))}</h2><p>${esc(plural(run.sourcesChecked || 0, 'source'))} reached, ${esc(fmtInt(run.sourcesFailed || 0))} failed, ${esc(plural(run.candidatesFound || 0, 'candidate'))}; library size after the scan: ${esc(plural(run.publishedCount || 0, 'report'))}. ${esc(plural(run.limitationCount || 0, 'recorded limitation'))}.</p><p>${esc(run.coverageNote || '')}</p></li>`).join('')}</ol></div>`;
}
function placeholderMethod() {
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="method"><h1>Method</h1><p>${esc(HONESTY)}</p>
<ul class="placeholder-list" role="list">${DIMENSIONS.map(d => `<li id="dimension-${d.key}"><h2>${esc(d.label)}</h2><p>${esc(d.text)}</p></li>`).join('')}</ul>
<p>Each dimension is the mean of run A and run B; the overall score is the mean of the five dimensions.</p></div>`;
}
function placeholderSettings() {
  const radios = (key, labels) => `<fieldset><legend>${esc(labels.legend)}</legend>${PREF_VALUES[key].map(v => `<label class="chip"><input type="radio" name="${key}" value="${v}"${pref(key) === v ? ' checked' : ''}>${esc(labels[v] || v)}</label>`).join(' ')}</fieldset>`;
  const ids = Object.keys(state.reading);
  app.innerHTML = `<div class="wrap placeholder" data-placeholder="settings"><h1>Settings</h1>
<form id="preferences" class="stack">
${radios('theme', { legend: 'Appearance', ...THEME_LABEL })}
${radios('text', { legend: 'Text size', s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large' })}
${radios('motion', { legend: 'Motion', allow: 'Follow the device', reduce: 'Reduce' })}
${radios('keys', { legend: 'Single-key shortcuts', on: 'On', off: 'Off' })}
</form>
<section id="data" class="stack"><h2>Your reading data</h2><p>${esc(plural(ids.length, 'record'))} stored in this browser${ids.some(id => !state.byId.has(id)) ? `, including ${esc(fmtInt(ids.filter(id => !state.byId.has(id)).length))} for reports not in this edition (kept untouched)` : ''}.</p>
<div class="cluster"><button type="button" class="button" data-action="export">Export reading data</button><label class="button" for="reading-import">Import reading data</label><input id="reading-import" class="sr-only" type="file" accept="application/json,.json"></div>
<p id="settings-status"></p></section></div>`;
}
function renderPlaceholder(name, r = state.route, token = state.routeToken) {
  switch (name) {
    case 'index': case 'queue': return placeholderList(name);
    case 'report': return placeholderReport(r, token);
    case 'sources': return placeholderSources(r, token);
    case 'accounts': return placeholderAccounts(r, token);
    case 'editions': return placeholderEditions();
    case 'method': return placeholderMethod();
    case 'settings': return placeholderSettings();
    default: return renderMissing('page');
  }
}
/* Unknown routes ('page') and unknown or withdrawn report IDs ('report'). */
function renderMissing(kind = 'page') {
  const report = kind === 'report';
  app.innerHTML = `<div class="wrap state" data-missing="${report ? 'report' : 'page'}">
<h1>${report ? 'This report is not in this edition.' : 'This page could not be found.'}</h1>
<p>${report ? 'It may have been renamed or withdrawn, or the link may be incomplete. Nothing else is affected, and your reading data is untouched.' : `The address <code>${esc(location.hash || '#')}</code> does not match any page on this site.`}</p>
<div class="cluster"><a class="button button-primary" href="#index">Go to the library</a><a class="button" href="#method">How reports are made</a></div>
</div>`;
  document.title = report ? 'Report not found · Parallax' : 'Not found · Parallax · AI Observatory';
  const readbar = document.getElementById('readbar');
  if (readbar) readbar.hidden = true;
  stopProgress();
}
function renderViewError(error) {
  app.innerHTML = `<div class="wrap state" data-error="view">
<h1>This page could not be shown.</h1>
<p>${esc(error && error.message ? error.message : 'Something went wrong while drawing this page.')}</p>
<div class="cluster"><button type="button" class="button button-primary" data-action="retry">Try again</button><a class="button" href="#index">Go to the library</a></div>
</div>`;
  app.setAttribute('aria-busy', 'false');
}
function renderBootError(error) {
  app.setAttribute('aria-busy', 'false');
  app.innerHTML = `<div class="wrap state" data-error="boot">
<h1>The library could not be loaded.</h1>
<p>Every report on this site is a plain file, and the file that lists them did not arrive. A new edition may still be deploying, or the connection may have dropped.</p>
<div class="cluster"><button type="button" class="button button-primary" data-action="retry-boot">Try again</button><a class="button" href="feed.xml">Read the RSS feed instead</a></div>
<details><summary>Technical detail</summary><p><code>${esc(error && error.name ? error.name : 'Error')}: ${esc(error && error.message ? error.message : String(error))}</code></p></details>
</div>`;
}

/* ============================================================================= 18. BOOT */
function wireThemeToggle() {
  const button = document.getElementById('toggle-theme');
  if (!button) return;
  let timer = 0;
  let longPressed = false;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    longPressed = false;
    cancel();
    timer = setTimeout(() => { timer = 0; longPressed = true; toggleTheme({ red: true }); }, 550);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, cancel);
  button.addEventListener('contextmenu', event => { if (longPressed || timer) event.preventDefault(); });
  button.addEventListener('click', event => {
    if (longPressed) { longPressed = false; event.preventDefault(); return; }
    toggleTheme({ red: event.shiftKey });
  });
}
function paintKbd() {
  const mac = /mac|iphone|ipad|ipod/i.test(navigator.platform || '') || /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || '');
  if (!mac) for (const el of $$('[data-kbd]')) el.textContent = el.dataset.kbd === 'mod' ? 'Ctrl' : 'Ctrl K';
}
/* The colophon's two data slots: #colophon-schedule (the edition and the next scan) and
   #colophon-repo (the public source and research archive; its list item hides without one). */
function paintShell() {
  const m = state.meta;
  const schedule = document.getElementById('colophon-schedule');
  if (schedule && m) {
    const size = plural(num(m.reportCount) ?? state.entries.length, 'report');
    schedule.textContent = m.enabled === false
      ? `This edition, built ${fmtDate(m.generatedAt)}, holds ${size}. Scanning is paused.`
      : `This edition, built ${fmtDate(m.generatedAt)}, holds ${size}. The next scan is expected after ${fmtDate(m.nextScanAt)}.`;
  }
  const repo = document.getElementById('colophon-repo');
  if (repo && m) {
    const href = m.repository ? safeURL(`https://github.com/${m.repository}`) : '';
    repo.innerHTML = href ? external(href, 'Source and research archive') : '';
    const item = repo.closest('li');
    if (item) item.hidden = !href;
  }
  paintKbd();
}
let booting = null;
/* Load the catalogue, read the stored state, paint the shell and route. Safe to call
   again (the boot error's retry does). */
function start() {
  if (!app) return Promise.resolve(false);
  if (booting) return booting;
  // The engine restores every scroll position itself (the library's list, report anchors,
  // the top of a new view). Left to the browser, Forward would restore a report's offset
  // before the router can read the list's, and Back would then return to the wrong place.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  app.setAttribute('aria-busy', 'true');
  booting = (async () => {
    try { await loadCatalog(); }
    catch (error) { console.error(error); renderBootError(error); return false; }
    finally { booting = null; }
    state.reading = readReading();
    state.prefs = validPrefs(readStorage(STORE.prefs));
    syncThemeToggle();
    paintShell();
    updateReadingControls();
    measureChrome();
    route();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measureChrome()).catch(() => {});
    return true;
  })();
  return booting;
}

/* Shell wiring that works before any data or view exists. */
for (const dialog of $$('dialog')) wireDialog(dialog);
wireThemeToggle();
state.prefs = validPrefs(readStorage(STORE.prefs));
syncThemeToggle();
paintKbd();
{
  const openPaletteButton = document.getElementById('open-palette');
  if (openPaletteButton) openPaletteButton.addEventListener('click', () => openPalette());
  const openQueueButton = document.getElementById('open-queue');
  if (openQueueButton) openQueueButton.addEventListener('click', () => openQueue());
  const openMenuButton = document.getElementById('open-menu');
  if (openMenuButton) openMenuButton.addEventListener('click', () => showDialog(document.getElementById('menu')));
  const paletteInput = document.getElementById('palette-input');
  if (paletteInput) paletteInput.addEventListener('input', () => renderPalette());
  const paletteList = document.getElementById('palette-list');
  if (paletteList) paletteList.addEventListener('mousemove', event => {
    const option = event.target instanceof Element ? event.target.closest('[data-palette-index]') : null;
    if (option && Number(option.dataset.paletteIndex) !== palette.index) selectPalette(Number(option.dataset.paletteIndex), { scroll: false });
  });
}
/* ======================================================= end of 00-core.js (IIFE open) */


/* ===== 10-marks.js ===== */

  /* ==========================================================================
     10 · MARKS — the shared visual grammar of Long Exposure.
     One rule runs through every mark on the site: where the two reviewer runs
     agree, a mark is a single stroke of ink; where they disagree, it splits
     into run A (cool) and run B (warm). Colour inside a data mark means only that.

     API
       PLATE                              shared geometry constants for every dial
       plateEpoch(entries, runs)          → { t0, tNow } in ms
       plateTies(entries)                 → Map(id → tie index), bundles equal ratings
       plateRadius(score, rMin, rMax)     → radius for a rating
       plateAngle(t, epoch)               → angle in radians for a moment in time
       spectrum(entry, { size })          → SVG string, size 'row' | 'lead' | 'hero'
       spectrumLabel(entry)               → the spoken description of a spectrum
       miniDial(entry|null, { size, highlight }) → SVG string locating reports on the plate
       plateFrame({ asOf, newIds, size, label }) → SVG string: the plate as it stood on one night
       numberWords(n)                     → 'fifty-seven'
       observatoryLine()                  → 'Fifty-seven reports, one long exposure.' parts
     ========================================================================== */

  const PLATE = {
    now: -Math.PI / 2,             // tonight sits at twelve o'clock
    sweep: Math.PI * 2 * 0.86,     // the observatory's whole life fills 0.86 of a turn
    scoreMin: 3.6,
    scoreMax: 8.2
  };
  const DAY_MS = 864e5;

  // The marks are drawn again on every filter keystroke, so what depends only on the library
  // (the opening day, the ties, a night's frame) is worked out once per library and reused.
  const PLATE_MEMO = { t0: new WeakMap(), ties: new WeakMap(), frames: new WeakMap() };
  function plateEpoch(entries, runs) {
    let byRuns = PLATE_MEMO.t0.get(entries);
    if (!byRuns) PLATE_MEMO.t0.set(entries, byRuns = new Map());
    let t0 = byRuns.get(runs || null);
    if (t0 === undefined) {
      const found = entries.map(e => Date.parse(e.discoveredAt || e.publishedAt)).filter(Number.isFinite);
      const firstRun = (runs || []).map(r => Date.parse(r.startedAt)).filter(Number.isFinite);
      t0 = Math.min(...found, ...firstRun);
      byRuns.set(runs || null, t0);
    }
    return { t0: Number.isFinite(t0) ? t0 : Date.now() - 30 * DAY_MS, tNow: Date.now() };
  }
  // Reports with the same rating would share one radius and draw over each other, so
  // they are fanned into a bundle of parallel trails, oldest first.
  function plateTies(entries) {
    const known = PLATE_MEMO.ties.get(entries);
    if (known) return known;
    const bands = new Map();
    for (const e of entries) {
      const k = Number(e.score).toFixed(1);
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push(e);
    }
    const out = new Map();
    for (const band of bands.values()) {
      band.sort((a, b) => String(a.discoveredAt).localeCompare(String(b.discoveredAt)));
      band.forEach((e, n) => out.set(e.id, n - (band.length - 1) / 2));
    }
    PLATE_MEMO.ties.set(entries, out);
    return out;
  }
  const plateRadius = (score, rMin, rMax) =>
    rMin + (clamp(Number(score) || PLATE.scoreMin, PLATE.scoreMin, PLATE.scoreMax) - PLATE.scoreMin) / (PLATE.scoreMax - PLATE.scoreMin) * (rMax - rMin);
  const plateAngle = (t, epoch) => PLATE.now - (epoch.tNow - t) / Math.max(1, epoch.tNow - epoch.t0) * PLATE.sweep;

  /* ---- the spectrum ------------------------------------------------------ */
  const SPEC_SIZES = {
    row:  { w: 96,  h: 36,  gap: 2.6, sw: 2,   labels: false },
    lead: { w: 124, h: 46,  gap: 3,   sw: 2.2, labels: false },
    hero: { w: 360, h: 132, gap: 4.6, sw: 3,   labels: true }
  };
  const SPEC_SHORT = { usefulness: 'Use', impact: 'Impact', novelty: 'Novelty', maturity: 'Maturity', openness: 'Open' };

  function spectrumLabel(entry) {
    const r = runsOf(entry);
    const parts = r.dims.map(d => d.a === d.b ? `${d.label} ${fmtScore(d.a)}` : `${d.label} ${fmtScore(d.a)} from run A and ${fmtScore(d.b)} from run B`);
    return `Ratings: ${parts.join(', ')}. ${agreementSentence(entry)}.`;
  }
  // One line per dimension. Run A rises from the axis to its score, run B falls from it
  // to its score. Agreement draws one unbroken line in ink. Disagreement shifts the two
  // halves sideways — a parallax — into run A's cool and run B's warm.
  let specSerial = 0;
  function spectrum(entry, { size = 'row' } = {}) {
    const S = SPEC_SIZES[size] || SPEC_SIZES.row;
    const r = runsOf(entry);
    const labelH = S.labels ? 22 : 0;
    const H = S.h + labelH, mid = S.h / 2, k = (S.h / 2 - 2) / 10, step = S.w / 5;
    const n = v => Math.round(v * 100) / 100;
    // Light only reads as light when it falls off softly. At list sizes a halo would be a flat
    // capsule that merges the two halves of a split, so only the large spectrum glows, through a blur.
    const glow = size === 'hero';
    const fid = glow ? `spec-blur-${++specSerial}` : '';
    let svg = `<svg class="spec spec--${size}" viewBox="0 0 ${S.w} ${H}" width="${S.w}" height="${H}" role="img" aria-label="${esc(spectrumLabel(entry))}" focusable="false">`;
    if (glow) svg += `<defs><filter id="${fid}" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
    svg += `<line class="spec-axis" x1="0" x2="${S.w}" y1="${mid}" y2="${mid}"/>`;
    const halo = (cls, x1, y1, y2) => glow ? `<line class="spec-glow ${cls}" x1="${x1}" x2="${x1}" y1="${y1}" y2="${y2}" stroke-width="${S.sw * 2.4}" filter="url(#${fid})"/>` : '';
    r.dims.forEach((d, i) => {
      const x = step * i + step / 2;
      const ya = n(mid - (Number(d.a) || 0) * k), yb = n(mid + (Number(d.b) || 0) * k);
      if (d.a === d.b) {
        svg += halo('spec-agree', x, ya, yb);
        svg += `<line class="spec-agree" x1="${x}" x2="${x}" y1="${ya}" y2="${yb}" stroke-width="${S.sw}"/>`;
      } else {
        const xa = n(x - S.gap), xb = n(x + S.gap);
        svg += halo('spec-a', xa, ya, mid) + halo('spec-b', xb, mid, yb);
        svg += `<line class="spec-a" x1="${xa}" x2="${xa}" y1="${ya}" y2="${mid}" stroke-width="${S.sw}"/>`;
        svg += `<line class="spec-b" x1="${xb}" x2="${xb}" y1="${mid}" y2="${yb}" stroke-width="${S.sw}"/>`;
      }
      if (S.labels) svg += `<text class="spec-label" x="${x}" y="${S.h + 16}" text-anchor="middle">${esc(SPEC_SHORT[d.key] || d.label)}</text>`;
    });
    return svg + '</svg>';
  }

  /* ---- the mini-dial: where a report sits on the plate ---------------------- */
  // All trails faint; the highlighted ones bright, doubled where their runs disagree.
  // A photograph of the plate in every theme: the SVG carries its own disc of sky
  // (.dial-ground), and .dial re-points its colours to the sky's (20-plate.css). Inside a
  // .night-print container, which already paints the sky, the disc is not drawn.
  function miniDial(entry, { size = 132, highlight = null } = {}) {
    const all = state.entries || [];
    if (!all.length) return '';
    const epoch = plateEpoch(all, state.runsLight || state.runs || []);
    const ties = plateTies(all);
    const c = size / 2, rMax = size / 2 - 8, rMin = rMax * 0.17;
    const ids = highlight instanceof Set ? highlight : new Set(entry ? [entry.id] : []);
    const arc = (r, a0, a1) => {
      if (a1 - a0 < 0.004) return '';
      const x0 = c + Math.cos(a0) * r, y0 = c + Math.sin(a0) * r, x1 = c + Math.cos(a1) * r, y1 = c + Math.sin(a1) * r;
      const f = v => v.toFixed(2);
      return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
    };
    let faint = '', bright = '';
    for (const e of all) {
      const t = Date.parse(e.discoveredAt || e.publishedAt);
      if (!Number.isFinite(t)) continue;
      const r = plateRadius(e.score, rMin, rMax) + (ties.get(e.id) || 0) * (size / 220);
      const a0 = plateAngle(t, epoch), a1 = PLATE.now;
      if (ids.has(e.id)) {
        const d = runsOf(e).differing;
        // An under-stroke in the page colour lifts a lit trail clear of the faint ones beneath it.
        if (d) {
          const off = 0.9 + d * 0.5;
          bright += `<path class="dial-under" d="${arc(r - off, a0, a1)}${arc(r + off, a0, a1)}"/>`;
          bright += `<path class="dial-a" d="${arc(r - off, a0, a1)}"/><path class="dial-b" d="${arc(r + off, a0, a1)}"/>`;
        } else bright += `<path class="dial-under" d="${arc(r, a0, a1)}"/><path class="dial-hit" d="${arc(r, a0, a1)}"/>`;
        bright += `<circle class="dial-head" cx="${(c + Math.cos(a1) * r).toFixed(2)}" cy="${(c + Math.sin(a1) * r).toFixed(2)}" r="${Math.max(1.6, size / 70)}"/>`;
      } else faint += arc(r, a0, a1);
    }
    const label = entry
      ? `Where this report sits on the plate: found ${fmtDate(entry.discoveredAt)}, rated ${fmtScore(entry.score)}.`
      : `${plural(ids.size, 'report')} highlighted on the plate.`;
    return `<svg class="dial" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}" focusable="false">` +
      `<circle class="dial-ground" cx="${c}" cy="${c}" r="${rMax + 4}"/>` +
      `<circle class="dial-rim" cx="${c}" cy="${c}" r="${rMax + 4}"/>` +
      `<line class="dial-now" x1="${c}" y1="${c}" x2="${c}" y2="${c - rMax - 6}"/>` +
      `<path class="dial-faint" d="${faint}"/>${bright}</svg>`;
  }

  /* ---- a frame of the exposure: the plate as it stood on one night ------------
     The logbook's contact sheet: every scan gets the plate as it stood after it.
     The angle mapping is tonight's, so frame by frame the meridian advances around
     the dial like a clock hand and the trails lengthen behind it — the exposure,
     one night at a time. That night's new reports are stars on the hand, split
     cool and warm where their runs differ. */
  function plateFrame({ asOf, newIds = new Set(), size = 168, label = '' } = {}) {
    const all = state.entries || [];
    if (!all.length || !Number.isFinite(asOf)) return '';
    // One frame per night, size and label, kept for ten minutes (tonight's hand moves on).
    let memo = PLATE_MEMO.frames.get(all);
    if (!memo) PLATE_MEMO.frames.set(all, memo = new Map());
    const key = `${asOf}|${size}|${label}|${[...newIds].sort().join(',')}|${Math.floor(Date.now() / 6e5)}`;
    if (memo.has(key)) return memo.get(key);
    if (memo.size > 400) memo.clear();
    const svg = drawFrame(all, { asOf, newIds, size, label });
    memo.set(key, svg);
    return svg;
  }
  function drawFrame(all, { asOf, newIds, size, label }) {
    const epoch = plateEpoch(all, state.runsLight || state.runs || []);
    const ties = plateTies(all);
    const c = size / 2, rMax = size / 2 - 9, rMin = rMax * 0.17;
    const f = v => v.toFixed(2);
    const arc = (r, a0, a1) => {
      if (a1 - a0 < 0.004) return '';
      return `M${f(c + Math.cos(a0) * r)} ${f(c + Math.sin(a0) * r)}A${f(r)} ${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(c + Math.cos(a1) * r)} ${f(c + Math.sin(a1) * r)}`;
    };
    const aHand = plateAngle(asOf, epoch);
    // Trails are quantised before they are drawn: one arc per half-pixel band and kind
    // (agreeing, run A, run B), from the earliest start in that band to the hand. A frame
    // can show no more than that, and the markup stays the same size however long the
    // library grows. Below 240 px a doubled trail cannot be resolved: its two halves touch
    // their neighbours and whichever colour is drawn last tints the whole frame. There the
    // accumulated trails are drawn once, in ink, and cool and warm are kept for the night's
    // new stars, the part of a frame the eye reads.
    const doubled = size >= 240;
    const off = Math.max(0.8, size / 190);
    const bands = new Map();
    const put = (kind, r, a0) => {
      const q = Math.round(r * 2) / 2, key = kind + q, b = bands.get(key);
      if (!b) bands.set(key, { kind, r: q, a0 }); else if (a0 < b.a0) b.a0 = a0;
    };
    const stars = [];
    let count = 0;
    for (const e of all) {
      const t = Date.parse(e.discoveredAt || e.publishedAt);
      if (!Number.isFinite(t) || t > asOf + DAY_MS / 2) continue;
      count++;
      const r = plateRadius(e.score, rMin, rMax) + (ties.get(e.id) || 0) * (size / 240);
      const d = runsOf(e).differing;
      const a0 = plateAngle(Math.min(t, asOf), epoch);
      if (d && doubled) { put('a', r - off, a0); put('b', r + off, a0); } else put('t', r, a0);
      if (newIds.has(e.id)) stars.push({ r, r0: r, d });
    }
    // That night's new reports are stars on the hand: one of ink where the runs agree, a
    // cool and a warm one side by side, across the hand, where they differ: the plate's
    // doubling in miniature. Stars that share a rating band are fanned along the hand so
    // they never touch, and the whole fan is fitted inside the dial: a crowded night shrinks
    // its stars rather than spill them past the outermost ring.
    let sr = Math.max(1.25, size / 96), gap = Math.max(0.9, size / 160);
    stars.sort((a, b) => a.r0 - b.r0);
    const lo = rMin * 0.6, hi = rMax + 3;
    const need = stars.length * 2 * sr + Math.max(0, stars.length - 1) * gap;
    if (need > hi - lo) { const k = (hi - lo) / need; sr *= k; gap *= k; }
    const pitch = 2 * sr + gap;
    // Push apart within each run of crowded stars, re-centre the run on its own ratings, then
    // sweep outward once (re-centring can push a run back onto its neighbour) and slide the
    // whole fan inside the dial.
    const clusters = [];
    for (const st of stars) {
      const last = clusters[clusters.length - 1];
      const prev = last && last[last.length - 1];
      if (prev && st.r < prev.r + pitch) { st.r = prev.r + pitch; last.push(st); }
      else clusters.push([st]);
    }
    for (const cl of clusters) {
      if (cl.length < 2) continue;
      const shift = cl.reduce((t, st) => t + (st.r - st.r0), 0) / cl.length;
      for (const st of cl) st.r -= shift;
    }
    for (let i = 1; i < stars.length; i++) stars[i].r = Math.max(stars[i].r, stars[i - 1].r + pitch);
    if (stars.length) {
      const inner = stars[0].r - sr, outer = stars[stars.length - 1].r + sr;
      const move = inner < lo ? lo - inner : outer > hi ? Math.max(hi - outer, lo - inner) : 0;
      if (move) for (const st of stars) st.r += move;
    }
    const split = sr * 1.15;
    const ux = Math.cos(aHand), uy = Math.sin(aHand), px = -uy, py = ux;   // along the hand, and across it
    let lit = '';
    for (const st of stars) {
      const cx0 = c + ux * st.r, cy0 = c + uy * st.r;
      const dots = st.d ? [['frame-new-a', -split], ['frame-new-b', split]] : [['frame-new', 0]];
      for (const [cls, o] of dots) {
        const x = f(cx0 + px * o), y = f(cy0 + py * o);
        lit += `<circle class="frame-glow ${cls}" cx="${x}" cy="${y}" r="${f(sr * 3)}"/><circle class="${cls}" cx="${x}" cy="${y}" r="${f(sr)}"/>`;
      }
    }
    const paths = { t: '', a: '', b: '' };
    for (const b of bands.values()) paths[b.kind] += arc(b.r, b.a0, aHand);
    const sw = size < 100 ? 0.6 : 0.75;
    const spoken = label || `The plate after the scan of ${fmtDate(new Date(asOf).toISOString())}: ${plural(count, 'report')}, ${newIds.size} new.`;
    return `<svg class="frame" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(spoken)}" focusable="false">` +
      `<circle class="frame-rim" cx="${c}" cy="${c}" r="${f(rMax + 5)}"/>` +
      `<line class="frame-hand" x1="${c}" y1="${c}" x2="${f(c + Math.cos(aHand) * (rMax + 7))}" y2="${f(c + Math.sin(aHand) * (rMax + 7))}"/>` +
      (paths.t ? `<path class="frame-trail" stroke-width="${sw}" d="${paths.t}"/>` : '') +
      (paths.a ? `<path class="frame-trail frame-a" stroke-width="${sw}" d="${paths.a}"/>` : '') +
      (paths.b ? `<path class="frame-trail frame-b" stroke-width="${sw}" d="${paths.b}"/>` : '') +
      `${lit}</svg>`;
  }

  /* ---- words ---------------------------------------------------------------- */
  function numberWords(n) {
    const a = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
      'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    n = Math.floor(Number(n) || 0);
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberWords(n % 100) : '');
    return fmtInt(n);
  }
  const capitalise = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);


/* ===== 20-plate.js ===== */

  /* ==========================================================================
     20 · THE PLATE — the library drawn as one long exposure.
     The observatory's shutter opened on the day of its first scan. Every report
     is a trail of light: it begins on the day the report was found and ends at
     tonight's meridian (twelve o'clock). Its distance from the pole is its rating;
     its weight, the length of the read. Where the two reviewer runs disagreed,
     the trail is doubled: run A cool, run B warm, apart by how many of the five
     dimensions they disagreed on.

     API
       plateHeroHTML()                  → the hero section markup, with the table equivalent
       plateLoupeHTML(caption?)         → a compact plate that follows the reader down the library
       plateNewest(entries)             → the report found most recently (ties: the higher rated)
       plateName(entry)                 → the short name a plate label uses for a report
       mountPlate(root, { onOpen, onHover, mode: 'hero'|'loupe' }) → controller.
           The hero lays real links (a.plate-callout) over the reports its canvas names, and
           exposes its geometry as data-geom on the canvas ({cx, cy, rim, wide}, CSS px).
           A loupe under 180 CSS px is a glance: rim, trails and the lit trail, no text,
           no pointer handling.
           highlight(id|null)   light one trail (the library calls this on row hover/focus)
           filter(Set|null)     dim every trail not in the set (library filters)
           refresh()            re-read colours and sizes from the CSS and redraw
           destroy()            release every listener, observer and frame
       plateTableHTML()                 → <table> listing every trail: the canvas's text equivalent

     Rules this module keeps:
       · the canvas is aria-hidden; every trail is also a link in the library list
       · no free animation loop: frames are drawn on demand. The one continuous animation
         is the exposure, once per session, only once the plate is in view, never under
         reduced motion, stopped by a click on the plate or any key, finished at once if
         the plate scrolls away
       · every colour comes from the CSS custom properties; text sizes follow the root size
       · night vision stays red: its light is combined by per-channel maximum, never summed
       · under forced colours CSS hides it and the table takes its place
       · printed, it redraws as a negative: ink on paper
     ========================================================================== */

  // The report found most recently; on a tie, the higher rated.
  function plateNewest(entries) {
    let best = null, bt = -Infinity;
    for (const e of entries || []) {
      const t = Date.parse(e.discoveredAt || e.publishedAt);
      if (!Number.isFinite(t)) continue;
      if (t > bt || (t === bt && Number(e.score) > Number(best.score))) { best = e; bt = t; }
    }
    return best;
  }
  // The short name a label on the plate uses: the entity, unless it names several things
  // ('Gemini Decisions API / Gemini Decision 1'); then the title up to its first colon or comma.
  function plateName(e) {
    if (!e) return '';
    const entity = String(e.entity || '').trim();
    if (entity && !entity.includes('/')) return entity;
    const title = String(e.title || e.id || '');
    const cut = title.search(/[:,]/);
    return (cut > 8 ? title.slice(0, cut) : title).trim();
  }

  function plateHeroHTML() {
    const entries = state.entries || [];
    const runs = state.runsLight || state.runs || [];
    const epoch = plateEpoch(entries, runs);
    const n = entries.length;
    const editions = runs.filter(r => !r.status || /complete|success|finished|published/i.test(String(r.status))).length || runs.length;
    const lastRun = runs.map(r => r.finishedAt || r.startedAt).filter(Boolean).sort().pop();
    const sources = (state.sourceStats && state.sourceStats.total) || (state.meta && state.meta.sourceCount) || 0;
    const opened = fmtDate(new Date(epoch.t0).toISOString());
    const newest = plateNewest(entries);
    const title = n
      ? `${esc(capitalise(numberWords(n)))} ${n === 1 ? 'report' : 'reports'}, <em>one long exposure.</em>`
      : 'The shutter is open, <em>the plate still dark.</em>';
    // The dateline: the edition, its night, and a way straight into the newest report.
    const dateline = [
      editions ? `<span class="plate-eyebrow-item">Edition ${fmtInt(editions)}</span>` : '',
      lastRun ? `<span class="plate-eyebrow-item">${esc(fmtDate(lastRun))}</span>` : '',
      newest ? `<span class="plate-eyebrow-item plate-eyebrow-newest">Newest: <a class="plate-newest" href="${reportURL(newest.id)}">${esc(plateName(newest))}</a></span>` : ''
    ].join('');
    return `
<section class="plate-hero" id="plate" aria-labelledby="plate-title">
  <canvas class="plate-canvas" aria-hidden="true"></canvas>
  <div class="plate-copy">
    <div class="plate-head">
      ${dateline ? `<p class="plate-eyebrow">${dateline}</p>` : ''}
      <h1 class="plate-title" id="plate-title">${title}</h1>
    </div>
    <p class="plate-lede">The shutter opened on <b>${esc(opened)}</b>. Every report this observatory has written is a trail of light: it begins on the day the report was found and ends tonight. Its distance from the pole is its rating, its weight the length of the read. Where the two reviewer runs disagreed, the trail is doubled.</p>
    <div class="plate-foot">
      <ul class="plate-figures" role="list">
        <li><button type="button" class="plate-figure" data-action="plate-to-library"><span class="plate-num">${fmtInt(n)}</span><span class="plate-cap">${n === 1 ? 'report' : 'reports'}</span></button></li>
        <li><a class="plate-figure" href="#sources"><span class="plate-num">${fmtInt(sources)}</span><span class="plate-cap">sources</span></a></li>
        <li><a class="plate-figure" href="#editions"><span class="plate-num">${fmtInt(editions)}</span><span class="plate-cap">${editions === 1 ? 'edition' : 'editions'}</span></a></li>
      </ul>
      <button type="button" class="plate-tablebtn" data-action="plate-table" aria-expanded="false" aria-controls="plate-table">View the plate as a table</button>
    </div>
  </div>
  <div class="plate-callouts"></div>
  <div class="plate-tip" hidden></div>
</section>
<section class="plate-table wrap" id="plate-table" hidden aria-label="The plate as a table"></section>`;
  }

  // The loupe: the same plate, small and square, kept beside the library so the
  // trail of whatever the reader points at is always in sight.
  function plateLoupeHTML(caption = 'Point at a report to find its trail.') {
    return `<figure class="plate-loupe" data-plate-loupe>
  <div class="plate-loupe-stage"><canvas class="plate-canvas" aria-hidden="true"></canvas><div class="plate-tip" hidden></div></div>
  <figcaption class="plate-loupe-caption">${esc(caption)}</figcaption>
</figure>`;
  }

  function plateTableHTML() {
    const rows = [...(state.entries || [])].sort((a, b) => String(a.discoveredAt).localeCompare(String(b.discoveredAt)));
    return `<table class="plate-tbl">
  <caption>Every trail on the plate: when its report was found, its rating, the length of the read, and whether the two reviewer runs agreed. Oldest first.</caption>
  <thead><tr><th scope="col">Report</th><th scope="col">Found</th><th scope="col">Rating</th><th scope="col">Read</th><th scope="col">The two runs</th></tr></thead>
  <tbody>${rows.map(e => `<tr><th scope="row"><a href="${reportURL(e.id)}">${esc(e.title)}</a></th><td>${esc(fmtDate(e.discoveredAt))}</td><td>${esc(fmtScore(e.score))}</td><td>${esc(fmtInt(e.readMinutes))} min</td><td>${esc(agreementSentence(e))}</td></tr>`).join('')}</tbody>
</table>`;
  }

  registerAction('plate-table', btn => {
    const region = document.getElementById('plate-table');
    if (!region) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide the table' : 'View the plate as a table';
    if (open && !region.firstElementChild) region.innerHTML = plateTableHTML();
    region.hidden = !open;
    if (open) {
      region.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' });
      // The next Tab should move through the table, not back up to the plate's links.
      region.setAttribute('tabindex', '-1');
      region.focus({ preventScroll: true });
    }
  });
  registerAction('plate-to-library', () => {
    const list = document.getElementById('library') || document.getElementById('report-list');
    if (list) list.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' });
    const search = document.getElementById('report-search');
    if (search) setTimeout(() => search.focus({ preventScroll: true }), motionReduced() ? 0 : 450);
  });

  const PLATE_NOOP = { highlight() {}, filter() {}, refresh() {}, destroy() {} };
  const PLATE_EXPOSED = 'parallax.v1.exposed';

  function mountPlate(root, { onOpen, onHover, mode = 'hero' } = {}) {
    const loupe = mode === 'loupe';
    const canvas = root && root.querySelector('.plate-canvas');
    const tip = root && root.querySelector('.plate-tip');
    let ctx = null;
    try { ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null; } catch (_) { ctx = null; }
    if (!ctx) { if (root) root.classList.add('plate--static'); return PLATE_NOOP; }

    const entries = state.entries || [];
    const runs = state.runsLight || state.runs || [];
    let epoch = plateEpoch(entries, runs);
    const ties = plateTies(entries);
    const trails = entries.map(e => ({
      e, id: e.id, t: Date.parse(e.discoveredAt || e.publishedAt), tie: ties.get(e.id) || 0,
      d: runsOf(e).differing, w: Math.sqrt(Number(e.readMinutes) || 8)
    })).filter(tr => Number.isFinite(tr.t)).sort((a, b) => (a.e.score - b.e.score) || (a.t - b.t));
    const byId = new Map(trails.map(tr => [tr.id, tr]));
    const editions = runs.map(r => Date.parse(r.startedAt)).filter(Number.isFinite);
    // The first screen calls out both ends of the grammar: the highest rated, one stroke of
    // ink, and the report whose runs differ on the most dimensions, doubled. (The newest has
    // its own link in the dateline.)
    const best = trails.reduce((a, b) => (!a || b.e.score > a.e.score ? b : a), null);
    const split = trails.reduce((a, b) => (!a || b.d > a.d || (b.d === a.d && (b.e.score > a.e.score || (b.e.score === a.e.score && b.t > a.t))) ? b : a), null);
    const disputed = split && split.d > 0 ? split : null;

    let W = 0, H = 0, DPR = 0, G = null, C = null, T = null, printing = false, geoDirty = true;
    let hover = null, linked = null, filterSet = null, touchSel = null, calloutLit = null;
    let exposure = 1, exposureState = loupe ? 'done' : 'waiting', exposeRaf = 0, pending = 0;
    let visible = true, destroyed = false, labelBoxes = [];
    const drawn = [];   // the callouts painted on the last frame: { tr, kind, box }
    // Layers, all at the canvas's size: full holds every trail as tonight's plate shows it;
    // dim is a faint copy of full, made by one image draw; base (only while a filter is on)
    // is dim with the filter's own trails stroked over it. A filter change strokes only its
    // own trails; clearing it costs nothing.
    const full = document.createElement('canvas');
    const fctx = full.getContext('2d');
    let dim = null, dctx = null, base = null, bctx = null;
    let fullDirty = true, dimDirty = true, baseDirty = true;
    let grain = null;
    const layersDirty = () => { fullDirty = true; dimDirty = true; baseDirty = true; };
    const layer2d = () => { const c = document.createElement('canvas'); c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); return [c, x]; };

    /* ---- colours and sizes, from the CSS ----------------------------------- */
    const triplet = v => String(v || '').trim().split(/[\s,]+/).map(Number).slice(0, 3);
    const toRGB = v => {
      const s = String(v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
      if (/^#[0-9a-f]{3}$/i.test(s)) return [1, 2, 3].map(i => parseInt(s[i] + s[i], 16));
      const m = s.match(/rgba?\(([^)]+)\)/i);
      return m ? triplet(m[1]) : [2, 4, 10];
    };
    function readColours() {
      const cs = getComputedStyle(document.documentElement);
      const v = k => cs.getPropertyValue(k).trim();
      if (printing) return {
        sky0: '#ffffff', sky1: '#ffffff', sky1rgb: [255, 255, 255], glow: 'rgba(0,0,0,0)', ring: 'rgba(20,24,36,.18)', ring2: 'rgba(20,24,36,.36)',
        ink: '#12151d', ink3: '#4a505e', trail: [30, 34, 48], a: [28, 72, 150], b: [150, 66, 16], comp: 'multiply', haloes: false, grain: false
      };
      const red = document.documentElement.dataset.theme === 'redlight';
      const sky1 = v('--sky-1') || '#02040a';
      return {
        sky0: v('--sky-0') || '#04070f', sky1, sky1rgb: toRGB(sky1), glow: v('--sky-glow') || 'rgba(70,105,180,.2)',
        ring: v('--sky-ring') || 'rgba(150,178,225,.1)', ring2: v('--sky-ring-2') || 'rgba(150,178,225,.22)',
        ink: v('--sky-ink') || '#eef2fa', ink3: v('--sky-ink-3') || '#8592ab',
        trail: triplet(v('--trail') || '226 236 255'), a: triplet(v('--trail-a') || '146 196 255'), b: triplet(v('--trail-b') || '255 168 104'),
        // Summed light turns stacked red trails white at the meridian; the per-channel
        // maximum can never exceed the trail colour, so night vision stays red.
        comp: red ? 'lighten' : 'lighter', haloes: true, grain: !red   // grey grain would add green and blue to red light
      };
    }
    // Canvas text follows the reader's text size, like everything else on the site.
    function readSizes() {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const k = loupe ? 0.92 : 1;
      return { mono: rem * 0.62 * k, monoSmall: rem * 0.56 * k, serif: rem * 0.9 * k };
    }
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const monoFont = px => `500 ${px.toFixed(2)}px "PX Mono", ui-monospace, Menlo, monospace`;
    const serifFont = px => `400 ${px.toFixed(2)}px "PX Serif", Georgia, serif`;

    /* ---- geometry ---------------------------------------------------------- */
    // The hero's words, in canvas pixels: the boxes of their actual lines, which no trail,
    // tick or rim label may run under (pad 16: the labels stand outside the rim), and the
    // blocks that hold them, which the rim itself may not cross (pad 2).
    function measureCopy() {
      const copy = root.querySelector('.plate-copy');
      if (!copy || !copy.offsetParent) return [];
      const cr = canvas.getBoundingClientRect();
      const boxes = [];
      const add = (r, pad) => { if (r.width > 0 && r.height > 0) boxes.push({ x0: r.left - cr.left, y0: r.top - cr.top, x1: r.right - cr.left, y1: r.bottom - cr.top, pad }); };
      const range = document.createRange();
      for (const el of copy.querySelectorAll('.plate-eyebrow, .plate-title, .plate-lede')) {
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) add(r, 16);
      }
      for (const el of copy.querySelectorAll('.plate-head, .plate-lede')) add(el.getBoundingClientRect(), 2);
      for (const el of copy.querySelectorAll('.plate-figure, .plate-tablebtn')) add(el.getBoundingClientRect(), 16);
      return boxes;
    }
    function geometry() {
      if (loupe) {
        if (Math.min(W, H) < 180) {   // a glance: the dial alone, edge to edge
          const rim = Math.max(3, Math.min(W, H) / 2 - 2.5);
          return { wide: false, glance: true, cx: W / 2, cy: H / 2, rim, rMax: rim - 3, rMin: (rim - 3) * 0.17 };
        }
        const cy = H * 0.5, rim = Math.max(80, Math.min(W / 2 - 30, cy - 30, H - cy - 30));
        return { wide: false, cx: W / 2, cy, rim, rMax: rim - 16, rMin: (rim - 16) * 0.17 };
      }
      const copy = measureCopy();
      if (W / Math.max(1, H) > 1.15) {
        // The pole sits right of centre and low: tonight's meridian rises clear of the copy
        // and the oldest arcs run out of frame at the bottom, as a real plate is cropped.
        // The dial then moves right, and if it must, shrinks, until its trails, ticks and
        // rim labels clear every line of the words beside it.
        const cy = H * 0.605;
        const fit = rim => {
          let cx = W * 0.668;
          for (const b of copy) {
            const reach = rim + b.pad;
            const dy = cy < b.y0 ? b.y0 - cy : cy > b.y1 ? cy - b.y1 : 0;
            if (dy < reach) cx = Math.max(cx, b.x1 + Math.sqrt(reach * reach - dy * dy));
          }
          return cx;
        };
        let rim = Math.max(120, Math.min(cy - Math.max(78, H * 0.088), W - W * 0.668 - 46));
        let cx = fit(rim);
        while (cx + rim + 46 > W && rim > 150) { rim -= 4; cx = fit(rim); }
        if (cx + rim + 46 > W) cx = Math.max(W * 0.668, W - rim - 46);
        return { wide: true, cx, cy, rim, rMax: rim - 22, rMin: (rim - 22) * 0.17 };
      }
      // On a phone the dial sits high, leaving a dark foot for the title to rest on; the
      // words begin at copyTop, and nothing that moves may print over them.
      const cx = W / 2, cy = H * 0.47;
      const rim = Math.max(80, Math.min(W / 2 - 34, cy - 50, H - cy - 62));
      const copyTop = copy.length ? Math.min(...copy.map(b => b.y0)) : H;
      return { wide: false, cx, cy, rim, rMax: rim - 16, rMin: (rim - 16) * 0.17, copyTop };
    }
    const rOf = tr => plateRadius(tr.e.score, G.rMin, G.rMax) + tr.tie * (G.glance ? 0.3 : Math.max(1.4, G.rMax / 150));
    const aOf = t => plateAngle(t, epoch);
    function settle() {
      G = geometry();
      geoDirty = false;
      layersDirty();
      canvas.dataset.geom = JSON.stringify({ cx: Math.round(G.cx), cy: Math.round(G.cy), rim: Math.round(G.rim), wide: !!G.wide });
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      // A canvas with no box (hidden under forced colours, or not laid out yet) draws nothing.
      if (rect.width < 8 || rect.height < 8) { W = H = 0; return; }
      const w = Math.round(rect.width), h = Math.round(rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (G && !geoDirty && w === W && h === H && dpr === DPR) return;   // nothing changed: do not repaint
      W = w; H = h; DPR = dpr;
      for (const c of [canvas, full, base, dim]) if (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
      for (const x of [ctx, fctx, bctx, dctx]) if (x) x.setTransform(DPR, 0, 0, DPR, 0, 0);
      watch();
      settle();
      drawNow();
    }

    /* ---- painting ---------------------------------------------------------- */
    function makeGrain() {
      // A whisper of film grain: near-black gradients band into stripes on dark screens,
      // and the plate should read as an emulsion, not as CSS.
      const s = 160, g = document.createElement('canvas');
      g.width = g.height = s;
      const gx = g.getContext('2d'), img = gx.createImageData(s, s);
      let seed = 1337;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rnd() - 0.5) * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 7;
      }
      gx.putImageData(img, 0, 0);
      return ctx.createPattern(g, 'repeat');
    }
    function paintSky(c) {
      c.globalCompositeOperation = 'source-over';
      const g = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, Math.hypot(W, H) * 0.78);
      g.addColorStop(0, C.sky0); g.addColorStop(1, C.sky1);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (C.haloes && !G.glance) {
        const glow = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, G.rMax * 1.08);
        glow.addColorStop(0, C.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = glow; c.fillRect(0, 0, W, H);
      }
      // Film grain lies in the emulsion, under everything drawn on it. Any veil laid over
      // it (the top edge, the scrim) ends in the exact sky colour, so the plate meets the
      // masthead and the page without a step.
      if (C.grain && !G.glance) paintGrain(c);
      if (!loupe) {
        // The top edge melts into the masthead's sky, so the two meet without a seam.
        const fh = Math.min(64, H * 0.12);
        const top = c.createLinearGradient(0, 0, 0, fh);
        top.addColorStop(0, rgba(C.sky1rgb, 1)); top.addColorStop(1, rgba(C.sky1rgb, 0));
        c.fillStyle = top; c.fillRect(0, 0, W, fh);
      }
    }
    // The copy owns its light: a veil of sky behind the words, painted on the plate itself,
    // over the grain, ending in the exact sky colour where the plate meets the page.
    function paintScrim(c) {
      c.save();
      c.globalCompositeOperation = 'source-over';
      const k = C.sky1rgb;
      if (G.wide) {
        const h = c.createLinearGradient(0, 0, W, 0);
        h.addColorStop(0, rgba(k, 0.94)); h.addColorStop(0.24, rgba(k, 0.8)); h.addColorStop(0.4, rgba(k, 0.32)); h.addColorStop(0.52, rgba(k, 0));
        c.fillStyle = h; c.fillRect(0, 0, W * 0.52, H);
        const v = c.createLinearGradient(0, H, 0, H * 0.78);
        v.addColorStop(0, rgba(k, 0.7)); v.addColorStop(1, rgba(k, 0));
        c.fillStyle = v; c.fillRect(0, H * 0.78, W, H * 0.22);
      } else {
        const v = c.createLinearGradient(0, H, 0, H * 0.66);
        v.addColorStop(0, rgba(k, 1)); v.addColorStop(0.42, rgba(k, 0.78)); v.addColorStop(1, rgba(k, 0));
        c.fillStyle = v; c.fillRect(0, H * 0.66, W, H * 0.34);
      }
      c.restore();
    }
    function paintGrain(c) {
      if (!grain) grain = makeGrain();
      c.save();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = grain; c.fillRect(0, 0, W, H);
      c.restore();
    }

    const fmtShort = t => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: (state.meta && state.meta.timezone) || 'Europe/Berlin' }).format(t).toUpperCase();

    function paintDial(c, tHand) {
      c.save();
      c.globalCompositeOperation = 'source-over';
      c.lineWidth = 1;
      c.textAlign = 'center';
      labelBoxes = [];
      const rim = G.rim;
      const ah = aOf(tHand);
      if (G.glance) {
        // A glance keeps the rim and tonight's hand, nothing to read.
        c.strokeStyle = C.ring2;
        c.beginPath(); c.arc(G.cx, G.cy, rim, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(G.cx, G.cy); c.lineTo(G.cx + Math.cos(ah) * (rim + 2), G.cy + Math.sin(ah) * (rim + 2)); c.stroke();
        c.restore();
        return;
      }
      // Rating circles, read like declination rings. Their numerals sit at the far end of the
      // empty wedge, beside the day the shutter opened, each with a tick on its own ring.
      const gap = Math.PI * 2 - PLATE.sweep;
      const la = PLATE.now + gap * 0.9;
      c.font = monoFont(T.mono);
      for (let s = 4; s <= 8; s++) {
        const r = plateRadius(s, G.rMin, G.rMax);
        c.strokeStyle = s === 6 ? C.ring2 : C.ring;
        c.setLineDash(s === 6 ? [] : [1.5, 4]);
        c.beginPath(); c.arc(G.cx, G.cy, r, 0, Math.PI * 2); c.stroke();
        c.setLineDash([]);
        const tx = G.cx + Math.cos(la) * r, ty = G.cy + Math.sin(la) * r;
        c.strokeStyle = C.ring2;
        c.beginPath(); c.moveTo(tx - Math.cos(la) * 3, ty - Math.sin(la) * 3); c.lineTo(tx + Math.cos(la) * 3, ty + Math.sin(la) * 3); c.stroke();
        const lx = tx + Math.cos(la + Math.PI / 2) * (T.mono * 0.95), ly = ty + Math.sin(la + Math.PI / 2) * (T.mono * 0.95);
        c.fillStyle = C.ink3;
        c.fillText(String(s), lx, ly + T.mono * 0.36);
        labelBoxes.push({ x: lx - T.mono * 0.6, y: ly - T.mono * 0.7, w: T.mono * 1.2, h: T.mono * 1.4 });
      }
      // The rim: one tick per day, a longer one per edition.
      c.strokeStyle = C.ring;
      c.beginPath(); c.arc(G.cx, G.cy, rim, aOf(epoch.t0), PLATE.now); c.stroke();
      for (let t = Math.ceil(epoch.t0 / DAY_MS) * DAY_MS; t <= epoch.tNow; t += DAY_MS) {
        const a = aOf(t);
        c.beginPath();
        c.moveTo(G.cx + Math.cos(a) * rim, G.cy + Math.sin(a) * rim);
        c.lineTo(G.cx + Math.cos(a) * (rim + 4), G.cy + Math.sin(a) * (rim + 4));
        c.stroke();
      }
      c.strokeStyle = C.ring2;
      for (const t of editions) {
        const a = aOf(t);
        c.beginPath();
        c.moveTo(G.cx + Math.cos(a) * rim, G.cy + Math.sin(a) * rim);
        c.lineTo(G.cx + Math.cos(a) * (rim + 10), G.cy + Math.sin(a) * (rim + 10));
        c.stroke();
      }
      // Dates on the rim: the day the shutter opened, the first of each month.
      c.fillStyle = C.ink3;
      const labels = [epoch.t0];
      if (G.wide) {   // month labels only where there is room; the narrow dial keeps the opening date and tonight
        const d = new Date(epoch.t0); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
        for (; +d < epoch.tNow - 3 * DAY_MS; d.setUTCMonth(d.getUTCMonth() + 1)) if (+d - epoch.t0 > 4 * DAY_MS) labels.push(+d);
      }
      for (const t of labels) {
        // A date the edge of the plate would slice in half is left out: the arcs may be
        // cropped like a photograph, but not a word.
        const a = aOf(t), r = rim + T.mono * 2.5;
        const x = G.cx + Math.cos(a) * r, y = G.cy + Math.sin(a) * r;
        if (y > H - T.mono * 1.6 || y < T.mono * 1.6 || x < T.mono * 3 || x > W - T.mono * 3) continue;
        placeOnRim(c, a, fmtShort(t), r);
      }
      // Tonight's meridian, where every trail ends. During the exposure it is the clock
      // hand, labelled with the date it has reached.
      c.strokeStyle = C.ring2;
      c.beginPath();
      c.moveTo(G.cx + Math.cos(ah) * G.rMin * 0.5, G.cy + Math.sin(ah) * G.rMin * 0.5);
      c.lineTo(G.cx + Math.cos(ah) * (rim + 10), G.cy + Math.sin(ah) * (rim + 10));
      c.stroke();
      c.fillStyle = C.ink;
      // On a phone the words sit just below the dial: while the hand sweeps past them, its
      // date is set inside the rim instead, so the moving label never prints over the copy.
      let lr = rim + T.mono * 2.5;
      if (G.copyTop !== undefined && G.cy + Math.sin(ah) * lr + T.mono > G.copyTop - 6) lr = rim - T.mono * 1.7;
      placeOnRim(c, ah, (exposure < 1 ? '' : 'TONIGHT · ') + fmtShort(tHand), lr);
      c.beginPath(); c.arc(G.cx, G.cy, 1.6, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    // Labels follow the rim, and turn over on its lower half so they never read upside down.
    function placeOnRim(c, a, text, r) {
      c.save();
      c.translate(G.cx + Math.cos(a) * r, G.cy + Math.sin(a) * r);
      const lower = Math.sin(a) > 0.08;
      c.rotate(lower ? a - Math.PI / 2 : a + Math.PI / 2);
      c.fillText(text, 0, lower ? 0 : T.mono * 0.34);
      c.restore();
    }

    // A conic gradient centred on the pole fades each trail along its own length,
    // from its faint beginning to its bright head at tonight's meridian.
    function arcStroke(c, r, a0, a1, col, width, alphaTail, alphaHead) {
      if (a1 - a0 < 0.002 || r <= 0) return;
      if (c.createConicGradient) {
        const g = c.createConicGradient(a0, G.cx, G.cy);
        const f = Math.min(0.9999, (a1 - a0) / (Math.PI * 2));
        g.addColorStop(0, rgba(col, alphaTail)); g.addColorStop(f, rgba(col, alphaHead));
        g.addColorStop(Math.min(1, f + 1e-4), rgba(col, 0)); g.addColorStop(1, rgba(col, 0));
        c.strokeStyle = g;
      } else c.strokeStyle = rgba(col, (alphaTail + alphaHead) / 2);
      c.lineWidth = width;
      c.beginPath(); c.arc(G.cx, G.cy, r, a0, a1); c.stroke();
    }

    function paintTrail(c, tr, tHand, k) {
      if (tr.t > tHand) return null;
      const a0 = aOf(tr.t), a1 = aOf(tHand);
      const r = rOf(tr);
      const sz = G.glance ? [0.45, 0.07, 0.55, 0.3, 0.5, 0.06] : loupe ? [0.6, 0.16, 1.1, 0.9, 0.75, 0.16] : [0.75, 0.22, 1.6, 1.35, 0.9, 0.22];
      const w = sz[0] + tr.w * sz[1];
      const haloes = C.haloes && !G.glance;
      const tail = (C.haloes ? 0.06 : 0.12) * Math.min(1, k), head = Math.min(1, (C.haloes ? 0.78 : 0.8) * k);
      if (tr.d) {
        const off = sz[2] + tr.d * sz[3];
        if (haloes) { arcStroke(c, r - off, a0, a1, C.a, w * 5, 0, 0.05 * k); arcStroke(c, r + off, a0, a1, C.b, w * 5, 0, 0.05 * k); }
        arcStroke(c, r - off, a0, a1, C.a, w, tail, head);
        arcStroke(c, r + off, a0, a1, C.b, w, tail, head);
      } else {
        if (haloes) arcStroke(c, r, a0, a1, C.trail, w * 5.5, 0, 0.06 * k);
        arcStroke(c, r, a0, a1, C.trail, w * 1.1, tail, head);
      }
      const hx = G.cx + Math.cos(a1) * r, hy = G.cy + Math.sin(a1) * r;
      // Fifty-odd heads share one meridian, so halos stay tight; wide ones would sum into a smear.
      const hr = sz[4] + tr.w * sz[5];
      if (haloes || (G.glance && k > 1)) {
        const gr = hr * (k > 1 ? (G.glance ? 5 : 9) : 3.6);
        const g = c.createRadialGradient(hx, hy, 0, hx, hy, gr);
        g.addColorStop(0, rgba(C.trail, (k > 1 ? 0.5 : 0.16) * Math.min(1, k))); g.addColorStop(1, rgba(C.trail, 0));
        c.fillStyle = g; c.beginPath(); c.arc(hx, hy, gr, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = rgba(C.trail, Math.min(1, 0.9 * k));
      c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2); c.fill();
      tr.geo = { r, a0, a1, hx, hy };
      return tr.geo;
    }

    // Callouts sit in the empty wedge beside their star, like ink on a plate. One that would
    // overlap the rating numerals or another callout is moved below (or above) what it meets,
    // with an elbowed leader back to its star; one that still has nowhere to go, or would run
    // off the plate, is left out rather than clipped.
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    function callout(c, tr, kind) {
      if (!tr || !tr.geo || G.glance) return;
      const { hx, hy } = tr.geo;
      const lx = hx + (loupe ? 14 : 22);
      const fullName = plateName(tr.e);
      const max = loupe ? 24 : 30;
      const name = fullName.length > max ? fullName.slice(0, max - 1) + '…' : fullName;
      const meta = `${fmtScore(tr.e.score)} · ${tr.d ? `RUNS DIFFER ON ${tr.d} OF 5` : 'RUNS AGREE'}`;
      c.save();
      c.font = serifFont(T.serif); const nameW = c.measureText(name).width;
      c.font = monoFont(T.monoSmall); const metaW = c.measureText(meta).width;
      const top = kind ? T.serif * 1.9 : T.serif * 1.1;
      const w = Math.max(nameW, metaW) + 8, h = top + T.monoSmall * 2.4;
      const fits = b => b.x + b.w <= W - 8 && b.y >= 4 && b.y + b.h <= H - 8 && !labelBoxes.some(o => overlaps(b, o));
      let box = { x: lx - 4, y: hy - top, w, h };
      for (let tries = 0; tries < 4 && !fits(box); tries++) {
        const hit = labelBoxes.find(o => overlaps(box, o));
        if (!hit) break;
        const below = { ...box, y: hit.y + hit.h + 6 }, above = { ...box, y: hit.y - h - 6 };
        box = fits(below) || !fits(above) ? below : above;
      }
      if (!fits(box)) { c.restore(); return; }
      const ty = box.y + top;   // the line the name sits on, level with the star when unmoved
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = C.ring2; c.lineWidth = 1;
      c.beginPath();
      if (Math.abs(ty - hy) < 1) { c.moveTo(hx + 5, hy); c.lineTo(lx - 5, hy); }
      else { c.moveTo(hx + 5, hy); c.lineTo(lx - 10, hy); c.lineTo(lx - 10, ty); c.lineTo(lx - 5, ty); }
      c.stroke();
      c.textAlign = 'left';
      if (kind) { c.fillStyle = C.ink3; c.fillText(kind, lx, ty - T.serif * 0.95); }
      c.font = serifFont(T.serif); c.fillStyle = C.ink;
      c.fillText(name, lx, ty + T.serif * 0.32);
      // Pointing at the link laid over a callout underlines its name, as on any link.
      if (kind && calloutLit === tr) c.fillRect(lx, ty + T.serif * 0.32 + 3, nameW, 1);
      c.font = monoFont(T.monoSmall); c.fillStyle = C.ink3;
      c.fillText(meta, lx, ty + T.serif * 0.32 + T.monoSmall * 1.75);
      c.restore();
      labelBoxes.push(box);
      drawn.push({ tr, kind, box });
    }

    function paintTrails(c, tHand) {
      c.save();
      c.globalCompositeOperation = C.comp;
      for (const tr of trails) paintTrail(c, tr, tHand, filterSet && !filterSet.has(tr.id) ? 0.12 : 1);
      c.restore();
    }
    // Brings the layers the next frame needs up to date and returns the one to draw.
    function trailsLayer() {
      if (fullDirty) {
        fctx.clearRect(0, 0, W, H);
        fctx.save(); fctx.globalCompositeOperation = C.comp;
        for (const tr of trails) paintTrail(fctx, tr, epoch.tNow, 1);
        fctx.restore();
        fullDirty = false; dimDirty = true; baseDirty = true;
      }
      if (!filterSet) return full;
      if (!dim) { [dim, dctx] = layer2d(); dimDirty = true; }
      if (!base) { [base, bctx] = layer2d(); baseDirty = true; }
      if (dimDirty) {
        dctx.clearRect(0, 0, W, H);
        dctx.globalAlpha = 0.12; dctx.drawImage(full, 0, 0, W, H); dctx.globalAlpha = 1;
        dimDirty = false; baseDirty = true;
      }
      if (baseDirty) {
        bctx.clearRect(0, 0, W, H);
        bctx.drawImage(dim, 0, 0, W, H);
        bctx.save(); bctx.globalCompositeOperation = C.comp;
        for (const tr of trails) if (filterSet.has(tr.id)) paintTrail(bctx, tr, epoch.tNow, 1);
        bctx.restore();
        baseDirty = false;
      }
      return base;
    }

    function drawNow() {
      if (destroyed || W < 8 || H < 8) { pending = 0; return; }
      pending = 0;
      if (geoDirty || !G) settle();
      if (!C) C = readColours();
      if (!T) T = readSizes();
      const tHand = epoch.t0 + (epoch.tNow - epoch.t0) * easeExposure(exposure);
      drawn.length = 0;
      ctx.save();
      paintSky(ctx);
      paintDial(ctx, tHand);
      const focus = exposure < 1 ? null : hover || linked || touchSel;
      if (exposure < 1) {
        paintTrails(ctx, tHand);
      } else {
        const layer = trailsLayer();
        const lit = focus || calloutLit;
        ctx.globalAlpha = lit ? 0.42 : 1;
        ctx.drawImage(layer, 0, 0, W, H);
        ctx.globalAlpha = 1;
        if (lit) {
          ctx.save(); ctx.globalCompositeOperation = C.comp;
          paintTrail(ctx, lit, epoch.tNow, 1.55);
          ctx.restore();
        }
      }
      if (!loupe) paintScrim(ctx);
      if (exposure >= 1) {
        // A trail under the pointer is named by the tooltip; one lit from the list is named here.
        if (focus) { if (!hover) callout(ctx, focus, null); }
        else if (!loupe && !filterSet) {
          callout(ctx, best, 'HIGHEST RATED');
          if ((G.wide || W >= 600) && disputed && disputed !== best) callout(ctx, disputed, 'RUNS DIFFER MOST');
        }
      }
      ctx.restore();
      syncLinks();
    }
    const easeExposure = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function schedule() { if (!pending && visible && !destroyed) pending = requestAnimationFrame(drawNow); }

    /* ---- the callouts are links -------------------------------------------- */
    // The canvas paints the names; a real link lies over each one, so the first screen's
    // reports can be opened, focused and read aloud like any other link.
    const layer = loupe ? null : root.querySelector('.plate-callouts');
    const KIND_WORDS = { 'HIGHEST RATED': 'Highest rated', 'RUNS DIFFER MOST': 'Runs differ most' };
    const onLinkIn = ev => { const tr = byId.get(ev.currentTarget.dataset.plateId) || null; if (tr !== calloutLit) { calloutLit = tr; schedule(); } };
    const onLinkOut = () => { if (calloutLit) { calloutLit = null; schedule(); } };
    function syncLinks() {
      if (!layer) return;
      const want = drawn.filter(d => d.kind);
      while (layer.children.length < want.length) {
        const a = document.createElement('a');
        a.className = 'plate-callout';
        for (const [type, fn] of [['pointerenter', onLinkIn], ['focus', onLinkIn], ['pointerleave', onLinkOut], ['blur', onLinkOut]]) a.addEventListener(type, fn);
        layer.appendChild(a);
      }
      Array.from(layer.children).forEach((a, i) => {
        const d = want[i];
        if (!d) { if (document.activeElement !== a) a.hidden = true; return; }
        const key = `${d.kind}|${d.tr.id}`;
        if (a.dataset.key !== key) {
          const e = d.tr.e;
          a.dataset.key = key;
          a.dataset.plateId = d.tr.id;
          a.setAttribute('href', reportURL(d.tr.id));
          a.innerHTML = `<span class="sr-only">${esc(KIND_WORDS[d.kind] || d.kind)}: ${esc(e.title || e.id)}. Rated ${esc(fmtScore(e.score))}; ${esc(agreementSentence(e).toLowerCase())}.</span>`;
        }
        const b = d.box;
        a.style.cssText = `left:${b.x.toFixed(1)}px;top:${b.y.toFixed(1)}px;width:${b.w.toFixed(1)}px;height:${b.h.toFixed(1)}px`;
        a.hidden = false;
      });
    }

    /* ---- the exposure: once per session, once the plate is in view --------- */
    function maybeStartExposure() {
      if (exposureState !== 'waiting') return;
      let seen = false;
      try { seen = sessionStorage.getItem(PLATE_EXPOSED) === '1'; sessionStorage.setItem(PLATE_EXPOSED, '1'); } catch (_) {}
      if (seen || motionReduced()) { exposureState = 'done'; exposure = 1; drawNow(); return; }
      exposureState = 'running';
      exposure = 0;
      const startAt = performance.now(), DUR = 3600;
      const step = now => {
        if (destroyed || exposureState !== 'running') return;
        exposure = Math.min(1, (now - startAt) / DUR);
        drawNow();
        if (exposure < 1) exposeRaf = requestAnimationFrame(step);
        else finishExposure();
      };
      exposeRaf = requestAnimationFrame(step);
      canvas.addEventListener('pointerdown', finishExposure, { passive: true });
      window.addEventListener('keydown', finishExposure);
    }
    function finishExposure() {
      if (exposureState === 'done') return;
      cancelAnimationFrame(exposeRaf); exposeRaf = 0;
      exposureState = 'done'; exposure = 1;
      canvas.removeEventListener('pointerdown', finishExposure);
      window.removeEventListener('keydown', finishExposure);
      layersDirty();
      drawNow();
    }

    /* ---- pointing at a trail ------------------------------------------------ */
    function trailAt(clientX, clientY) {
      if (!G || G.glance || exposure < 1) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - G.cx, y = clientY - rect.top - G.cy;
      const rr = Math.hypot(x, y);
      if (rr > G.rim + 8 || rr < G.rMin * 0.6) return null;
      const a = Math.atan2(y, x);
      let found = null, bd = loupe ? 5 : 7;
      for (const tr of trails) {
        if (!tr.geo || (filterSet && !filterSet.has(tr.id))) continue;
        let aa = a;
        while (aa < tr.geo.a0) aa += Math.PI * 2;
        while (aa > tr.geo.a0 + Math.PI * 2) aa -= Math.PI * 2;
        if (aa > tr.geo.a1 + 0.02) continue;
        const dist = Math.abs(rr - tr.geo.r) - (tr.d ? 1.6 + tr.d * 1.35 : 0);
        if (dist < bd) { bd = dist; found = tr; }
      }
      return found;
    }
    function showTip(tr, clientX, clientY, withLink) {
      if (!tip) return;
      if (!tr) { tip.hidden = true; tip.classList.remove('is-touch'); return; }
      const e = tr.e;
      // The trail's own verdict travels with it: the same spectrum the list and the report draw.
      tip.innerHTML = `<b class="plate-tip-title">${esc(e.title)}</b>` +
        `<span class="plate-tip-row"><span class="plate-tip-spec" aria-hidden="true">${spectrum(e, { size: 'row' })}</span>` +
        `<span class="plate-tip-meta">${esc(fmtScore(e.score))} · found ${esc(fmtDate(e.discoveredAt, { short: true }))} · ${esc(fmtInt(e.readMinutes))} min` +
        `<span class="plate-tip-agree${tr.d ? ' is-split' : ''}">${esc(agreementSentence(e))}</span></span></span>` +
        (withLink ? `<a class="plate-tip-open" href="${reportURL(e.id)}">Open the report <span aria-hidden="true">→</span></a>` : '');
      tip.classList.toggle('is-touch', !!withLink);
      tip.hidden = false;
      const rr = root.getBoundingClientRect();
      const tw = tip.offsetWidth || 300, th = tip.offsetHeight || 80;
      tip.style.left = `${clamp(clientX - rr.left + 18, 8, Math.max(8, rr.width - tw - 8))}px`;
      tip.style.top = `${clamp(clientY - rr.top + 18, 8, Math.max(8, rr.height - th - 8))}px`;
    }
    const isTouch = ev => ev.pointerType === 'touch' || !!(ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents);
    const onMove = ev => {
      if (ev.pointerType === 'touch' || (G && G.glance)) return;
      const tr = trailAt(ev.clientX, ev.clientY);
      canvas.style.cursor = tr ? 'pointer' : '';
      if (tr !== hover) { hover = tr; schedule(); if (onHover) onHover(tr ? tr.id : null); }
      showTip(tr, ev.clientX, ev.clientY, false);
    };
    const onLeave = () => { if (hover) { hover = null; schedule(); if (onHover) onHover(null); } canvas.style.cursor = ''; if (!touchSel) showTip(null); };
    const onClick = ev => {
      if (G && G.glance) return;
      const touch = isTouch(ev);
      // A mouse or pen opens only the trail the tooltip names. The click's own coordinates are
      // rounded to whole pixels, where the next trail can lie a pixel away; and the click that
      // stops the exposure must stop it, not open whatever the finished plate puts under it.
      // Touch has no tooltip before the tap: the tap shows one, with its link.
      const tr = touch ? trailAt(ev.clientX, ev.clientY) : hover;
      if (touch) { touchSel = tr; schedule(); showTip(tr, ev.clientX, ev.clientY, true); return; }
      if (tr && onOpen) onOpen(tr.id);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);

    /* ---- staying current ---------------------------------------------------- */
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    // Draw only while visible: a plate whose only visible part lies under the opaque, sticky
    // masthead counts as out of view. Begin the exposure once most of the plate is in view;
    // if the reader scrolls on before it finishes, finish it at once rather than animate unseen.
    let io = null, ioTop = -1;
    function watch() {
      const m = document.getElementById('masthead');
      const top = m && /sticky|fixed/.test(getComputedStyle(m).position) ? Math.max(0, Math.round(m.getBoundingClientRect().bottom)) : 0;
      if (io && top === ioTop) return;
      ioTop = top;
      if (io) io.disconnect();
      io = new IntersectionObserver(list => {
        const entry = list[list.length - 1];
        visible = entry.isIntersecting;
        if (visible) schedule();
        if (entry.intersectionRatio >= 0.6) maybeStartExposure();
        if (!visible && exposureState === 'running') finishExposure();
      }, { threshold: [0, 0.6], rootMargin: `-${top}px 0px 0px 0px` });
      io.observe(canvas);
    }
    const mo = new MutationObserver(() => { C = null; T = null; grain = null; geoDirty = true; watch(); schedule(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-text'] });
    const mqDark = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { C = null; layersDirty(); schedule(); };
    mqDark.addEventListener && mqDark.addEventListener('change', onScheme);
    const beforePrint = () => { printing = true; C = null; layersDirty(); drawNow(); };
    const afterPrint = () => { printing = false; C = null; layersDirty(); drawNow(); };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    // Canvas text uses the self-hosted faces, and the words beside the dial change their
    // measure when they arrive: re-measure and redraw once they have.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { T = null; geoDirty = true; schedule(); } });
    // Tonight moves on: keep the meridian honest if the tab stays open past midnight.
    const tick = setInterval(() => { epoch = plateEpoch(entries, runs); layersDirty(); schedule(); }, 30 * 60 * 1000);

    resize();

    return {
      highlight(id) { const tr = id ? byId.get(id) || null : null; if (tr !== linked) { linked = tr; schedule(); } },
      filter(set) { const next = set && set.size < trails.length ? set : null; if (next !== filterSet) { filterSet = next; baseDirty = true; schedule(); } },
      refresh() { C = null; T = null; geoDirty = true; schedule(); },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(exposeRaf); cancelAnimationFrame(pending);
        canvas.removeEventListener('pointerdown', finishExposure);
        window.removeEventListener('keydown', finishExposure);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('click', onClick);
        ro.disconnect(); if (io) io.disconnect(); mo.disconnect();
        mqDark.removeEventListener && mqDark.removeEventListener('change', onScheme);
        window.removeEventListener('beforeprint', beforePrint);
        window.removeEventListener('afterprint', afterPrint);
        clearInterval(tick);
        if (layer) layer.textContent = '';
        for (const c of [full, base, dim]) if (c) c.width = c.height = 0;
      }
    };
  }


/* ===== 30-library.js ===== */
/* ==========================================================================
   30 · THE LIBRARY — #index and #queue.

   #index, top to bottom:
     the plate        plateHeroHTML() + mountPlate(). In the dark themes (night, night vision)
                      body[data-over-plate] is set while the plate is under (or directly below)
                      the masthead, and 30-library.css gives the masthead the sky. In the light
                      themes the plate is a print mounted on paper below the masthead, which
                      stays on paper: the attribute is never set there.
     its label        a museum label for the photograph, at the fold: what the plate is, how
                      long it was exposed, how many trails, and how to read a trail's weight.
     The library      section#library, two columns from 72em: the list, and beside it the loupe
                      (plateLoupeHTML + mountPlate mode 'loupe'), a small square plate that
                      stays in sight and names the trail of whatever the reader points at.
                      Below 72em the loupe becomes the glance: a 64–72 px plate docked at the
                      end of the sticky search line, lit by the row crossing a reading line
                      (40–45% down the window), so scrolling the list sweeps the plate.
                      The list column: form#report-filters (search q, category tabs with live
                      counts, min, reading, sort, reset), #report-count, then #report-list.
     #report-list     every report exactly once. Newest first and unfiltered, its first group
                      is This edition: the newest night composed as an editorial lead — the
                      night's highest-rated report as the dominant entry (title, judgment,
                      hero spectrum), the others as a tight column beside it, and the plate
                      as it stood after that night's scan (plateFrame) as the group's image.
                      Every other night is a group of rows, each headed by its own frame (a
                      72 px night print), so the exposure turns back night by night down the list. Filtered,
                      searched or sorted otherwise, that night's reports are ordinary rows.
                      60 rows first, then [data-action="more"] and a sentinel.
   Rows and trails light each other: a row or entry under the pointer or the focus lights its
   trail on the hero plate and in the loupe (highlight); a trail under the pointer on either
   plate lights its row (onHover), and nothing scrolls. Filtering dims every trail that no
   longer matches, on both plates (filter).

   #queue: the same rows, restricted to the reading queue, in the order they were saved, under
   the reader's own plate (miniDial with the queued trails lit); a row under the pointer or the
   focus lights its trail alone.

   This fragment owns renderLibrary(route, token); body[data-over-plate]; --sticky-extra while
   the filter bar is sticky. Its buttons ([data-action="more"], "reset-filters", "lib-clear")
   are handled by a listener on the library itself, which stops the engine's dispatch, so no
   global action is replaced and another fragment's "more" never reaches these. Entry titles
   (.row-title) share a view-transition-name with the report's h1 through setTransitionNames
   (the engine's default name, "vt-shared"). Every top-level name here starts with lib/LIB_.
   ========================================================================== */

const LIB_PAGE = 60;
const LIB_BRIEFS = 5;          /* the lead group: at most this many entries beside the dominant one */
const LIB_LOUPE_MQ = '(min-width: 72em)';
const LIB_LOUPE_HINT = 'Point at a report to find its trail.';
const LIB_READING_LINE = '-40% 0px -55% 0px';   /* the glance's reading line: 40–45% down the window */
const LIB_CHANGE = Object.freeze({ new: 'New', update: 'Update', baseline: 'Baseline study' });
const LIB_SORTS = Object.freeze([['latest', 'Newest first'], ['score', 'Highest rated'], ['spread', 'Most disagreement'], ['title', 'Title, A to Z']]);
const LIB_READING = Object.freeze([['', 'Any'], ['unread', 'Not read yet'], ['queued', 'In your queue'], ['progress', 'In progress'], ['read', 'Read']]);
const LIB_ICONS = Object.freeze({
  queue: '<svg class="row-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="ic-body" d="M7 4.5h10v15l-5-3.7-5 3.7z"/></svg>',
  read: '<svg class="row-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="ic-body" cx="12" cy="12" r="7.5"/><path class="ic-mark" d="m8.7 12.3 2.2 2.2 4.4-4.7"/></svg>',
  chevron: '<svg class="lib-chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg>',
  search: '<svg class="lib-search-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>'
});

const libState = {
  view: '',            /* 'index' | 'queue' while the library is on screen, else '' */
  plate: null,         /* the hero plate's controller while #index is mounted */
  loupe: null,         /* the loupe's controller while #index is mounted on a wide screen */
  glance: null,        /* the glance's controller while #index is mounted below 72em */
  sighted: '',         /* the id of the row at the reading line (below 72em) */
  readIO: null,        /* the reading line's observer */
  under: false,        /* the plate is under (or directly below) the masthead */
  list: [],            /* the entries in display order (matching the filters, or the queue) */
  shown: LIB_PAGE,     /* rows rendered; kept when the reader returns from a report */
  night: 0,            /* reports in the lead group (0 = no lead group: filtered or re-sorted) */
  lit: '',             /* the id a plate lit (its row carries .is-lit) */
  hot: '',             /* the id the list sent to the plates */
  soft: '',            /* #queue: the id whose queue toggle was just pressed on the page */
  softPrev: null,      /* #queue: that report's place in the queue, so pressing again undoes */
  lastRoute: null,     /* the route that settled before the current render */
  rerender: false,     /* the current render replaces the same view in place */
  returnTo: null,      /* {id, plate, link}: the report link the reader followed (plate: from the
                          hero; link: the selector of the hero's link, to return the focus to) */
  lastQ: '',           /* the search the list last showed: a new one arriving from elsewhere
                          (the palette's "show all matches") brings the list into view */
  jump: false,
  dayCounts: null,     /* day → rows in the current list (grouped order only) */
  dayTotals: null,     /* day → reports in the whole catalogue */
  cleanup: [],         /* run when the route leaves */
  filterKey: '',       /* 'f:' + the matching ids the plates were last told about ('' = unfiltered;
                          'f:' alone = a filter that matches nothing, which dims every trail) */
  dayFmt: null,
  runStarts: null,
  runIds: null
};

/* ------------------------------------------------------------------ dates and editions */
/* The calendar day a value falls on in the edition's time zone (the zone fmtDate uses),
   as 'YYYY-MM-DD'. A date-only value is kept as recorded. */
function libDay(value) {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const t = Date.parse(text);
  if (!Number.isFinite(t)) return '';
  if (!libState.dayFmt) {
    const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try { libState.dayFmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: (state.meta && state.meta.timezone) || 'UTC' }); }
    catch (_) { libState.dayFmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'UTC' }); }
  }
  const parts = Object.fromEntries(libState.dayFmt.formatToParts(t).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const libFound = e => (e && (e.discoveredAt || e.publishedAt)) || '';
/* "18 Oct – 16 Nov 2026" (the year once when both ends share it), as HTML: a date never breaks
   inside itself; the line may break around the dash. */
const libKeep = text => `<span class="lib-nb">${esc(text)}</span>`;
function libSpan(from, to) {
  const a = fmtDate(from), b = fmtDate(to);
  return a.slice(-4) === b.slice(-4) ? `${libKeep(fmtDate(from, { short: true }))} – ${libKeep(b)}` : `${libKeep(a)} – ${libKeep(b)}`;
}
/* The edition (1-based, counted like the plate counts them) whose scan found a report. */
function libEditionOf(value) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return 0;
  if (!libState.runStarts) {
    const runs = state.runsLight && state.runsLight.length ? state.runsLight : state.runs || [];
    const done = runs.filter(r => r && (!r.status || /complete|success|finished|published/i.test(String(r.status))));
    const dated = (done.length ? done : runs).map(r => ({ t: Date.parse(r && r.startedAt), id: String((r && r.id) || '') })).filter(x => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
    libState.runStarts = dated.map(x => x.t);
    libState.runIds = dated.map(x => x.id);
  }
  let k = 0;
  libState.runStarts.forEach((start, i) => { if (start <= t + 12 * 36e5) k = i + 1; });
  return k;
}
/* "Edition k" anywhere in the library opens that scan's entry in the logbook
   (#editions/<run id>): what it covered, what it found and what it could not see. */
function libEditionLink(k) {
  if (!k) return '';
  const id = libState.runIds && libState.runIds[k - 1];
  const label = `Edition ${esc(fmtInt(k))}`;
  return id ? `<a class="lib-ed-link" href="#editions/${esc(encodeURIComponent(id))}">${label}<span class="sr-only"> in the logbook</span></a>` : label;
}

/* ------------------------------------------------------------------ filters */
/* Options are built from the data: categories by size, and the whole-number ratings that
   actually narrow the library (above the lowest score, at most the highest). */
function libOptions() {
  const sizes = new Map();
  for (const e of state.entries) if (e.category) sizes.set(e.category, (sizes.get(e.category) || 0) + 1);
  const categories = [...sizes.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).map(([c]) => c);
  const scores = state.entries.map(e => num(e.score)).filter(v => v !== null);
  const mins = [];
  if (scores.length) {
    const lo = Math.min(...scores), hi = Math.max(...scores);
    for (let n = Math.max(1, Math.floor(lo) + 1); n <= Math.floor(hi); n++) mins.push(String(n));
  }
  return { categories, mins };
}
/* Keep only filter values the current data can honour. */
function libValidFilters(opts) {
  const f = { ...FILTER_DEFAULTS, ...state.filters };
  f.q = typeof f.q === 'string' ? f.q : '';
  if (!opts.categories.includes(f.category)) f.category = '';
  if (!opts.mins.includes(String(f.min))) f.min = '';
  if (!LIB_READING.some(([v]) => v === f.reading)) f.reading = '';
  if (!LIB_SORTS.some(([v]) => v === f.sort)) f.sort = 'latest';
  state.filters = f;
  return f;
}
function libReadingIs(id, value) {
  const r = record(id);
  switch (value) {
    case 'unread': return !r.read;
    case 'queued': return r.queued;
    case 'progress': return inProgress(id);
    case 'read': return r.read;
    default: return true;
  }
}
/* Every filter but `skip` (the facet being counted). */
function libPass(e, f, skip) {
  if (skip !== 'category' && f.category && e.category !== f.category) return false;
  if (skip !== 'min' && f.min !== '' && !((num(e.score) ?? -Infinity) >= Number(f.min))) return false;
  if (skip !== 'reading' && f.reading && !libReadingIs(e.id, f.reading)) return false;
  return true;
}
const libSearched = f => { const words = queryWords(f.q); return words.length ? state.entries.filter(e => matchesQuery(e, words)) : state.entries; };
const libFiltering = f => !!(queryWords(f.q).length || f.category || f.min || f.reading);
const libChanged = f => libFiltering(f) || f.sort !== 'latest';
function libMatches(f) {
  return sortEntries(libSearched(f).filter(e => libPass(e, f)), f.sort);
}

/* ------------------------------------------------------------------ markup */
const libScoreHTML = e => `<span class="sr-only">Rated </span>${esc(fmtScore(e.score, '–'))}`;
const libSplit = e => { const r = runsOf(e); return r.both && r.differing > 0; };
/* In a row the agreement is a quiet sentence: the warm colour belongs to run B's halves of the
   spectrum beside it. The lead entry keeps the instrument's voice (.agreement). */
/* The agreement sentence, its count kept whole: a narrow line breaks before "2 of 5" or
   "all 5", never inside it. */
const libAgreeText = e => String(agreementSentence(e)).replace(/(\S+) of (\d+)$/, '$1\u00a0of\u00a0$2').replace(/all (\d+)$/, 'all\u00a0$1');
const libAgreeHTML = e => `<p class="row-agree" aria-hidden="true">${esc(libAgreeText(e))}</p>`;
const libAgreementHTML = e => `<p class="agreement${libSplit(e) ? ' is-split' : ''}" aria-hidden="true">${esc(libAgreeText(e))}</p>`;
/* The first sentence of a text (a judgment opens with its verdict). */
function libFirstSentence(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^.+?[.!?](?=\s+[A-Z0-9“"‘'(]|$)/);
  return (m ? m[0] : t).trim();
}
/* A row's second line: the first sentence of its judgment (set as judgments are, in italic),
   or, without one, the first sentence of the summary. Whole sentences, never cut mid-word. */
function libGistHTML(e) {
  if (e.judgment) return `<p class="row-sum is-judgment">${esc(libFirstSentence(e.judgment))}</p>`;
  if (e.summary) return `<p class="row-sum">${esc(libFirstSentence(e.summary))}</p>`;
  return '';
}
/* The queue and read toggles. The visible hint is the start of the accessible name. */
function libToggleHTML(action, e) {
  const r = record(e.id);
  const on = action === 'queue' ? r.queued : r.read;
  const name = action === 'queue' ? 'Save to queue' : 'Mark as read';
  return `<button type="button" class="row-tool row-tool--${action}" data-action="${action}" data-id="${esc(e.id)}" data-tip="${name}" aria-pressed="${on}">${LIB_ICONS[action]}<span class="sr-only">${name}: ${esc(e.title || e.id)}</span></button>`;
}
/* The mono annotation line above a title: date (when the list is not grouped by night),
   category, change, length, reading state. Separators are drawn by CSS (.lib-seps), so an
   empty reading state leaves no stray dot and no line begins or ends on one. */
function libMetaHTML(e, i, { grouped = false, queue = false, change = false } = {}) {
  const id = e.id;
  const meta = [];
  if (queue) {
    const saved = record(id).savedAt;
    meta.push(`<span class="row-date"><span class="row-pos" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${saved ? ` <span class="row-k">Saved</span> <time datetime="${esc(saved)}">${esc(fmtDate(saved, { short: true }))}</time>` : ''}</span>`);
  } else if (!grouped) {
    meta.push(`<span class="row-date"><span class="row-k">Found</span> <time datetime="${esc(libFound(e))}">${esc(fmtDate(libFound(e)))}</time></span>`);
  }
  if (e.category && !queue) meta.push(`<span class="row-cat">${esc(e.category)}</span>`);
  if (change && e.changeType) meta.push(`<span class="row-change">${esc(LIB_CHANGE[e.changeType] || capitalise(e.changeType))}</span>`);
  if (num(e.readMinutes)) meta.push(`<span class="row-time">${esc(fmtInt(e.readMinutes))} min read</span>`);
  meta.push(`<span class="row-state" data-reading-label="${esc(id)}">${esc(readingLabel(id))}</span>`);
  if (queue) meta.push('<span class="row-gone" hidden>Removed from the queue</span>');
  return `<p class="row-meta lib-seps">${meta.join('')}</p>`;
}
/* One report as a catalogue row. DOM order is title, gist, meta, readout, tools (what a
   screen reader meets first); the grid sets the meta line above the title. */
function libRowHTML(e, i, { level = 3, grouped = false, queue = false } = {}) {
  const id = e.id;
  return `<li class="lib-row" data-report-id="${esc(id)}" data-reading="${readingState(id)}">
<h${level} class="row-title"><a class="row-link" href="${esc(reportURL(id))}">${esc(e.title || id)}</a></h${level}>
${libGistHTML(e)}
${libMetaHTML(e, i, { grouped, queue })}
<div class="row-read">${spectrum(e)}<p class="row-score">${libScoreHTML(e)}</p>${libAgreeHTML(e)}</div>
${libToggleHTML('queue', e)}${libToggleHTML('read', e)}
</li>`;
}
/* Rows [from, to) of the list as runs of the same day (the night the report was found). */
function libGroups(list, from, to) {
  const groups = [];
  for (let i = from; i < to; i++) {
    const e = list[i];
    const day = libDay(libFound(e)) || 'undated';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(i); else groups.push({ day, items: [i] });
  }
  return groups;
}
function libDayTally(list) {
  const out = new Map();
  for (const e of list) { const d = libDay(libFound(e)) || 'undated'; out.set(d, (out.get(d) || 0) + 1); }
  return out;
}
/* How many reports open the list on the same night (the lead group's size). */
function libNightSize(list) {
  if (!list.length) return 0;
  const day = libDay(libFound(list[0]));
  let n = 0;
  while (n < list.length && libDay(libFound(list[n])) === day) n++;
  return day ? n : 0;
}
/* The scan a night's reports came from, as a moment: the latest time any of them was found. */
function libNightTime(items) {
  const ts = items.map(e => Date.parse(libFound(e))).filter(Number.isFinite);
  return ts.length ? Math.max(...ts) : NaN;
}
/* "Edition 11 · 4 reports", with how many of that night's reports the list holds when it
   holds fewer (libState.dayCounts / dayTotals, set by libDraw). Items of a .lib-seps line. */
function libDayMetaHTML(group, list) {
  const first = list[group.items[0]];
  const k = libEditionOf(libFound(first));
  const shown = (libState.dayCounts && libState.dayCounts.get(group.day)) || group.items.length;
  const all = (libState.dayTotals && libState.dayTotals.get(group.day)) || shown;
  const size = shown < all ? `${fmtInt(shown)} of ${plural(all, 'report')}` : plural(all, 'report');
  return `${k ? `<span class="lib-day-ed">${libEditionLink(k)}</span>` : ''}<span>${esc(size)}</span>`;
}
/* A night's section, headed by its frame: the plate as it stood after that scan, a 72 px night
   print in every theme, its hand where tonight's meridian stood then and that night's new
   reports as stars on it. Beside it one annotation line: "Found 22 Oct 2026 · Edition 3 ·
   7 reports" (the date is the heading). The frame repeats what the line says: not spoken. */
function libDayHTML(group, list, rows) {
  const first = list[group.items[0]];
  const hid = `lib-day-${group.day}`;
  const items = group.items.map(i => list[i]);
  const frame = plateFrame({ asOf: libNightTime(items), newIds: new Set(items.map(e => e.id)), size: 72 });
  return `<section class="lib-day" data-day="${esc(group.day)}" aria-labelledby="${esc(hid)}">
<header class="lib-day-head">${frame ? `<span class="lib-day-frame night-print" aria-hidden="true">${frame}</span>` : ''}<div class="lib-day-line lib-seps"><h3 class="lib-day-title" id="${esc(hid)}"><span class="lib-day-k">Found</span> <time datetime="${esc(group.day)}">${esc(fmtDate(libFound(first)))}</time></h3>${libDayMetaHTML(group, list)}</div></header>
<ol class="lib-rows" role="list">${rows}</ol>
</section>`;
}

/* ---- This edition: the newest night as an editorial lead ------------------------------ */
/* The dominant entry: the night's highest-rated report, with its whole judgment and the
   labelled spectrum at hero size. */
function libLeadHTML(e) {
  const id = e.id;
  return `<li class="lib-lead" data-report-id="${esc(id)}" data-reading="${readingState(id)}">
<h4 class="row-title lib-lead-title"><a class="row-link" href="${esc(reportURL(id))}">${esc(e.title || id)}</a></h4>
${libMetaHTML(e, 0, { grouped: true, change: true })}
${e.judgment || e.summary ? `<p class="lib-lead-judgment">${esc(e.judgment || e.summary)}</p>` : ''}
<div class="lib-lead-read">${spectrum(e, { size: 'hero' })}<p class="lib-lead-score">${libScoreHTML(e)}<span class="lib-of" aria-hidden="true">/ 10</span></p>${libAgreementHTML(e)}</div>
${libToggleHTML('queue', e)}${libToggleHTML('read', e)}
</li>`;
}
/* The others: a tight column of title, annotation and readout. */
function libBriefHTML(e) {
  const id = e.id;
  return `<li class="lib-brief" data-report-id="${esc(id)}" data-reading="${readingState(id)}">
<h4 class="row-title"><a class="row-link" href="${esc(reportURL(id))}">${esc(e.title || id)}</a></h4>
${libMetaHTML(e, 0, { grouped: true, change: true })}
<div class="row-read">${spectrum(e)}<p class="row-score">${libScoreHTML(e)}</p>${libAgreeHTML(e)}</div>
${libToggleHTML('queue', e)}${libToggleHTML('read', e)}
</li>`;
}
/* The deck reads the frame beside it, as the frame draws it: a night's new reports are stars at
   the meridian, one of ink where the two runs agree, a cool and a warm star where they differ.
   "The plate after that night's scan: four new stars at the meridian, three of them split cool
   and warm where the runs differ; their trails not yet begun." */
function libNightDeck(n, k) {
  const stars = `${esc(numberWords(n))} new ${n === 1 ? 'star' : 'stars'} at the meridian`;
  const split = !k ? '' : k === n ? (n === 1 ? ', split cool and warm where the runs differ' : ', each split cool and warm where the runs differ')
    : `, ${esc(numberWords(k))} of them split cool and warm where the runs differ`;
  return `The plate after that night’s scan: ${stars}${split}; ${n === 1 ? 'its trail' : 'their trails'} not yet begun.`;
}
function libNightHTML(group, list, opts) {
  const items = group.items.map(i => list[i]);
  const lead = items.reduce((best, e) => ((num(e.score) ?? -Infinity) > (num(best.score) ?? -Infinity) ? e : best), items[0]);
  const others = items.filter(e => e !== lead);
  const briefs = others.slice(0, LIB_BRIEFS);
  const rest = others.slice(LIB_BRIEFS);
  const n = items.length;
  const k = items.filter(libSplit).length;
  const asOf = libNightTime(items);
  const frame = plateFrame({
    asOf, newIds: new Set(items.map(e => e.id)), size: 168,
    label: `The plate as it stood after the scan of ${fmtDate(libFound(lead))}: ${plural(n, 'new report')}, drawn as new stars at that night's meridian${k ? `, ${k === n ? (n === 1 ? 'split' : 'each split') : `${numberWords(k)} of them split`} into a cool and a warm star where the two runs differ` : ''}.`
  });
  return `<section class="lib-day lib-night" data-day="${esc(group.day)}" aria-labelledby="lib-night-title">
<header class="lib-night-head">
${frame ? `<div class="lib-night-plate night-print">${frame}</div>` : ''}
<div class="lib-night-titles">
<p class="lib-day-meta lib-night-meta lib-seps"><span class="lib-night-date"><span class="lib-day-k">Found</span> <time datetime="${esc(group.day)}">${esc(fmtDate(libFound(items[0])))}</time></span>${libDayMetaHTML(group, list)}</p>
<h3 class="lib-night-title" id="lib-night-title">This edition</h3>
<p class="lib-night-deck">${frame ? libNightDeck(n, k) : `${esc(capitalise(numberWords(n)))} new ${n === 1 ? 'report' : 'reports'}.`}</p>
</div>
</header>
<div class="lib-night-body${briefs.length ? '' : ' is-single'}">
<ol class="lib-night-lead" role="list">${libLeadHTML(lead)}</ol>
${briefs.length ? `<ol class="lib-night-more" role="list">${briefs.map(libBriefHTML).join('')}</ol>` : ''}
</div>
${rest.length ? `<ol class="lib-rows" role="list">${rest.map(e => libRowHTML(e, 0, { ...opts, grouped: true })).join('')}</ol>` : ''}
</section>`;
}

function libListHTML(list, from, to, opts) {
  if (!opts.grouped) return `<ol class="lib-rows" role="list">${list.slice(from, to).map((e, j) => libRowHTML(e, from + j, opts)).join('')}</ol>`;
  return libGroups(list, from, to).map((g, n) => (opts.night && from === 0 && n === 0)
    ? libNightHTML(g, list, opts)
    : libDayHTML(g, list, g.items.map(i => libRowHTML(list[i], i, opts)).join(''))).join('');
}
function libEmptyHTML() {
  if (!state.entries.length) {
    return `<div class="lib-empty"><p class="lib-empty-line">No reports yet.</p><p class="lib-empty-note">The shutter is open; the first trails appear after the next scan.</p></div>`;
  }
  const f = state.filters;
  const q = f.q.trim();
  const ways = [];
  if (q) ways.push('<button type="button" class="lib-way" data-action="lib-clear" data-what="q">Clear the search</button>');
  if (f.category) ways.push('<button type="button" class="lib-way" data-action="lib-clear" data-what="category">Show all categories</button>');
  if (f.min) ways.push('<button type="button" class="lib-way" data-action="lib-clear" data-what="min">Any rating</button>');
  if (f.reading) ways.push('<button type="button" class="lib-way" data-action="lib-clear" data-what="reading">Any reading state</button>');
  if (ways.length !== 1) ways.push('<button type="button" class="lib-way" data-action="reset-filters">Reset every filter</button>');
  const where = [f.category ? `in ${f.category}` : '', f.min ? `rated ${f.min} or more` : '', f.reading ? (LIB_READING.find(([v]) => v === f.reading) || ['', ''])[1].toLowerCase() : ''].filter(Boolean);
  return `<div class="lib-empty">
<p class="lib-empty-line">No reports match${q ? ` <q>${esc(q)}</q>` : ''}${where.length ? ` ${esc(where.join(', '))}` : ''}.</p>
<p class="lib-empty-note">${q ? 'Try fewer or shorter words, or widen the filters.' : 'Nothing in the library fits every filter at once.'}</p>
<div class="lib-ways">${ways.join('')}</div>
</div>`;
}

/* ---- The plate's label: a museum label for the photograph, at the fold ----------------- */
/* The colour key: a short trail in each run's colour. In the page's own --cool and --warm, so
   under night vision they turn the lighter and the darker red the runs are drawn in there. */
const libArcHTML = run => `<svg class="lib-arc lib-arc--${run}" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" focusable="false"><path d="M1.2 7.1A10.5 10.5 0 0 1 10.8 1.4"/></svg>`;
/* "doubled where the runs differ: run A ◜ · run B ◟". The lead words may wrap; the pair of
   runs never parts, so no line begins or ends on its dot. */
function libKeyHTML(lead = 'doubled where the runs differ:') {
  return `<span class="lib-key">${esc(lead)} <span class="lib-nb">run A${libArcHTML('a')}<span class="lib-key-dot" aria-hidden="true">·</span><span class="sr-only">, </span>run B${libArcHTML('b')}</span></span>`;
}
function libLabelHTML() {
  const epoch = plateEpoch(state.entries, state.runsLight || []);
  const n = state.entries.length;
  return `<div class="lib-label"><p class="lib-label-text lib-seps">` +
    `<span class="lib-label-work">Plate</span>` +
    `<span class="lib-label-seg">exposed ${libSpan(new Date(epoch.t0).toISOString(), new Date(epoch.tNow).toISOString())}</span>` +
    `<span class="lib-label-seg">${esc(plural(n, 'trail'))}</span>` +
    `<span class="lib-label-seg lib-label-note">a heavier trail is a longer read</span>` +
    libKeyHTML() +
    `</p></div>`;
}

/* ---- The library: header, form, list, loupe ------------------------------------------ */
function libFormHTML(opts, f) {
  const total = state.entries.length;
  const option = (value, label, current) => `<option value="${esc(value)}"${String(current) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
  const pick = (name, label, options) => `<label class="lib-pick"><span class="lib-pick-k" id="lib-${name}-k">${label}</span><select name="${name}" aria-labelledby="lib-${name}-k">${options}</select>${LIB_ICONS.chevron}</label>`;
  const mins = opts.mins.length ? pick('min', 'Rating', option('', 'Any', f.min) + opts.mins.map(n => option(n, `${n} and up`, f.min)).join('')) : '';
  const reading = pick('reading', 'Reading', LIB_READING.map(([v, l]) => option(v, l, f.reading)).join(''));
  const sort = pick('sort', 'Order', LIB_SORTS.map(([v, l]) => option(v, l, f.sort)).join(''));
  const tabs = ['', ...opts.categories].map(c => `<label class="chip lib-chip"><input type="radio" name="category" value="${esc(c)}"${f.category === c ? ' checked' : ''}><span class="lib-chip-name">${esc(c || 'All')}</span> <span class="lib-chip-n" data-n></span></label>`).join('');
  return `<form id="report-filters" class="lib-filters" novalidate>
<fieldset class="lib-cats"><legend class="sr-only">Category</legend>${tabs}</fieldset>
<span class="lib-stick" aria-hidden="true"></span>
<div class="lib-bar" role="search" aria-label="Search and filter the library">
<div class="lib-find">
<label class="lib-search"><span class="sr-only">Search the library</span>${LIB_ICONS.search}<input id="report-search" name="q" type="search" data-search autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Search ${esc(plural(total, 'report'))}" value="${esc(f.q)}"></label>
${total ? `<div class="lib-glance" aria-hidden="true">${plateLoupeHTML('')}</div>` : ''}
</div>
<div class="lib-tune">
<div class="lib-picks">${mins}${reading}${sort}</div>
<button type="button" class="lib-reset" data-action="reset-filters">Reset</button>
<p id="report-count" class="lib-count"></p>
</div>
</div>
</form>`;
}
function libLibraryHTML(opts, f) {
  const runs = state.runsLight || [];
  const epoch = plateEpoch(state.entries, runs);
  return `<section class="lib-library" id="library" aria-labelledby="lib-library-title">
<div class="lib-wrap lib-cols">
<div class="lib-main">
<header class="lib-head">
<p class="lib-eyebrow">Every report since ${esc(fmtDate(new Date(epoch.t0).toISOString()))}</p>
<h2 class="lib-h2" id="lib-library-title">The library</h2>
</header>
${libFormHTML(opts, f)}
<div id="report-list" class="lib-list"></div>
<div class="lib-more" hidden><button type="button" class="lib-way lib-more-btn" data-action="more"></button><span class="lib-sentinel" aria-hidden="true"></span></div>
</div>
${state.entries.length ? `<div class="lib-loupe">${plateLoupeHTML(LIB_LOUPE_HINT)}</div>` : ''}
</div>
</section>`;
}

/* ------------------------------------------------------------------ drawing the list */
function libDraw({ animate = false } = {}) {
  const listEl = document.getElementById('report-list');
  if (!listEl) return;
  const queue = libState.view === 'queue';
  const f = state.filters;
  const list = queue ? queuedEntries() : libMatches(f);
  libState.list = list;
  const grouped = !queue && f.sort === 'latest';
  /* The lead group: the whole library, newest first, opens on its newest night. That night is
     always drawn whole, so "more" never continues it. */
  const night = grouped && !libFiltering(f) ? libNightSize(list) : 0;
  libState.night = night;
  libState.dayCounts = grouped ? libDayTally(list) : null;
  libState.dayTotals = grouped ? libDayTally(state.entries) : null;
  const to = Math.min(list.length, Math.max(LIB_PAGE, libState.shown, night));
  libState.shown = to;
  listEl.className = `lib-list${grouped ? ' is-grouped' : ''}${animate ? ' is-fresh' : ''}`;
  listEl.innerHTML = list.length ? libListHTML(list, 0, to, { grouped, queue, night, level: queue ? 2 : grouped ? 4 : 3 }) : queue ? '' : libEmptyHTML();
  libCount();
  if (!queue) { libFacets(); libSyncReset(); }
  libSyncMore();
  /* The plates repaint every trail when their filter changes, so they are told only about a
     change (a fresh plate starts unfiltered): no redundant full repaint while the page settles.
     The key is never empty while a filter is on, so a filter that matches nothing dims every
     trail (and the hero drops its callouts) instead of reading as "unfiltered". */
  const key = !queue && libFiltering(f) ? `f:${list.map(e => e.id).join('\n')}` : '';
  if (key !== libState.filterKey) { libState.filterKey = key; libFilterPlates(); }
  if (libState.lit) { const id = libState.lit; libState.lit = ''; libLight(id); }
  if (!queue) libState.lastQ = f.q;
  libReadRows(true);
}
function libFilterPlates() {
  const set = libState.filterKey ? new Set(libState.list.map(e => e.id)) : null;
  if (libState.plate) libState.plate.filter(set);
  if (libState.loupe) libState.loupe.filter(set);
  if (libState.glance) libState.glance.filter(set);
}
function libCount() {
  const el = document.getElementById('report-count');
  if (!el) return;
  const n = libState.list.length;
  el.textContent = libState.view === 'queue' ? `${plural(n, 'report')} in your queue` : `${fmtInt(n)} of ${plural(state.entries.length, 'report')}`;
}
/* Live counts beside every choice: each facet counts what it would show with the other
   filters as they are. A choice that would show nothing is disabled (unless it is chosen). */
function libFacets() {
  const form = document.getElementById('report-filters');
  if (!form) return;
  const f = state.filters;
  const base = libSearched(f);
  const inCats = base.filter(e => libPass(e, f, 'category'));
  for (const input of form.querySelectorAll('input[name="category"]')) {
    const n = input.value ? inCats.filter(e => e.category === input.value).length : inCats.length;
    const label = input.closest('label');
    const out = label && label.querySelector('[data-n]');
    if (out) out.textContent = fmtInt(n);
    input.disabled = n === 0 && !input.checked;
  }
  const min = form.querySelector('select[name="min"]');
  if (min) {
    const pool = base.filter(e => libPass(e, f, 'min'));
    for (const o of min.options) {
      if (!o.value) continue;
      const n = pool.filter(e => (num(e.score) ?? -Infinity) >= Number(o.value)).length;
      o.textContent = `${o.value} and up (${fmtInt(n)})`;
      o.disabled = n === 0 && !o.selected;
    }
  }
  const reading = form.querySelector('select[name="reading"]');
  if (reading) {
    const pool = base.filter(e => libPass(e, f, 'reading'));
    for (const o of reading.options) {
      if (!o.value) continue;
      const n = pool.filter(e => libReadingIs(e.id, o.value)).length;
      const label = (LIB_READING.find(([v]) => v === o.value) || ['', o.value])[1];
      o.textContent = `${label} (${fmtInt(n)})`;
      o.disabled = n === 0 && !o.selected;
    }
  }
}
function libSyncReset() {
  const reset = app.querySelector('.lib-reset');
  if (reset) reset.classList.toggle('is-idle', !libChanged(state.filters));
}
function libSyncMore() {
  const zone = app.querySelector('.lib-more');
  if (!zone) return;
  const left = libState.list.length - libState.shown;
  zone.hidden = left <= 0;
  const button = zone.querySelector('[data-action="more"]');
  if (button && left > 0) button.textContent = `Show ${fmtInt(Math.min(LIB_PAGE, left))} more · ${fmtInt(left)} not shown yet`;
}
/* The next rows: appended in place (a day that continues joins its section). From the
   button, focus moves to the first new report; from the sentinel, nothing moves. */
function libMore(fromButton) {
  const listEl = document.getElementById('report-list');
  const list = libState.list;
  if (!listEl || libState.shown >= list.length) return;
  const from = libState.shown;
  const to = Math.min(list.length, from + LIB_PAGE);
  const queue = libState.view === 'queue';
  const grouped = !queue && state.filters.sort === 'latest';
  const opts = { grouped, queue, night: 0, level: queue ? 2 : grouped ? 4 : 3 };
  listEl.classList.remove('is-fresh');
  if (!grouped) {
    const ol = listEl.querySelector('.lib-rows');
    if (ol) ol.insertAdjacentHTML('beforeend', list.slice(from, to).map((e, j) => libRowHTML(e, from + j, opts)).join(''));
  } else {
    const groups = libGroups(list, from, to);
    const last = listEl.querySelector('.lib-day:last-of-type');
    if (last && !last.classList.contains('lib-night') && groups.length && last.dataset.day === groups[0].day) {
      const g = groups.shift();
      last.querySelector('.lib-rows').insertAdjacentHTML('beforeend', g.items.map(i => libRowHTML(list[i], i, opts)).join(''));
    }
    listEl.insertAdjacentHTML('beforeend', groups.map(g => libDayHTML(g, list, g.items.map(i => libRowHTML(list[i], i, opts)).join(''))).join(''));
  }
  libState.shown = to;
  libSyncMore();
  libReadRows(false);
  if (fromButton) {
    const first = listEl.querySelector(`[data-report-id="${cssEsc(list[from].id)}"] .row-link`);
    if (first) first.focus();
    announce(`${plural(to - from, 'more report')} shown, ${fmtInt(to)} of ${fmtInt(list.length)}.`);
  }
  libRewatchMore();
}
const libAnnounce = debounce(() => {
  const n = libState.list.length;
  if (libState.view === 'index') announce(n ? `${fmtInt(n)} of ${plural(state.entries.length, 'report')}.` : 'No reports match.');
}, 700);
function libApply() {
  libState.shown = LIB_PAGE;
  libDraw({ animate: true });
  libAnnounce();
}
function libSet(name, value) {
  const v = String(value ?? '');
  if (state.filters[name] === v) return;
  state.filters = { ...state.filters, [name]: v };
  libApply();
}
const libSearchLater = debounce(() => {
  const input = document.getElementById('report-search');
  if (input && libState.view === 'index') libSet('q', input.value);
}, 140);
/* Put the controls back in step with state.filters (after a reset or a clear). */
function libSyncForm() {
  const form = document.getElementById('report-filters');
  if (!form) return;
  const f = state.filters;
  const q = form.querySelector('[name="q"]');
  if (q && q.value !== f.q) q.value = f.q;
  for (const input of form.querySelectorAll('input[name="category"]')) input.checked = input.value === f.category;
  for (const name of ['min', 'reading', 'sort']) { const sel = form.querySelector(`select[name="${name}"]`); if (sel) sel.value = f[name]; }
}

/* ------------------------------------------------------------------ plates ⇄ list */
/* A plate lit a trail: light its row or entry (if it is rendered). Nothing scrolls. */
function libLight(id) {
  const next = id || '';
  if (libState.lit !== next) {
    for (const el of app.querySelectorAll('#report-list .is-lit')) el.classList.remove('is-lit');
    libState.lit = next;
    if (next) for (const el of app.querySelectorAll(`#report-list [data-report-id="${cssEsc(next)}"]`)) el.classList.add('is-lit');
  }
  libLoupeCaption();
}
/* A row or entry under the pointer or the focus: light its trail on every plate on the page
   (on #queue, the reader's own plate in the header lights that trail alone). */
function libHot(id) {
  const next = id || '';
  if (libState.hot === next) return;
  libState.hot = next;
  if (libState.view === 'queue') { libQueueDial(); return; }
  if (libState.plate) libState.plate.highlight(next || null);
  if (libState.loupe) libState.loupe.highlight(next || null);
  libGlanceLight();
  libLoupeCaption();
}
/* The glance lights what the reader points at, else the row at the reading line. */
function libGlanceLight() {
  if (libState.glance) libState.glance.highlight(libState.hot || libState.sighted || null);
}
/* The loupe's caption names what is lit: "Gemini 4 Hydrogen" (the plate's own short name: the
   entity, unless it names several things, else the title up to its first colon or comma), then
   the trail read back as data — "rated 5.5 · found 14 Nov · 9 min read · runs differ on 1 of 5":
   its distance from the pole, where it begins, its weight, and whether it is doubled. The name
   is set as a title on its own line, the rest as the instrument's annotation, never broken
   inside an item. At rest it says how to use it, and gives the colour key. */
function libLoupeCaption() {
  const cap = app.querySelector('.lib-loupe .plate-loupe-caption');
  if (!cap) return;
  const id = libState.hot || libState.lit;
  const e = id ? state.byId.get(id) : null;
  const key = e ? e.id : '-';
  if (cap.dataset.lit === key) return;
  cap.dataset.lit = key;
  const sr = '<span class="sr-only">, </span>';
  cap.innerHTML = e
    ? `<span class="lib-loupe-name">${esc(plateName(e))}</span><span class="lib-loupe-meta lib-seps">` +
      `<span>rated ${esc(fmtScore(e.score, '–'))}</span>` +
      `<span>${sr}found ${esc(fmtDate(libFound(e), { short: true }))}</span>` +
      (num(e.readMinutes) ? `<span>${sr}${esc(fmtInt(e.readMinutes))} min read</span>` : '') +
      `<span class="lib-loupe-agree${libSplit(e) ? ' is-split' : ''}">${sr}${esc(libAgreeText(e).toLowerCase())}</span></span>`
    : `<span class="lib-loupe-hint">${esc(LIB_LOUPE_HINT)}</span><span class="lib-loupe-key">${libKeyHTML('A trail is doubled where the runs differ:')}</span>`;
}
const libIdOf = el => { const host = el instanceof Element ? el.closest('#report-list [data-report-id]') : null; return host ? host.dataset.reportId || '' : ''; };

/* ------------------------------------------------------------------ wiring */
/* The masthead takes the sky only in the dark themes: in the light ones the plate is a print
   mounted below a masthead that stays on paper. */
const libDarkTheme = () => effectiveTheme() !== 'plate';
function libOverPlate(on) {
  if (on && libDarkTheme()) document.body.dataset.overPlate = 'true';
  else delete document.body.dataset.overPlate;
}
const libMastHeight = () => { const m = document.getElementById('masthead'); return m ? Math.round(m.getBoundingClientRect().height) : 0; };

function libWireLinks(root) {
  const away = ev => {
    const a = ev.target instanceof Element ? ev.target.closest('#report-list a.row-link') : null;
    if (!a || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    libState.returnTo = { id: libIdOf(a) };
    setTransitionNames(a.closest('.row-title'), () => app.querySelector('h1'));
  };
  root.addEventListener('click', away);
  root.addEventListener('pointerover', ev => { if (libState.view) libHot(libIdOf(ev.target)); });
  root.addEventListener('pointerleave', () => libHot(''));
  root.addEventListener('focusin', ev => { if (libState.view) libHot(libIdOf(ev.target)); });
  root.addEventListener('focusout', ev => { if (!libIdOf(ev.relatedTarget)) libHot(''); });
}
/* The library's own buttons. Handled here and stopped (preventDefault makes the engine skip
   its [data-action] dispatch), so they never depend on, or replace, a global action. */
function libWireActions(root) {
  root.addEventListener('click', ev => {
    const el = ev.target instanceof Element ? ev.target.closest('[data-action]') : null;
    if (!el || !root.contains(el) || el.disabled) return;
    const act = el.dataset.action;
    if (act === 'more') { ev.preventDefault(); libMore(true); }
    else if (act === 'reset-filters') { ev.preventDefault(); libReset(); }
    else if (act === 'lib-clear') { ev.preventDefault(); libClear(el.dataset.what); }
  });
}
/* Reset in place: the plates, the scroll position and the list's place stay; the search
   takes the focus. */
function libReset() {
  state.filters = { ...FILTER_DEFAULTS };
  libSyncForm();
  libApply();
  const field = document.getElementById('report-search');
  if (field) field.focus({ preventScroll: false });
}
/* One way out of an empty result: clear one filter and put the focus on its control. */
function libClear(what) {
  if (!Object.prototype.hasOwnProperty.call(FILTER_DEFAULTS, what)) return;
  state.filters = { ...state.filters, [what]: FILTER_DEFAULTS[what] };
  libSyncForm();
  libApply();
  const form = document.getElementById('report-filters');
  const target = what === 'category' ? form && form.querySelector('input[name="category"][value=""]')
    : what === 'q' ? document.getElementById('report-search') : form && form.querySelector(`select[name="${cssEsc(what)}"]`);
  if (target) target.focus({ preventScroll: false });
}
function libWireForm() {
  const form = document.getElementById('report-filters');
  if (!form) return;
  form.addEventListener('input', ev => { if (ev.target && ev.target.name === 'q') libSearchLater(); });
  form.addEventListener('change', ev => {
    const t = ev.target;
    if (!t || !t.name || t.name === 'q') return;
    if (t.type === 'radio' && !t.checked) return;
    libSet(t.name, t.value);
  });
  form.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target && ev.target.name === 'q') { ev.preventDefault(); libSearchLater.flush(); }
  });
}
/* The hero's own report links (the dateline's Newest, the callouts laid over the names the
   canvas paints, a touch tooltip's "Open the report") remember which one was followed, so that
   Back returns the focus to it at the top of the page, not to that report's row far down the
   list. Enter on a link fires click too. */
function libWireHero(hero) {
  hero.addEventListener('click', ev => {
    const a = ev.target instanceof Element ? ev.target.closest('a.plate-callout, a.plate-newest, a.plate-tip-open') : null;
    if (!a || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const r = parseRoute(a.getAttribute('href') || '');
    if (r.name !== 'report' || !r.id) return;
    const link = a.classList.contains('plate-newest') ? '.plate-newest'
      : a.classList.contains('plate-callout') ? `.plate-callout[data-plate-id="${cssEsc(r.id)}"]` : '';
    libState.returnTo = { id: r.id, plate: true, link };
  });
}
/* The gallery label's measured height, for the hero's budget (20-plate.css: the plate and its
   label share the first screen exactly). The label wraps to two lines below about 75em and
   grows with the reader's text size, so it is measured, not assumed: now (before the plate
   first measures itself) and whenever its box changes. It is taken away once another view has
   settled (the route listener below), not on leaving, so a view transition's picture of the
   library is the library as it was seen. */
function libWatchLabel() {
  const root = document.documentElement;
  const label = app.querySelector('.lib-label');
  if (!label) { root.style.removeProperty('--lib-label-h'); return; }
  /* Under forced colours the plate is not drawn (its table stands in): there is no picture to
     fit to the first screen, so the label is not budgeted and the page keeps its plain flow. */
  const forced = mq('(forced-colors: active)');
  const write = h => {
    if (forced.matches) { root.style.removeProperty('--lib-label-h'); return; }
    if (!(h > 0)) return;
    const px = `${Math.ceil(h)}px`;
    if (root.style.getPropertyValue('--lib-label-h') !== px) root.style.setProperty('--lib-label-h', px);
  };
  const measure = () => write(label.getBoundingClientRect().height);
  measure();
  if (forced.addEventListener) {
    forced.addEventListener('change', measure);
    libState.cleanup.push(() => forced.removeEventListener('change', measure));
  }
  if (typeof ResizeObserver !== 'function') return;
  const ro = new ResizeObserver(items => {
    if (libState.view !== 'index') return;
    const box = items[items.length - 1].borderBoxSize;
    const b = box && (box[0] || box);
    write(b && b.blockSize ? b.blockSize : label.getBoundingClientRect().height);
  });
  ro.observe(label, { box: 'border-box' });
  libState.cleanup.push(() => ro.disconnect());
}
/* The plate under the masthead → body[data-over-plate] (dark themes only). Set at once from
   the geometry the router will settle on (no flash of the paper masthead), then kept by an
   observer, and re-applied when the theme changes. */
function libWatchPlate(hero) {
  if (!hero) { libState.under = false; libOverPlate(false); return; }
  const from = libState.lastRoute && libState.lastRoute.name;
  const y = libState.rerender ? window.scrollY : from === 'report' ? state.listScroll : 0;
  const bottom = hero.getBoundingClientRect().bottom + window.scrollY;
  libState.under = bottom - y > libMastHeight();
  libOverPlate(libState.under);
  const onPrefs = () => { if (libState.view === 'index') libOverPlate(libState.under); };
  document.addEventListener('parallax:prefs', onPrefs);
  libState.cleanup.push(() => document.removeEventListener('parallax:prefs', onPrefs));
  if (typeof IntersectionObserver !== 'function') return;
  let io = null, height = -1;
  const watch = () => {
    const h = libMastHeight();
    if (h === height && io) return;
    height = h;
    if (io) io.disconnect();
    io = new IntersectionObserver(items => {
      const it = items[items.length - 1];
      if (libState.view !== 'index') return;
      libState.under = it.isIntersecting;
      libOverPlate(libState.under);
    }, { rootMargin: `-${h}px 0px 0px 0px` });
    io.observe(hero);
  };
  watch();
  const onResize = debounce(watch, 200);
  window.addEventListener('resize', onResize, { passive: true });
  libState.cleanup.push(() => { if (io) io.disconnect(); onResize.cancel(); window.removeEventListener('resize', onResize); });
}
/* What sticks under the masthead (CSS decides): from 72em the whole bar, on wide and tall
   enough screens; below 72em the search line with the glance. Whatever sticks and would hold
   more than a sixth of the window stays in the flow instead (.is-tall). While it sticks its
   height is --sticky-extra, so anchors and focus clear it; a hairline appears once it is stuck. */
function libWatchBar() {
  const bar = app.querySelector('.lib-bar');
  const find = app.querySelector('.lib-find');
  const stick = app.querySelector('.lib-stick');
  if (!bar) return;
  const root = document.documentElement;
  const wide = mq(LIB_LOUPE_MQ);
  let io = null, height = -1, el = bar, stuck = false;
  const sync = () => {
    if (libState.view !== 'index') return;
    const next = wide.matches || !find ? bar : find;
    if (next !== el) { el.classList.remove('is-tall', 'is-stuck'); el = next; el.classList.toggle('is-stuck', stuck); }
    el.classList.toggle('is-tall', el.getBoundingClientRect().height > window.innerHeight / 6);
    if (getComputedStyle(el).position === 'sticky') root.style.setProperty('--sticky-extra', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    else root.style.removeProperty('--sticky-extra');
    const h = libMastHeight();
    if (!stick || typeof IntersectionObserver !== 'function' || (h === height && io)) return;
    height = h;
    if (io) io.disconnect();
    /* Everything from the masthead's foot down (below the window too) counts as in view, so a
       jump straight past the bar is noticed as well as a scroll. */
    io = new IntersectionObserver(items => {
      const it = items[items.length - 1];
      stuck = !it.isIntersecting && it.boundingClientRect.top < h + 2;
      el.classList.toggle('is-stuck', stuck);
    }, { rootMargin: `-${h + 1}px 0px 100000px 0px` });
    io.observe(stick);
  };
  sync();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => sync()) : null;
  if (ro) { ro.observe(bar); if (find) ro.observe(find); }
  const onResize = debounce(sync, 150);
  window.addEventListener('resize', onResize, { passive: true });
  if (wide.addEventListener) wide.addEventListener('change', sync);
  libState.cleanup.push(() => {
    if (io) io.disconnect(); if (ro) ro.disconnect(); onResize.cancel();
    window.removeEventListener('resize', onResize);
    if (wide.removeEventListener) wide.removeEventListener('change', sync);
    root.style.removeProperty('--sticky-extra');
  });
}
/* The loupe exists only where it is shown (72em and wider): mounted when the window grows
   into that width, destroyed when it leaves it, and always destroyed with the route. */
function libWatchLoupe() {
  const host = app.querySelector('.lib-loupe [data-plate-loupe]');
  if (!host) return;
  const wide = mq(LIB_LOUPE_MQ);
  const sync = () => {
    const on = !!wide.matches && libState.view === 'index';
    if (on && !libState.loupe) {
      libState.loupe = mountPlate(host, {
        mode: 'loupe',
        onOpen: id => { libState.returnTo = { id }; location.hash = reportURL(id); },
        onHover: id => libLight(id)
      });
      if (libState.filterKey) libState.loupe.filter(new Set(libState.list.map(e => e.id)));
      if (libState.hot) libState.loupe.highlight(libState.hot);
    } else if (!on && libState.loupe) {
      libState.loupe.destroy();
      libState.loupe = null;
    }
  };
  sync();
  libLoupeCaption();
  if (wide.addEventListener) wide.addEventListener('change', sync);
  libState.cleanup.push(() => {
    if (wide.removeEventListener) wide.removeEventListener('change', sync);
    if (libState.loupe) { try { libState.loupe.destroy(); } catch (error) { console.error(error); } libState.loupe = null; }
  });
}
/* The glance: below 72em, where the loupe is not shown, a 64–72 px plate docked at the end of
   the sticky search line (mountPlate draws a plate under 180 px as a glance: rim, trails, the
   lit trail and its head; no labels, no pointer). Mounted when the window narrows into that
   range, destroyed when it widens out of it, and always destroyed with the route. It is
   decoration (aria-hidden): every trail it lights is the row the reader is looking at. */
function libWatchGlance() {
  const host = app.querySelector('.lib-glance [data-plate-loupe]');
  if (!host) return;
  const wide = mq(LIB_LOUPE_MQ);
  const sync = () => {
    const on = !wide.matches && libState.view === 'index';
    if (on && !libState.glance) {
      libState.glance = mountPlate(host, { mode: 'loupe' });
      if (libState.filterKey) libState.glance.filter(new Set(libState.list.map(e => e.id)));
      libGlanceLight();
    } else if (!on && libState.glance) {
      libState.glance.destroy();
      libState.glance = null;
    }
    libReadRows(true);
  };
  sync();
  if (wide.addEventListener) wide.addEventListener('change', sync);
  libState.cleanup.push(() => {
    if (wide.removeEventListener) wide.removeEventListener('change', sync);
    if (libState.glance) { try { libState.glance.destroy(); } catch (error) { console.error(error); } libState.glance = null; }
  });
}
/* The reading line: while the glance is mounted, the row crossing a thin band 40–45% down the
   window is "sighted": the glance lights its trail, and the row carries a 4 px dot in its
   margin (the site's mark for "here"). Scrolling the list sweeps the plate, with no animation
   of its own. On a night's head the next row is sighted already (the one about to be read);
   once the band leaves the list altogether, nothing is. */
function libReadRows(fresh) {
  const listEl = document.getElementById('report-list');
  if (!libState.glance || !listEl || typeof IntersectionObserver !== 'function') {
    if (libState.readIO) { libState.readIO.disconnect(); libState.readIO = null; }
    libSight('');
    return;
  }
  if (!libState.readIO) {
    const inBand = new Set();
    let listIn = false;
    /* The band crosses no row (it is on a night's head): the first row below it, else the last. */
    const next = () => {
      const line = window.innerHeight * 0.4;
      const rows = listEl.querySelectorAll('[data-report-id]');
      let lo = 0, hi = rows.length - 1, best = rows.length ? rows[rows.length - 1].dataset.reportId || '' : '';
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].getBoundingClientRect().top > line) { best = rows[mid].dataset.reportId || ''; hi = mid - 1; } else lo = mid + 1;
      }
      return best;
    };
    libState.readIO = new IntersectionObserver(items => {
      let entered = '';
      for (const it of items) {
        if (it.target === listEl) { listIn = it.isIntersecting; continue; }
        if (!it.target.dataset.reportId) continue;   /* a night's head: only a reason to look again */
        if (it.isIntersecting) { inBand.add(it.target); entered = it.target.dataset.reportId || entered; }
        else inBand.delete(it.target);
      }
      const still = [...inBand].filter(el => el.isConnected);
      const keep = still.some(el => el.dataset.reportId === libState.sighted) ? libState.sighted : '';
      libSight(!listIn ? '' : entered || keep || (still.length ? still[still.length - 1].dataset.reportId || '' : next()));
    }, { rootMargin: LIB_READING_LINE });
    libState.readIO.inBand = inBand;
    fresh = true;
  }
  const io = libState.readIO;
  if (fresh) { io.disconnect(); io.inBand.clear(); io.observe(listEl); }
  for (const el of listEl.querySelectorAll('[data-report-id], .lib-day-head, .lib-night-head')) io.observe(el);
}
function libSight(id) {
  const next = libState.glance ? id || '' : '';
  libState.sighted = next;
  for (const el of app.querySelectorAll('#report-list .is-sighted')) if (el.dataset.reportId !== next) el.classList.remove('is-sighted');
  if (next) for (const el of app.querySelectorAll(`#report-list [data-report-id="${cssEsc(next)}"]`)) el.classList.add('is-sighted');
  libGlanceLight();
}

/* Progressive rendering: the sentinel after the list asks for the next rows before the
   reader reaches the end. Re-observed after each batch, so a tall screen keeps filling. */
let libMoreIO = null;
function libRewatchMore() {
  const sentinel = app.querySelector('.lib-sentinel');
  if (!libMoreIO || !sentinel) return;
  libMoreIO.unobserve(sentinel);
  if (libState.shown < libState.list.length) libMoreIO.observe(sentinel);
}
function libWatchMore() {
  const sentinel = app.querySelector('.lib-sentinel');
  if (!sentinel || typeof IntersectionObserver !== 'function') return;
  libMoreIO = new IntersectionObserver(items => { if (items.some(it => it.isIntersecting)) libMore(false); }, { rootMargin: '0px 0px 640px 0px' });
  if (libState.shown < libState.list.length) libMoreIO.observe(sentinel);
  libState.cleanup.push(() => { if (libMoreIO) libMoreIO.disconnect(); libMoreIO = null; });
}
function libOnReading(ev) {
  const id = ev && ev.detail ? ev.detail.id : null;
  if (libState.view === 'index') { libFacets(); return; }
  if (libState.view !== 'queue') return;
  if (id && id === libState.soft) {
    libState.soft = '';
    const gone = !record(id).queued;
    /* Saved again from the same row: it goes back to its place, as the sheet's undo does. */
    const prev = libState.softPrev;
    if (!gone && prev && prev.id === id) {
      const place = {};
      if (Number.isFinite(Number(prev.order))) place.order = Number(prev.order);
      if (prev.savedAt) place.savedAt = prev.savedAt;
      state.reading[id] = { ...record(id), ...place };
      saveReading();
      libState.softPrev = null;
    }
    const row = app.querySelector(`#report-list [data-report-id="${cssEsc(id)}"]`);
    if (row) { row.classList.toggle('is-soft', gone); const note = row.querySelector('.row-gone'); if (note) note.hidden = !gone; }
    libQueueHead();
    return;
  }
  libRedrawQueue();
}

/* ------------------------------------------------------------------ #index */
function libRenderIndex() {
  const opts = libOptions();
  const f = libValidFilters(opts);
  const fromReport = !libState.rerender && libState.lastRoute && libState.lastRoute.name === 'report';
  const arriving = !!f.q.trim() && f.q !== libState.lastQ && !fromReport;
  app.innerHTML = `<div class="lib-sky">${plateHeroHTML()}</div>
<div class="lib-paper">
${state.entries.length ? libLabelHTML() : ''}
${libLibraryHTML(opts, f)}
</div>`;
  const paper = app.querySelector('.lib-paper');
  const table = document.getElementById('plate-table');
  if (paper && table) paper.prepend(table);
  libWatchLabel();
  const hero = document.getElementById('plate');
  libState.filterKey = '';
  libState.plate = hero ? mountPlate(hero, {
    onOpen: id => { libState.returnTo = { id, plate: true }; location.hash = reportURL(id); },
    onHover: id => libLight(id)
  }) : null;
  if (hero) libWireHero(hero);
  if (paper) libWireLinks(paper);
  const library = document.getElementById('library');
  if (library) libWireActions(library);
  libWireForm();
  libWatchLoupe();
  libWatchGlance();
  libDraw();
  libWatchPlate(hero);
  libWatchBar();
  libWatchMore();
  if (arriving && libState.rerender) libShowResults(true);
  else libState.jump = arriving;
}
/* Bring the list (and its search) into view: used when a search arrives from elsewhere. */
function libShowResults(focus) {
  const section = document.getElementById('library');
  if (!section) return;
  section.scrollIntoView({ block: 'start', behavior: 'instant' });
  const field = document.getElementById('report-search');
  if (focus && field) field.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ #queue */
function libQueueNoteHTML(saved) {
  if (!saved.length) return '<p class="lib-qnote">Save a report with its queue button and it waits here, in this browser, in the order you saved it.</p><p class="lib-ways"><a class="lib-way" href="#index">Browse the library</a></p>';
  const n = saved.length;
  const minutes = saved.filter(e => !record(e.id).read).reduce((sum, e) => sum + minutesLeft(e), 0);
  return `<p class="lib-qnote">${esc(capitalise(numberWords(n)))} ${n === 1 ? 'report waits' : 'reports wait'} here in the order you saved them${minutes ? `, with about ${esc(plural(minutes, 'minute'))} of reading left` : ''}. The queue lives in this browser only; export it from Settings to keep a copy.</p>`;
}
/* The reader's own plate: tonight's plate (miniDial, a night print in every theme) with the
   queued trails lit, beside the queue's title. A row under the pointer or the focus lights its
   trail alone; leaving the list lights them all again. With nothing saved, the plate is dark
   but for its faint trails, and says how a trail gets lit. */
function libQueuePlateHTML(saved) {
  return `<figure class="lib-qplate"><div class="lib-qdial night-print" aria-hidden="true"></div><figcaption class="lib-qcap">${libQueueCapHTML(saved)}</figcaption></figure>`;
}
function libQueueCapHTML(saved) {
  const n = saved.length;
  return n ? `Your ${esc(numberWords(n))} ${n === 1 ? 'trail' : 'trails'} on tonight’s plate` : 'No trails yet: queue a report and its trail lights here.';
}
function libQueueDial() {
  const host = app.querySelector('.lib-qdial');
  const cap = app.querySelector('.lib-qcap');
  if (!host || !state.entries.length) return;
  const saved = queuedEntries();
  const one = libState.hot && saved.some(e => e.id === libState.hot) ? state.byId.get(libState.hot) : null;
  const ids = one ? [one.id] : saved.map(e => e.id);
  const key = ids.join('\n') || '-';
  if (host.dataset.lit !== key) {
    host.dataset.lit = key;
    host.innerHTML = miniDial(null, { size: 216, highlight: new Set(ids) });
  }
  /* The caption names the one trail lit, or counts them all. */
  if (cap && cap.dataset.lit !== key) {
    cap.dataset.lit = key;
    cap.innerHTML = one ? `${esc(plateName(one))} <span class="lib-qcap-k">on tonight’s plate</span>` : libQueueCapHTML(saved);
  }
}
function libQueueHead() {
  const saved = queuedEntries();
  const title = app.querySelector('.lib-qtitle');
  const note = app.querySelector('.lib-qhead-note');
  if (title) title.textContent = saved.length ? 'Your queue' : 'Your queue is empty';
  if (note) note.innerHTML = libQueueNoteHTML(saved);
  const cap = app.querySelector('.lib-qcap');
  if (cap) cap.dataset.lit = '';
  libQueueDial();
  const el = document.getElementById('report-count');
  if (el) el.textContent = `${plural(saved.length, 'report')} in your queue`;
  const bar = app.querySelector('.lib-qbar');
  if (bar) bar.hidden = !saved.length;
  /* Nothing saved and nothing left on the page: the page keeps a field's height, and the
     plate beside the title is its picture. A row just removed here keeps the page as it is. */
  const paper = app.querySelector('.lib-paper--queue');
  if (paper) paper.classList.toggle('is-empty', !saved.length && !app.querySelector('#report-list [data-report-id]'));
}
function libRenderQueue() {
  libState.under = false;
  libOverPlate(false);
  const saved = queuedEntries();
  app.innerHTML = `<div class="lib-paper lib-paper--queue"><div class="lib-wrap">
<header class="lib-qhead${state.entries.length ? ' has-plate' : ''}">
<p class="lib-eyebrow">Your reading <span aria-hidden="true">·</span> kept in this browser</p>
<h1 class="lib-qtitle">${saved.length ? 'Your queue' : 'Your queue is empty'}</h1>
<div class="lib-qhead-note">${libQueueNoteHTML(saved)}</div>
${state.entries.length ? libQueuePlateHTML(saved) : ''}
</header>
<div class="lib-qbar"><p id="report-count" class="lib-count"></p><button type="button" class="lib-reset" data-action="open-queue">Reorder or remove</button></div>
<div class="lib-main lib-main--queue"><div id="report-list" class="lib-list lib-list--queue"></div></div>
</div></div>`;
  const paper = app.querySelector('.lib-paper');
  if (paper) {
    libWireLinks(paper);
    paper.addEventListener('click', ev => {
      const b = ev.target instanceof Element ? ev.target.closest('#report-list [data-action="queue"]') : null;
      if (!b) return;
      const id = b.dataset.id || '';
      const r = record(id);
      libState.soft = id;
      if (r.queued) libState.softPrev = { id, order: r.order, savedAt: r.savedAt };
    });
  }
  libState.shown = Math.max(LIB_PAGE, saved.length);
  libDraw();
  libQueueHead();
}
/* The queue changed elsewhere (the sheet, another tab, a read mark): redraw in the saved
   order and keep the focus where it was, or on the nearest row. */
function libRedrawQueue() {
  const listEl = document.getElementById('report-list');
  if (!listEl) return;
  const active = document.activeElement;
  const inside = active && listEl.contains(active);
  const keep = inside ? { action: active.dataset ? active.dataset.action : '', id: libIdOf(active), href: active.getAttribute('href') || '' } : null;
  const at = inside ? [...listEl.querySelectorAll('[data-report-id]')].findIndex(li => li.contains(active)) : -1;
  libState.shown = Math.max(LIB_PAGE, queuedEntries().length);
  libDraw();
  libQueueHead();
  if (!keep) return;
  let el = keep.action ? listEl.querySelector(`[data-action="${cssEsc(keep.action)}"][data-id="${cssEsc(keep.id)}"]`) : keep.href ? listEl.querySelector(`a[href="${cssEsc(keep.href)}"]`) : null;
  if (!el) { const rows = listEl.querySelectorAll('.row-link'); el = rows[Math.min(Math.max(at, 0), rows.length - 1)] || app.querySelector('.lib-qhead .lib-way, .lib-qbar [data-action]:not([hidden])') || app.querySelector('h1'); }
  if (el) { if (el.tagName === 'H1' && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
}

/* ------------------------------------------------------------------ the view */
function renderLibrary(route) {
  libState.view = route && route.name === 'queue' ? 'queue' : 'index';
  libState.cleanup = [];
  libState.lit = '';
  libState.hot = '';
  libState.soft = '';
  libState.dayFmt = null;
  libState.runStarts = null;
  libState.runIds = null;
  if (libState.view === 'queue') libRenderQueue(); else libRenderIndex();
  document.addEventListener('parallax:reading', libOnReading);
  libState.cleanup.push(() => document.removeEventListener('parallax:reading', libOnReading));
  libState.rerender = false;
  onLeave((prev, next) => {
    libState.rerender = prev === next;
    for (const fn of libState.cleanup.splice(0)) { try { fn(); } catch (error) { console.error(error); } }
    for (const key of ['plate', 'loupe', 'glance']) {
      if (libState[key]) { try { libState[key].destroy(); } catch (error) { console.error(error); } libState[key] = null; }
    }
    if (libState.readIO) { libState.readIO.disconnect(); libState.readIO = null; }
    libState.sighted = '';
    libSearchLater.cancel();
    libAnnounce.cancel();
    libState.under = false;
    libOverPlate(false);
    libState.view = '';
    libState.lit = '';
    libState.hot = '';
  });
}

/* ------------------------------------------------------------------ the router settled */
/* Back from a report opened on the plate: the focus returns to the link that was followed (the
   dateline's Newest, or the callout laid over the painted name), else to the plate's title,
   and never to that report's row far down the list (the engine has just focused it: right for
   a report opened from the list or the loupe, wrong here, where its lit trail would also put
   out the callouts). The callouts' links exist only once the plate has drawn them, a frame or
   two after the route settles: until then the title holds the focus, and hands it on to the
   link as soon as the link appears, unless the reader has moved it meanwhile. Whatever takes
   the focus is in view: if the restored scroll has left it outside the window, the page goes
   back to its top, where the plate is. */
function libFocusPlate(sel) {
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= libMastHeight() - 1 && r.bottom <= window.innerHeight + 1;
  };
  const put = el => {
    if (el.tagName === 'H1' && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    if (!inView(el)) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };
  const link = sel ? app.querySelector(sel) : null;
  if (link && !link.hidden) { put(link); return; }
  const h1 = app.querySelector('h1');
  if (h1) put(h1);
  const layer = sel ? app.querySelector('.plate-callouts') : null;
  if (!layer || typeof MutationObserver !== 'function') return;
  let mo = null, timer = 0;
  const stop = () => { if (mo) mo.disconnect(); mo = null; clearTimeout(timer); };
  mo = new MutationObserver(() => {
    const a = app.querySelector(sel);
    if (!a || a.hidden) return;
    stop();
    const now = document.activeElement;
    if (libState.view === 'index' && (now === h1 || now === document.body || !now)) put(a);
  });
  mo.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-plate-id'] });
  timer = setTimeout(stop, 2500);
  libState.cleanup.push(stop);
}
/* The router settled: remember where we came from; drop the label's height once the library
   has gone; and put the focus back on the plate for a reader returning to it. */
document.addEventListener('parallax:route', ev => {
  const detail = ev.detail || {};
  const now = detail.route || null;
  const prev = detail.prev || null;
  libState.lastRoute = now;
  if (!now || now.name !== 'index') document.documentElement.style.removeProperty('--lib-label-h');
  if (libState.jump) { libState.jump = false; if (now && now.name === 'index' && !detail.same) libShowResults(true); }
  const back = libState.returnTo;
  if (!now || detail.same || !isList(now.name)) { if (now && now.name !== 'report') libState.returnTo = null; return; }
  libState.returnTo = null;
  if (!back || !back.plate || !prev || prev.name !== 'report' || back.id !== prev.id || now.name !== 'index') return;
  libFocusPlate(back.link || '');
});


/* ===== 40-report.js ===== */
/* ==========================================================================
   40 · THE REPORT — #report/<id>[/<anchor>]
   One report, read as an instrument record. The catalogue entry paints the header,
   the verdict, the five scales and the contents at once; reports/<id>.json then fills
   the prose, the two runs' reasoning and the bibliography in place.

   Reading order (the DOM) follows the specification: header, verdict, uses and limits,
   contents, prose, ratings, sources, next. 40-report.css places the parts: wide screens
   get a sticky rail (progress, contents) on the left, the record (the report's trail on
   the plate, its facts, its actions) beside the title so the verdict reaches the first
   screen, and the "Cited here" margin on the right; phones lift the verdict directly under
   the title, so the judgment, the spectrum and the agreement share the first screen
   (audit must-fix 7).

   The plate's idea runs to the last line. The verdict's spectrum parts in view: where the
   runs disagree, one stroke of ink slides apart into run A and run B (rpParallax); each
   rating scale does the same with its carets (rpPart); and the report ends on a loupe of
   tonight's plate with its own trail lit (rpLoupe).

   Owns renderReport(route, token) and every rp* name below. Emits the contract: one h1,
   #report-body (prose only), section-<id>, #verdict, #ratings, #sources, #next, contents
   links #report/<id>/<anchor> inside a nav, #report-progress, #progress-label and
   [data-action="queue"|"read"|"resume"][data-id].
   ========================================================================== */

const RP_CHANGE = Object.freeze({ baseline: 'Baseline study', new: 'New', update: 'Update' });
const RP_VERDICT = Object.freeze({ approve: 'Approved', approved: 'Approved', reject: 'Rejected', rejected: 'Rejected', revise: 'Revisions asked for' });
const rpNum = n => String(n).padStart(2, '0');
const rpChange = e => RP_CHANGE[e && e.changeType] || (e && e.changeType ? capitalise(e.changeType) : '');
const rpHas = v => v !== null && v !== undefined && Number.isFinite(Number(v));
/* A link and a source match when they point at the same page (fragment and trailing slash aside). */
const rpURLKey = url => { const href = safeURL(url); return href ? href.replace(/#.*$/, '').replace(/\/+$/, '') : ''; };
const rpSrcAnchor = (s, n) => `src-${s && s.id ? s.id : n + 1}`;
const rpTime = (value, opts) => {
  const iso = isoDate(value);
  const text = esc(fmtDate(value, opts));
  return iso ? `<time datetime="${esc(iso)}">${text}</time>` : text;
};
const rpLines = (n, first = '') => Array.from({ length: Math.max(1, n) }, (_, i) =>
  `<span class="skeleton-line${i === n - 1 && n > 1 ? ' short' : ''}${first && !i ? ` ${first}` : ''}"></span>`).join('');

/* Glyphs. The toggles keep their names; only aria-pressed (and so the glyph's fill) changes. */
const RP_ICONS = Object.freeze({
  queue: '<svg class="rp-ico rp-ico-queue" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.75 3.25h8.5v13.5L10 13.4l-4.25 3.35z"/></svg>',
  read: '<svg class="rp-ico rp-ico-read" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.75"/><path d="m7.15 10.15 2 2.05 3.75-4.2"/></svg>'
});
/* The end mark: the observatory's mark, set after the last word of the prose, in this report's
   own grammar: its two inner arcs are ink where the runs agreed on every dimension, and run A's
   and run B's colours only where they split one (.is-split). */
const rpEndmark = split => `<svg class="rp-endmark${split ? ' is-split' : ''}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 5.2A10.8 10.8 0 1 1 5.99 11.95"/><path class="rp-endmark-a" d="M16 9.8A6.2 6.2 0 1 1 12.71 21.26"/><path class="rp-endmark-b" d="M16 11.8A4.2 4.2 0 0 1 16.87 20.11"/><circle cx="16" cy="5.2" r="2"/></svg>`;
/* Run A is drawn above a scale, pointing down at its score; run B below, pointing up. */
const RP_CARET = Object.freeze({ a: 'M-6.5 -16H6.5L0 -3.5Z', b: 'M-6.5 16H6.5L0 3.5Z', ab: 'M-6.5 -16H6.5L0 -2.5ZM-6.5 16H6.5L0 2.5Z' });
const rpKeyGlyph = kind => `<svg class="rp-keyglyph rp-keyglyph-${kind}" viewBox="-11 -17 22 34" aria-hidden="true" focusable="false"><line class="rp-keyglyph-axis" x1="-11" x2="11" y1="0" y2="0"/>${kind === 'mean' ? '<circle class="rp-track-mean" cx="0" cy="0" r="3.25"/>' : `<path d="${RP_CARET[kind]}"/>`}</svg>`;

let rpView = null;

/* ---- the route ----------------------------------------------------------- */
function renderReport(route, token) {
  const light = state.byId.get(route.id);
  if (!light) { renderMissing('report'); return undefined; }
  const cached = state.details.get(light.id) || null;
  rpView = { id: light.id, token, paint: null, blocks: [] };
  app.innerHTML = rpPageHTML(light, cached);
  paintProgress(light.id, record(light.id).progress);
  rpWire(light);
  rpExpose();
  rpParallax();
  rpPart();
  if (cached) { rpReady(cached); return undefined; }
  return loadReport(light.id).then(entry => {
    if (!isCurrent(token)) return;
    rpFill(light, entry);
  }, error => {
    if (!isCurrent(token)) return;
    if (error && error.name === 'NotFoundError') renderMissing('report');
    else rpFailed(error);
  });
}

function rpPageHTML(e, full) {
  const cite = full ? rpCitations(full) : null;
  const sections = full && Array.isArray(full.sections) ? full.sections : Array.isArray(e.sections) ? e.sections : [];
  const next = rpNearest(e);
  return `<article class="rp" data-report="${esc(e.id)}"><div class="rp-grid">
${rpHeadHTML(e)}
${rpVerdictHTML(e)}
${rpMoreHTML(e, full)}
${rpRailHTML(e, sections, next.length > 0)}
<div id="report-body" class="rp-body">${rpBodyHTML(e, full, cite)}</div>
${rpRatingsHTML(e, full)}
${rpSourcesHTML(e, full, cite)}
${rpNextHTML(e, next)}
</div></article>`;
}

/* The file arrived: replace each placeholder in place. The header, the verdict and the
   rail stay, so focus, scroll and the shared-element transition are undisturbed. */
function rpFill(light, full) {
  const cite = rpCitations(full);
  const swap = (selector, html) => { const el = app.querySelector(selector); if (el) el.outerHTML = html; };
  swap('.rp-more', rpMoreHTML(light, full));
  const body = document.getElementById('report-body');
  if (body) body.innerHTML = rpBodyHTML(light, full, cite);
  swap('#ratings', rpRatingsHTML(light, full));
  swap('#sources', rpSourcesHTML(light, full, cite));
  const lightIds = (light.sections || []).map(s => s && s.id).join('|');
  const fullIds = (full.sections || []).map(s => s && s.id).join('|');
  const toc = app.querySelector('.rp-toc ol');
  if (toc && lightIds !== fullIds) toc.innerHTML = rpTocItems(light, full.sections || [], !!app.querySelector('#next'));
  rpReady(full);
}

function rpReady(full) {
  const body = document.getElementById('report-body');
  rpPolish(body, runsOf(full).differing > 0);
  state.activeReport = full;
  if (rpView) rpView.blocks = body ? $$(PROSE_BLOCKS, body).filter(el => !el.closest('[data-progress-ignore]')) : [];
  observeProgress(full, body);
  rpPart();
  if (rpView && rpView.paint) rpView.paint(true);
}

function rpFailed(error) {
  const network = error && error.name === 'NetworkError';
  const body = document.getElementById('report-body');
  if (body) {
    body.innerHTML = `<div class="state rp-error">
<p class="rp-error-line">The full report did not arrive.</p>
<p>The verdict above comes from the catalogue; the text, the two runs’ reasoning and the sources are a separate file that ${network ? 'could not be reached' : 'could not be read'}.</p>
<div class="cluster"><button type="button" class="button button-primary" data-action="retry">Try again</button></div>
</div>`;
  }
  for (const el of $$('.rp-loading, .rp-why-wait', app)) el.remove();
  const more = app.querySelector('.rp-more');
  if (more) more.hidden = true;
  const sources = document.getElementById('sources');
  if (sources) sources.insertAdjacentHTML('beforeend', '<p class="rp-lede">The bibliography is part of the file that did not arrive.</p>');
  announce('The full report did not arrive. The verdict is shown; use Try again to load the rest.');
}

/* ---- header -------------------------------------------------------------- */
function rpToggle(action, e) {
  const r = record(e.id);
  const on = action === 'queue' ? r.queued : r.read;
  const text = action === 'queue' ? 'Save to queue' : 'Mark as read';
  return `<button type="button" class="button rp-btn" data-action="${action}" data-id="${esc(e.id)}" aria-pressed="${on}">${RP_ICONS[action]}<span>${text}</span></button>`;
}

function rpHeadHTML(e) {
  const eyebrow = [e.category, rpChange(e), e.entity].filter(Boolean).map(esc);
  /* Each item is one unbreakable phrase; the separators are drawn between them (.rp-seps), so a
     wrapped line never ends on a dot and a date never splits. */
  const meta = [
    `${esc(fmtInt(num(e.readMinutes) || 0))} min read`,
    esc(plural(num(e.wordCount) || 0, 'word')),
    esc(plural(num(e.sourceCount) || 0, 'source')),
    `<span class="rp-meta-found">Found ${rpTime(e.discoveredAt)}</span>`,
    /* A missing date is two words, as in the bibliography, never a sentence in capitals. */
    isoDate(e.publishedAt) ? `Source published ${rpTime(e.publishedAt)}` : 'Source date unknown'
  ];
  const official = safeURL(e.officialUrl) ? external(e.officialUrl, 'Official source', 'class="button rp-btn rp-btn-out"') : '';
  return `<a class="rp-back" href="#index"><span class="rp-back-arrow" aria-hidden="true">←</span>The library</a>
<p class="rp-eyebrow rp-seps">${eyebrow.map((t, i) => `<span${i ? '' : ' class="rp-eyebrow-lead"'}>${t}</span>`).join('')}</p>
<h1 class="rp-title">${esc(e.title || e.id)}</h1>
<p class="rp-stand">${esc(e.summary || '')}</p>
<div class="rp-record">
<figure class="rp-dial"><div class="rp-dial-print night-print">${miniDial(e, { size: 168 })}</div><figcaption><span class="rp-dial-cap">Where it sits on the plate</span><span class="rp-dial-sub rp-seps"><span>Found ${esc(fmtDate(e.discoveredAt, { short: true }))}</span><span>rated ${esc(fmtScore(e.score, '–'))}</span></span>${runsOf(e).differing ? '<span class="rp-dial-key rp-seps"><span>Doubled</span><span class="rp-dial-runs"><span class="rp-dial-a">run A</span> · <span class="rp-dial-b">run B</span></span></span>' : ''}</figcaption></figure>
<p class="rp-meta rp-seps">${meta.map(m => (m.startsWith('<span') ? m : `<span>${m}</span>`)).join('')}</p>
<div class="rp-actions">${rpToggle('queue', e)}${rpToggle('read', e)}${official}</div>
</div>`;
}

/* ---- the verdict ---------------------------------------------------------- */
function rpVerdictHTML(e) {
  const r = runsOf(e);
  const sum = arithmetic(e);
  const cut = sum.indexOf(': ');
  const arith = cut > 0 ? `<span>${esc(sum.slice(0, cut))}:</span> <span>${esc(sum.slice(cut + 2))}</span>` : esc(sum);
  /* The key, beside the spectrum, only where something splits: run A above the axis in the cool
     colour, run B below it in the warm. The spectrum's own name already says which run gave what. */
  const keys = r.both && r.differing
    ? '<p class="rp-v-keys" aria-hidden="true"><span class="rp-v-key rp-v-key-a"><span class="rp-v-key-run">Run </span>A ↑</span><span class="rp-v-key rp-v-key-b"><span class="rp-v-key-run">Run </span>B ↓</span></p>'
    : '';
  return `<section class="rp-verdict" id="verdict">
<div class="rp-v">
<div class="rp-v-say">
<h2 class="rp-label rp-v-h">The verdict</h2>
<p class="rp-judgment">${e.judgment ? esc(e.judgment) : 'No verdict was recorded for this report.'}</p>
${rpDecisionHTML(e)}
</div>
<div class="rp-v-read">
<p class="rp-v-score"><span class="rp-v-num">${esc(fmtScore(e.score, '–'))}</span><span class="rp-v-of" aria-hidden="true">/ 10</span><span class="sr-only"> out of 10</span></p>
<p class="rp-arith">${arith}</p>
<div class="rp-v-spec${keys ? ' has-keys' : ''}">${keys}${spectrum(e, { size: 'hero' })}${spectrum(e, { size: 'lead' })}</div>
<p class="agreement rp-v-agree${r.differing ? ' is-split' : ''}">${esc(agreementSentence(e))}</p>
<p class="rp-honesty">${esc(HONESTY)}</p>
</div>
</div>
</section>`;
}

/* What the two runs decided, under the judgment, in the grammar of every mark: one line where
   they decided alike, split into run A (cool) and run B (warm) only where they did not. */
const RP_SAID = Object.freeze({ approve: 'approved', approved: 'approved', reject: 'rejected', rejected: 'rejected', revise: 'asked for revisions' });
function rpDecisionHTML(e) {
  const r = runsOf(e);
  if (!r.a) return '';
  const said = run => RP_SAID[String(run.verdict || '').toLowerCase()] || String(run.verdict || 'recorded no verdict').toLowerCase();
  const sure = run => String(run.confidence || 'unrecorded').toLowerCase();
  if (!r.b) return `<p class="rp-v-decide rp-seps"><span>One run ${esc(said(r.a))}</span><span>${esc(sure(r.a))} confidence</span></p>`;
  const verdict = said(r.a) === said(r.b)
    ? `<span>Both runs ${esc(said(r.a))}</span>`
    : `<span class="rp-run-a">Run A ${esc(said(r.a))}</span><span class="rp-run-b">run B ${esc(said(r.b))}</span>`;
  const confidence = sure(r.a) === sure(r.b)
    ? `<span>${esc(sure(r.a))} confidence</span>`
    : `<span>Confidence: <span class="rp-run-a">run A ${esc(sure(r.a))}</span>, <span class="rp-run-b">run B ${esc(sure(r.b))}</span></span>`;
  return `<p class="rp-v-decide rp-seps">${verdict}${confidence}</p>`;
}

function rpMoreHTML(e, full) {
  const column = (key, title, items, count) => {
    if (full && !items.length) return '';
    const list = full
      ? items.map(text => `<li>${esc(text)}</li>`).join('')
      : Array.from({ length: Math.max(1, num(count) || 3) }, () => '<li class="rp-wait" aria-hidden="true"><span class="skeleton-line"></span></li>').join('');
    return `<section class="rp-more-col rp-more-${key}"><h3 class="rp-label">${title}</h3><ul class="rp-list" role="list">${list}</ul></section>`;
  };
  const uses = full && Array.isArray(full.useCases) ? full.useCases.filter(Boolean) : [];
  const limits = full && Array.isArray(full.limitations) ? full.limitations.filter(Boolean) : [];
  const html = column('try', 'Try it for', uses, e.useCaseCount) + column('limits', 'Know the limits', limits, e.limitationCount);
  return `<div class="rp-more"${html ? '' : ' hidden'}>${html}</div>`;
}

/* ---- the rail: reading progress and the contents --------------------------- */
function rpTocItems(e, sections, hasNext) {
  const items = [{ t: 'verdict', label: 'The verdict' }]
    .concat(sections.filter(Boolean).map((s, i) => ({ t: `section-${s.id}`, n: rpNum(i + 1), label: s.title || '' })))
    .concat([{ t: 'ratings', label: 'Ratings' }, { t: 'sources', label: 'Sources' }])
    .concat(hasNext ? [{ t: 'next', label: 'Next on the plate' }] : []);
  return items.map(it => `<li${it.n ? '' : ' class="rp-toc-x"'}><a href="${esc(reportURL(e.id, it.t))}" data-target="${esc(it.t)}">${it.n ? `<span class="rp-toc-n">${it.n}</span> ` : ''}<span class="rp-toc-t">${esc(it.label)}</span></a></li>`).join('');
}

/* The time still ahead of the reader, under the percentage. The engine counts a report as in
   progress below 97% (inProgress); past that the reader has reached the end, and "1 min left"
   under "100% read" would contradict the ring. */
function rpLeft(e) {
  const r = record(e.id);
  const all = num(e.readMinutes) || 0;
  if (r.read) return 'Marked as read';
  if (r.progress >= 97) return 'Reached the end';
  return r.progress >= 5 ? `${fmtInt(minutesLeft(e))} min left` : `${fmtInt(all)} min in all`;
}

function rpRailHTML(e, sections, hasNext) {
  const p = record(e.id).progress;
  return `<div class="rp-rail"><div class="rp-rail-in">
<div class="rp-prog">
<span id="report-progress" class="rp-ring" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-valuetext="${p}% read" style="--p:${p}%"></span>
<span class="rp-prog-text"><span id="progress-label" class="rp-prog-label" aria-hidden="true">${p}% read</span><span class="rp-prog-sub" aria-hidden="true">${esc(rpLeft(e))}</span></span>
<button type="button" class="rp-resume" data-action="resume" data-id="${esc(e.id)}" hidden>Resume reading</button>
</div>
<nav class="rp-toc" aria-label="Contents">
<p class="rp-label rp-toc-h" aria-hidden="true">Contents</p>
<ol role="list">${rpTocItems(e, sections, hasNext)}</ol>
</nav>
</div></div>`;
}

/* ---- the prose -------------------------------------------------------------- */
/* Each section is sanitised once; its links name the sources it rests on. */
function rpCitations(full) {
  const sources = Array.isArray(full.sources) ? full.sources : [];
  const index = new Map();
  sources.forEach((s, i) => { const k = rpURLKey(s && s.url); if (k && !index.has(k)) index.set(k, i); });
  const bySource = new Map();
  const tpl = document.createElement('template');
  const sections = (Array.isArray(full.sections) ? full.sections : []).filter(Boolean).map((s, i) => {
    const html = sanitize(s.html);
    tpl.innerHTML = html;
    const cited = [];
    for (const a of tpl.content.querySelectorAll('a[href]')) {
      const n = index.get(rpURLKey(a.getAttribute('href')));
      if (n === undefined || cited.includes(n)) continue;
      cited.push(n);
      if (!bySource.has(n)) bySource.set(n, []);
      bySource.get(n).push(i);
    }
    return { s, html, cited };
  });
  return { sections, bySource };
}

const rpSecHead = (s, i) => `<h2 class="rp-h2"><span class="rp-h2-n">${rpNum(i + 1)}</span> <span class="rp-h2-t">${esc(s.title || '')}</span></h2>`;

function rpBodyHTML(e, full, cite) {
  if (!full) {
    const sections = Array.isArray(e.sections) ? e.sections.filter(Boolean) : [];
    const waiting = n => `<div class="rp-prose rp-wait" aria-hidden="true">${rpLines(n)}</div>`;
    return (sections.map((s, i) => `<section class="rp-sec" id="section-${esc(s.id)}">${rpSecHead(s, i)}${waiting(i ? 4 : 7)}</section>`).join('') || waiting(7)) +
      '<p class="sr-only">Loading the report.</p>';
  }
  const c = cite || rpCitations(full);
  if (!c.sections.length) return '<p class="rp-prose">This report has no body text in this edition.</p>';
  return c.sections.map(({ s, html, cited }, i) =>
    `<section class="rp-sec" id="section-${esc(s.id)}">${rpSecHead(s, i)}<div class="rp-prose">${html}</div>${cited.length ? rpCitedHTML(full, cited) : ''}</section>`).join('');
}

function rpCitedHTML(full, list) {
  return `<div class="rp-cited" data-progress-ignore><p class="rp-label">Cited here</p><ol class="rp-cited-list" role="list">${list.map(n => {
    const s = full.sources[n] || {};
    const host = hostOf(s.url);
    return `<li><a href="${esc(reportURL(full.id, rpSrcAnchor(s, n)))}" data-cite="${esc(rpURLKey(s.url))}"><span class="rp-cited-n">${rpNum(n + 1)}</span> <span class="rp-cited-t">${esc(s.title || host || s.id || 'Source')}</span></a>${host ? `<span class="rp-cited-host">${esc(host)}</span>` : ''}</li>`;
  }).join('')}</ol></div>`;
}

/* After the prose is in the page: name every table after its place, say which links open
   a new tab, and set the end mark after the last word. */
function rpPolish(body, split) {
  if (!body) return;
  $$('.table-wrap', body).forEach((wrap, i) => {
    const title = $('.rp-h2-t', wrap.closest('.rp-sec') || body);
    wrap.setAttribute('aria-label', `Table ${i + 1}${title ? `, in “${title.textContent.trim()}”` : ''}. Scrolls sideways when it is wider than the column.`);
  });
  const cited = new Set($$('.rp-cited a[data-cite]', body).map(a => a.dataset.cite));
  for (const a of $$('.rp-prose a[target="_blank"]', body)) {
    if (!a.querySelector('.sr-only')) a.insertAdjacentHTML('beforeend', '<span class="sr-only"> (opens in a new tab)</span>');
    const key = rpURLKey(a.getAttribute('href'));
    if (cited.has(key)) a.dataset.cite = key;
  }
  /* A paragraph or item that is little more than one link ("Sources: <title>.") is a line of
     reference, not running text: on touch its link takes a 44 px target (.rp-linkline). */
  const chars = el => el.textContent.replace(/\s+/g, ' ').trim().length;
  for (const block of $$('.rp-prose :is(p, li)', body)) {
    const links = $$('a[href]', block);
    if (links.length === 1 && chars(block) - chars(links[0]) < 12) { block.classList.add('rp-refline'); links[0].classList.add('rp-linkline'); }
  }
  /* A source in the margin and the places that cite it light up together. */
  if (!body.dataset.citeWired) {
    body.dataset.citeWired = '1';
    const light = (event, on) => {
      const el = event.target instanceof Element ? event.target.closest('[data-cite]') : null;
      if (!el) return;
      const section = el.closest('.rp-sec') || body;
      for (const other of $$('[data-cite]', section)) if (other.dataset.cite === el.dataset.cite) other.classList.toggle('is-lit', on);
    };
    body.addEventListener('mouseover', event => light(event, true));
    body.addEventListener('mouseout', event => light(event, false));
    body.addEventListener('focusin', event => light(event, true));
    body.addEventListener('focusout', event => light(event, false));
  }
  const last = $$('.rp-prose > p', body).pop();
  if (last && !last.querySelector('.rp-endmark')) last.insertAdjacentHTML('beforeend', ` ${rpEndmark(split)}`);
}

/* ---- the ratings ------------------------------------------------------------ */
/* A 1–10 scale per dimension. Run A's caret sits above it, run B's below; where the two
   gave the same score the carets meet in one ink mark. A small ring marks the published
   mean when they differ. Coordinates are percentages, so the scale reflows without
   stretching its marks. */
function rpTrack(d) {
  const x = v => `${(((clamp(Number(v), 1, 10) - 1) / 9) * 100).toFixed(2)}%`;
  const Y = 24;
  const a = rpHas(d.a) ? Number(d.a) : null;
  const b = rpHas(d.b) ? Number(d.b) : null;
  const label = a === null && b === null ? `${d.label}: not rated`
    : b === null ? `${d.label}: ${a} out of 10, one recorded run`
    : a === null ? `${d.label}: ${b} out of 10, one recorded run`
    : a === b ? `${d.label}: both runs ${a} out of 10`
    : `${d.label}: run A ${a}, run B ${b}, out of 10`;
  let svg = `<svg class="rp-track" width="100%" height="64" role="img" aria-label="${esc(label)}" focusable="false">`;
  svg += `<line class="rp-track-base" x1="0" x2="100%" y1="${Y}" y2="${Y}"/>`;
  for (let v = 1; v <= 10; v++) {
    svg += `<line class="rp-track-tick" x1="${x(v)}" x2="${x(v)}" y1="${Y - (v === 5 || v === 10 || v === 1 ? 4 : 2.5)}" y2="${Y + (v === 5 || v === 10 || v === 1 ? 4 : 2.5)}"/>`;
    svg += `<text class="rp-track-num" x="${x(v)}" y="${Y + 36}" text-anchor="middle">${v}</text>`;
  }
  /* --rp-to: the distance from a caret to the published mean, as a fraction of the scale. Before
     a split dimension parts (rpPart), both carets stand there as one ink mark. */
  const caret = (kind, v, to) => `<svg class="rp-caret rp-caret-${kind}" x="${x(v)}" y="${Y}" overflow="visible"><path d="${RP_CARET[kind]}"${to === undefined ? '' : ` style="--rp-to:${to.toFixed(4)}"`}/></svg>`;
  if (a !== null && b !== null && a === b) svg += caret('ab', a);
  else if (a !== null && b !== null) {
    const mean = rpHas(d.mean) ? clamp(Number(d.mean), 1, 10) : (a + b) / 2;
    const to = v => (mean - clamp(v, 1, 10)) / 9;
    svg += `<circle class="rp-track-mean" cx="${x(mean)}" cy="${Y}" r="3.25"/>`;
    svg += caret('a', a, to(a)) + caret('b', b, to(b));
  } else if (a !== null || b !== null) svg += caret('ab', a !== null ? a : b);
  return `${svg}</svg>`;
}

function rpDimHTML(d, r, full) {
  const split = rpHas(d.a) && rpHas(d.b) && Number(d.a) !== Number(d.b);
  const show = v => (rpHas(v) ? esc(String(v)) : '–');
  const ab = r.both
    ? `<span class="rp-ab-a">A ${show(d.a)}</span><span class="rp-sep">·</span><span class="rp-ab-b">B ${show(d.b)}</span>`
    : `<span>${esc(agreementSentence({}))}</span>`;
  let why = '';
  if (full) {
    const ra = r.a && r.a.rationale ? r.a.rationale[d.key] : '';
    const rb = r.b && r.b.rationale ? r.b.rationale[d.key] : '';
    if (ra || rb) {
      const summary = !(ra && rb) ? 'The run’s reasoning'
        : split ? `Why run A gave ${show(d.a)} and run B gave ${show(d.b)}`
        : `Why both runs gave ${show(d.a)}`;
      const col = (k, name, text) => (text ? `<div class="rp-why-run rp-why-${k}"><p class="rp-label">${rpKeyGlyph(k)}${name}</p><p>${esc(text)}</p></div>` : '');
      why = `<details class="rp-why"${split ? ' open' : ''}><summary>${esc(summary)}</summary><div class="rp-why-cols">${col('a', 'Run A', ra)}${col('b', 'Run B', rb)}</div></details>`;
    }
  } else why = '<div class="rp-why-wait" aria-hidden="true"><span class="skeleton-line short"></span></div>';
  return `<li class="rp-dim${split ? ' is-split' : ''}" data-dim="${esc(d.key)}">
<div class="rp-dim-name"><h3>${esc(d.label)}</h3><p>${esc(d.text)}</p></div>
<div class="rp-dim-scale">${rpTrack(d)}</div>
<p class="rp-dim-score"><span class="sr-only">Mean </span><span class="rp-dim-mean">${esc(fmtScore(d.mean, '–'))}</span><span class="rp-dim-ab${split ? ' is-split' : ''}" aria-hidden="true">${ab}</span></p>
${why}
</li>`;
}

/* The key names only the marks this report draws: the parted carets and the mean where the runs
   split a dimension, the one ink mark where they agree. */
function rpRatingsHTML(e, full) {
  const r = runsOf(full || e);
  const both = r.dims.filter(d => rpHas(d.a) && rpHas(d.b));
  const split = both.some(d => Number(d.a) !== Number(d.b));
  const same = !r.both || both.some(d => Number(d.a) === Number(d.b));
  const key = (split ? [`${rpKeyGlyph('a')}Run A, above the scale`, `${rpKeyGlyph('b')}Run B, below it`] : [])
    .concat(same ? [`${rpKeyGlyph('ab')}${r.both ? 'Both runs, the same score' : 'The one recorded run'}`] : [])
    .concat(split ? [`${rpKeyGlyph('mean')}The published mean`] : []);
  return `<section class="rp-ratings" id="ratings">
<h2 class="rp-h2 rp-h2-plain"><span class="rp-h2-t">Ratings</span></h2>
<p class="rp-lede">Five dimensions, each scored from 1 to 10 by two runs of the same reviewer model. The published score of a dimension is the mean of the two; the overall score is the mean of the five.</p>
<p class="rp-key${split ? ' is-split' : ''}" aria-hidden="true">${key.map(k => `<span>${k}</span>`).join('')}</p>
<ol class="rp-dims" role="list">${r.dims.map(d => rpDimHTML(d, r, full)).join('')}</ol>
${full ? rpRunsHTML(full) : `<div class="rp-runs-wait rp-loading" aria-hidden="true">${rpLines(3)}</div>`}
<p class="rp-honesty rp-honesty-end">${esc(HONESTY)}</p>
</section>`;
}

/* The two runs' records. Their rules and names are ink: colour belongs to the marks, so only the
   caret glyph beside each name takes run A's or run B's colour, and only on a report whose runs
   split a dimension (.is-split). */
function rpRunsHTML(full) {
  const r = runsOf(full);
  const runs = [['a', 'Run A', r.a], ['b', 'Run B', r.b]].filter(x => x[2]);
  if (!runs.length) return '';
  const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
  const cards = runs.map(([k, name, run]) => {
    const concerns = Array.isArray(run.concerns) ? run.concerns.filter(Boolean) : [];
    const model = [run.model, run.effort ? `${run.effort} effort` : ''].filter(Boolean).join(', ');
    return `<div class="rp-run" data-run="${k}">
<h4 class="rp-run-h">${rpKeyGlyph(k)}${name}</h4>
<dl class="rp-run-dl">
${row('Verdict', esc(RP_VERDICT[String(run.verdict || '').toLowerCase()] || capitalise(run.verdict || 'Not recorded')))}
${row('Confidence', esc(capitalise(run.confidence || 'Not recorded')))}
${row('Model', esc(model || 'Not recorded'))}
${row('Reviewed', run.reviewedAt ? rpTime(run.reviewedAt, { time: true }) : 'Not established')}
</dl>
${concerns.length ? `<details class="rp-q"><summary>What this run flagged <span class="rp-count">(${concerns.length})</span></summary><ul role="list">${concerns.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
</div>`;
  }).join('');
  const keys = [['reportHash', 'Report'], ['evidenceHash', 'Evidence'], ['rubricHash', 'Rubric']];
  const same = runs.length === 2 && keys.every(([k]) => runs[0][2][k] === runs[1][2][k]) && runs[0][2].rubricVersion === runs[1][2].rubricVersion;
  const hashList = run => `<dl class="rp-hash-dl">${keys.filter(([k]) => run[k]).map(([k, label]) => `<div><dt>${label} SHA-256</dt><dd><code>${esc(run[k])}</code></dd></div>`).join('')}${run.rubricVersion ? `<div><dt>Rubric version</dt><dd><code>${esc(run.rubricVersion)}</code></dd></div>` : ''}</dl>`;
  const hashes = same
    ? `<p>Both runs read exactly the same files.</p>${hashList(runs[0][2])}`
    : runs.map(([k, name, run]) => `<p class="rp-label">${rpKeyGlyph(k)}${name}</p>${hashList(run)}`).join('');
  return `<h3 class="rp-h3">The two runs</h3>
<div class="rp-runs${r.differing ? ' is-split' : ''}">${cards}</div>
<details class="rp-hash"><summary>Content verification</summary><div class="rp-hash-body"><p>Each approval is tied to the exact report, evidence and rubric the run read.</p>${hashes}</div></details>`;
}

/* ---- the bibliography ---------------------------------------------------------- */
/* Each source is a catalogue card: its title (the way out), its host, the two things the report
   rests on it for, set as labelled serif lines (what it supports, and where in it), and one line
   of instrument annotation that says the rest in order: when it was published (or that the date
   is unknown, in two words, never a sentence), when it was read, the sections that cite it, and
   its record in the catalogue. */
function rpSourcesHTML(e, full, cite) {
  const head = '<h2 class="rp-h2 rp-h2-plain"><span class="rp-h2-t">Sources</span></h2>';
  if (!full) {
    const n = Math.max(1, num(e.sourceCount) || 3);
    return `<section class="rp-sources" id="sources">${head}<ol class="rp-bib rp-loading" role="list" aria-hidden="true">${Array.from({ length: n }, () => `<li class="rp-bib-item">${rpLines(2)}</li>`).join('')}</ol></section>`;
  }
  const c = cite || rpCitations(full);
  const list = Array.isArray(full.sources) ? full.sources : [];
  /* A source read in the year the report was found keeps its date short ("26 Oct"). */
  const year = value => isoDate(value).slice(0, 4);
  const items = list.map((s, n) => {
    if (!s) return '';
    const host = hostOf(s.url);
    const cited = (c.bySource.get(n) || []).map(i => {
      const sec = c.sections[i] && c.sections[i].s;
      return sec ? `<a href="${esc(reportURL(full.id, `section-${sec.id}`))}">${rpNum(i + 1)}<span class="sr-only">: ${esc(sec.title || '')}</span></a>` : '';
    }).filter(Boolean);
    /* The references travel as one group, so a narrow card breaks the line between the dates
       and the references, never inside either. */
    const refs = [
      cited.length ? `<span class="rp-bib-in">Cited in ${cited.join(' ')}</span>` : '',
      /* The same source in the catalogue (#sources/<id>): its record, status and every check. */
      s.id ? `<span><a class="rp-bib-rec" href="#sources/${esc(encodeURIComponent(s.id))}" data-back="${esc(rpSrcAnchor(s, n))}">In the catalogue<span class="sr-only">: ${esc(s.title || host || s.id)}</span></a></span>` : ''
    ].filter(Boolean);
    const notes = [
      isoDate(s.publishedAt) ? `<span>Published ${rpTime(s.publishedAt)}</span>` : '<span>Date unknown</span>',
      isoDate(s.accessedAt) ? `<span>Accessed ${rpTime(s.accessedAt, { short: year(s.accessedAt) === year(full.discoveredAt || e.discoveredAt) })}</span>` : '',
      refs.length ? `<span class="rp-bib-refs">${refs.join('')}</span>` : ''
    ].filter(Boolean);
    const line = (cls, key, text) => (text ? `<p class="${cls}"><span class="rp-k">${key}</span> <span class="rp-bib-v">${esc(text)}</span></p>` : '');
    return `<li class="rp-bib-item" id="${esc(rpSrcAnchor(s, n))}">
<span class="rp-bib-n">${rpNum(n + 1)}</span>
<div class="rp-bib-main">
<p class="rp-bib-title">${external(s.url, s.title || host || s.id || 'Source')}</p>
${host ? `<p class="rp-bib-host">${esc(host)}</p>` : ''}
${line('rp-bib-sup', 'Supports', s.supports)}${line('rp-bib-loc', 'Where', s.locator)}
<p class="rp-bib-when rp-seps">${notes.join('')}</p>
</div>
</li>`;
  }).join('');
  const note = full.researchNote ? `<div class="rp-note"><p class="rp-label">Research note</p><p>${esc(full.researchNote)}</p></div>` : '';
  return `<section class="rp-sources" id="sources">${head}${note}${items ? `<ol class="rp-bib" role="list">${items}</ol>` : '<p class="rp-lede">No sources are recorded for this report.</p>'}</section>`;
}

/* ---- next on the plate: the two trails that began closest in time -----------------
   The report ends where the library begins, on the plate: a loupe of tonight's plate with this
   report's trail lit beside the two trails that began nearest it. Pointing at either card
   lights its trail; pointing at a trail on the plate names it, and selecting it opens it. */
function rpNearest(e) {
  const t0 = Date.parse(e.discoveredAt);
  return (state.entries || [])
    .map((x, i) => ({ x, i, d: Math.abs(Date.parse(x && x.discoveredAt) - t0) }))
    .filter(o => o.x && o.x.id !== e.id)
    .sort((a, b) => (Number.isFinite(a.d) ? a.d : Infinity) - (Number.isFinite(b.d) ? b.d : Infinity) || a.i - b.i)
    .slice(0, 2)
    .map(o => o.x);
}

function rpWhen(x, e) {
  const a = isoDate(x.discoveredAt), b = isoDate(e.discoveredAt);
  if (!a || !b) return `Found ${fmtDate(x.discoveredAt)}`;
  const days = Math.round((Date.parse(a) - Date.parse(b)) / DAY_MS);
  if (!days) return 'Found the same day';
  return `Found ${plural(Math.abs(days), 'day')} ${days < 0 ? 'earlier' : 'later'}`;
}

function rpNextHTML(e, list) {
  if (!list.length) return '';
  return `<nav class="rp-next" id="next" aria-labelledby="rp-next-h">
<div class="rp-next-head">
<h2 class="rp-h2 rp-h2-plain" id="rp-next-h"><span class="rp-h2-t">Next on the plate</span></h2>
<div class="rp-next-done"><p class="rp-label">Finished this one?</p>${rpToggle('read', e)}</div>
</div>
<div class="rp-next-body">
${typeof plateLoupeHTML === 'function' ? plateLoupeHTML('Tonight’s plate') : ''}
<ul class="rp-next-list" role="list">${list.map(x => {
    const r = runsOf(x);
    return `<li class="rp-next-item" data-next-id="${esc(x.id)}">
<p class="rp-next-when rp-seps"><span>${esc(rpWhen(x, e))}</span>${x.category ? `<span>${esc(x.category)}</span>` : ''}</p>
<h3 class="rp-next-title"><a class="rp-next-link" href="${esc(reportURL(x.id))}">${esc(x.title || x.id)}</a></h3>
<div class="rp-next-read">${spectrum(x, { size: 'lead' })}<p class="rp-next-num">${esc(fmtScore(x.score, '–'))}<span class="sr-only"> out of 10</span></p><p class="agreement${r.differing ? ' is-split' : ''}">${esc(agreementSentence(x))}</p></div>
</li>`;
  }).join('')}</ul>
</div>
</nav>`;
}

/* ---- behaviour ------------------------------------------------------------------ */
function rpWire(e) {
  const id = e.id;
  const view = rpView;
  view.paint = rpWatch();
  onLeave((prev, next) => {
    if (rpView === view) rpView = null;
    /* Back to the list: the title flies home to the entry or the row it came from, when that
       is on the screen the library returns to; otherwise the two pages simply cross-fade. */
    if (!isList(next.name)) return;
    const h1 = app.querySelector('.rp-title');
    if (h1) setTransitionNames(h1, () => rpHomeTitle(id));
  });
  /* Into the catalogue and back: the address first names this entry of the bibliography, so
     Back returns the reader to it rather than to the top of the report. */
  const article = app.querySelector('.rp');
  if (article) article.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a.rp-bib-rec[data-back]') : null;
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try { history.replaceState(history.state, '', reportURL(id, link.dataset.back)); } catch (_) { /* the link still works */ }
  });
  const list = app.querySelector('.rp-next-list');
  if (list) list.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a.rp-next-link') : null;
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setTransitionNames(link.closest('.rp-next-title'), '#app h1');
  });
  rpLoupe(id, list);
  /* Marking read (here, in the palette or in another tab) repaints the rail's readout. */
  const onReading = event => { const who = event.detail && event.detail.id; if ((!who || who === id) && view.paint) view.paint(true); };
  document.addEventListener('parallax:reading', onReading);
  onLeave(() => document.removeEventListener('parallax:reading', onReading));
}

/* The loupe at the end of the report (20-plate.js draws it; it is destroyed with the view).
   Forced colours do not draw canvases and 40-report.css takes the loupe out of the layout, so
   it is mounted only once there is a plate to draw: at once, or when forced colours end. */
function rpLoupe(id, list) {
  const root = app.querySelector('.rp-next [data-plate-loupe]');
  if (!root || !list || typeof mountPlate !== 'function') return;
  const cards = $$('.rp-next-item[data-next-id]', list);
  const forced = mq('(forced-colors: active)');
  let plate = null;
  const mount = () => {
    if (plate || forced.matches) return;
    plate = mountPlate(root, {
      mode: 'loupe',
      onOpen: to => { if (to) location.hash = reportURL(to); },
      onHover: to => { for (const li of cards) li.classList.toggle('is-lit', !!to && li.dataset.nextId === to); }
    });
    plate.highlight(id);
  };
  mount();
  const card = event => (event.target instanceof Element ? event.target.closest('.rp-next-item[data-next-id]') : null);
  const enter = event => { const li = card(event); if (li && plate) plate.highlight(li.dataset.nextId); };
  const leave = event => {
    const li = card(event);
    if (li && plate && !(event.relatedTarget instanceof Node && li.contains(event.relatedTarget))) plate.highlight(id);
  };
  list.addEventListener('pointerover', enter);
  list.addEventListener('pointerout', leave);
  list.addEventListener('focusin', enter);
  list.addEventListener('focusout', leave);
  if (typeof forced.addEventListener === 'function') forced.addEventListener('change', mount);
  onLeave(() => {
    if (typeof forced.removeEventListener === 'function') forced.removeEventListener('change', mount);
    if (plate) plate.destroy();
  });
}

/* Where the title lands on the way back: this report's "This edition" entry or its library
   row, whichever is inside the viewport the library is about to restore (the router scrolls
   to state.listScroll after the new view renders). A title that would fly off the screen
   is no shared element at all. */
function rpHomeTitle(id) {
  const key = cssEsc(id);
  const masthead = document.getElementById('masthead');
  const sticky = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-extra')) || 0;
  const top = (Number(state.listScroll) || 0) + (masthead ? masthead.getBoundingClientRect().height : 0) + sticky;
  const bottom = (Number(state.listScroll) || 0) + window.innerHeight;
  for (const el of [app.querySelector(`[data-lead-id="${key}"] .lib-lead-title`), app.querySelector(`[data-report-id="${key}"] .row-title`)]) {
    if (!el) continue;
    const box = el.getBoundingClientRect();
    if (!box.height) continue;
    const middle = box.top + window.scrollY + box.height / 2;
    if (middle > top && middle < bottom) return el;
  }
  return null;
}

/* The parallax, made literal. The first time the verdict's spectrum comes into view, every
   dimension the two runs scored differently starts as one stroke of ink, as if they had agreed,
   and then slides apart sideways into run A (cool) and run B (warm), dimension by dimension.
   Lines where the runs agree never move. The script only measures how far each half travels
   (--rp-fx, in the spectrum's own units) and swaps two classes; 40-report.css does the motion
   with transitions. Without motion, or without an observer, the marks are simply where they end.

   The one rule the motion may never break: a split verdict is not shown fused for more than
   about a second while any of it is on screen. Half of the band in view parts it at once; the
   first glimpse of it lights a short fuse that parts it wherever it sits (a band low on a tall
   screen never reaches half), and a late parting starts moving at once (.is-late). The fuse is
   short because the glimpse itself can come late: the web fonts and the report's text arrive
   after the page opens and move the band, and a slow machine delays the observer, so a long
   fuse could still leave a band fused on screen past the second. The 0 in the thresholds is
   what reports that first glimpse: an observer told only of 0.5 stays silent when the band
   slides a few pixels into view and never crosses half. */
const RP_FUSE_MS = 320;
/* No motion to stage: the reader asked for less motion, or forced colours draw every mark
   parted, in system ink (40-report.css gates the staged states on both). */
const rpStill = () => motionReduced() || mq('(forced-colors: active)').matches;

/* The report's own exposure. When the page opens with the header's print on screen, the
   report's trail draws itself on it, from the night the report was found to tonight's meridian,
   as the plate's exposure does on the library; its head lights last. Only the lit trail moves
   (the faint ones are already on the plate). The first measurement decides: a print that opens
   off screen (a phone's, below the verdict) is simply exposed, so no print is ever left on the
   page without the trail it is there to show. Without motion the print is simply exposed. */
function rpExpose() {
  const svg = app.querySelector('.rp-dial .dial');
  if (!svg || rpStill() || typeof IntersectionObserver !== 'function') return;
  const lit = $$('.dial-a, .dial-b, .dial-hit', svg);
  if (!lit.length) return;
  for (const path of lit) path.setAttribute('pathLength', '1');
  svg.classList.add('is-unexposed');
  const io = new IntersectionObserver(items => {
    io.disconnect();
    if (items.some(item => item.isIntersecting)) svg.classList.replace('is-unexposed', 'is-exposing');
    else svg.classList.remove('is-unexposed');
  }, { threshold: 0 });
  io.observe(svg);
  onLeave(() => io.disconnect());
}

/* The order in which split marks part: left to right, counting only the marks that split, so a
   report that differs on one late dimension does not wait through the agreeing ones. */
function rpStagger(lines, at) {
  const order = [...new Set(lines.map(at))].sort((a, b) => a - b);
  return i => Math.max(0, order.indexOf(i));
}

function rpParallax() {
  const band = app.querySelector('.rp-v-spec');
  if (!band || rpStill() || typeof IntersectionObserver !== 'function') return;
  let halves = 0;
  for (const svg of $$('svg.spec', band)) {
    const step = ((svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) || 0) / 5;
    if (!step) continue;
    const lines = $$('line.spec-a, line.spec-b', svg);
    const at = line => clamp(Math.floor(Number(line.getAttribute('x1')) / step), 0, 4);
    const nth = rpStagger(lines, at);
    for (const line of lines) {
      const i = at(line);
      line.style.setProperty('--rp-fx', `${(step * i + step / 2 - Number(line.getAttribute('x1'))).toFixed(2)}px`);
      line.style.setProperty('--rp-i', String(nth(i)));
      halves++;
    }
  }
  if (!halves) return;
  band.classList.add('is-fused');
  let timer = 0;
  let io = null;
  const stop = () => { clearTimeout(timer); timer = 0; if (io) io.disconnect(); };
  const part = late => {
    stop();
    if (!band.classList.contains('is-fused')) return;
    band.classList.toggle('is-late', late);
    band.classList.replace('is-fused', 'is-parting');
  };
  io = new IntersectionObserver(items => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      if (item.intersectionRatio >= 0.499) { part(false); return; }
      if (!timer) timer = setTimeout(() => part(true), RP_FUSE_MS);
    }
  }, { threshold: [0, 0.5] });
  io.observe(band);
  onLeave(stop);
}

/* The same parting, smaller and faster, on the ratings' scales: where the runs differ, the two
   carets start together on the published mean, in ink, and part to their own scores as each
   scale comes into view, under the verdict's rule (nine tenths in view, or the short fuse from
   the first glimpse). Called again when the full file replaces the ratings: the old watch and
   its fuses stop first, and a dimension that has already parted stays parted. */
function rpPart() {
  const view = rpView;
  if (!view) return;
  if (view.partStop) { view.partStop(); view.partStop = null; }
  if (rpStill() || typeof IntersectionObserver !== 'function') return;
  const parted = view.parted || (view.parted = new Set());
  const scales = $$('.rp-dim.is-split', app).filter(li => !parted.has(li.dataset.dim)).map(li => $('.rp-dim-scale', li)).filter(Boolean);
  if (!scales.length) return;
  for (const scale of scales) scale.classList.add('is-fused');
  const fuses = new Map();
  let io = null;
  const part = (scale, wait) => {
    clearTimeout(fuses.get(scale));
    fuses.delete(scale);
    if (io) io.unobserve(scale);
    if (!scale.classList.contains('is-fused')) return;
    const dim = scale.closest('.rp-dim');
    if (dim) parted.add(dim.dataset.dim);
    scale.style.setProperty('--rp-wait', `${wait}ms`);
    scale.classList.replace('is-fused', 'is-parting');
  };
  io = new IntersectionObserver(items => {
    let k = 0;
    for (const item of items) {
      if (!item.isIntersecting) continue;
      const scale = item.target;
      if (item.intersectionRatio >= 0.899) part(scale, 90 + 70 * k++);
      else if (!fuses.has(scale)) fuses.set(scale, setTimeout(() => part(scale, 0), RP_FUSE_MS));
    }
  }, { threshold: [0, 0.9] });
  for (const scale of scales) io.observe(scale);
  const stop = () => { for (const t of fuses.values()) clearTimeout(t); fuses.clear(); if (io) io.disconnect(); };
  view.partStop = stop;
  onLeave(stop);
}

/* The contents follow the reader: the section under the reading line is aria-current,
   the ones above it are drawn as the trail behind it. */
function rpWatch() {
  let last = '';
  const view = rpView;
  /* "Resume reading" is for a reader who is above the place they reached; once that
     place is on screen (or behind them) the button steps aside. */
  const resume = () => {
    const button = app.querySelector('.rp-resume');
    const blocks = view && view.blocks;
    if (!button || !blocks || !blocks.length) return;
    const target = blocks[clamp(Math.floor((record(view.id).progress / 100) * blocks.length), 0, blocks.length - 1)];
    button.classList.toggle('is-here', !!target && target.isConnected && target.getBoundingClientRect().top < innerHeight);
  };
  const left = () => {
    const sub = app.querySelector('.rp-prog-sub');
    const entry = view && state.byId.get(view.id);
    if (!sub || !entry) return;
    const text = rpLeft(entry);
    if (sub.textContent !== text) sub.textContent = text;
  };
  const paint = force => {
    resume();
    left();
    const links = $$('.rp-toc a[data-target]', app);
    if (!links.length) return;
    const masthead = document.getElementById('masthead');
    const line = (masthead ? Math.max(0, masthead.getBoundingClientRect().bottom) : 0) + Math.min(innerHeight * 0.3, 240);
    let current = -1;
    links.forEach((a, i) => {
      const target = document.getElementById(a.dataset.target);
      if (target && target.getBoundingClientRect().top <= line) current = i;
    });
    if (current >= 0 && Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2) current = links.length - 1;
    const key = `${current}/${links.length}`;
    if (key === last && !force) return;
    last = key;
    links.forEach((a, i) => {
      if (i === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      a.parentElement.classList.toggle('is-passed', current > 0 && i < current);
      a.parentElement.classList.toggle('is-current', i === current);
    });
    rpKeepInView(links[current]);
  };
  onScroll(() => paint(false));
  requestAnimationFrame(() => paint(true));
  const onResize = debounce(() => paint(true), 120);
  window.addEventListener('resize', onResize, { passive: true });
  /* The engine announces every repaint of the reading progress ('parallax:progress'); the
     "N min left" readout and the resume button follow it. */
  const onProgress = event => { const who = event.detail && event.detail.id; if (!who || (view && who === view.id)) { left(); resume(); } };
  document.addEventListener('parallax:progress', onProgress);
  onLeave(() => { window.removeEventListener('resize', onResize); onResize.cancel(); document.removeEventListener('parallax:progress', onProgress); });
  return paint;
}

/* A long contents list scrolls inside the sticky rail; keep the current entry in sight. */
function rpKeepInView(link) {
  const box = link && link.closest('.rp-rail-in');
  if (!box || box.scrollHeight <= box.clientHeight + 1 || getComputedStyle(box).overflowY === 'visible') return;
  const r = link.getBoundingClientRect(), b = box.getBoundingClientRect(), pad = 56;
  if (r.top < b.top + pad) box.scrollTop -= b.top + pad - r.top;
  else if (r.bottom > b.bottom - pad) box.scrollTop += r.bottom - (b.bottom - pad);
}


/* ===== 50-pages.js ===== */
/* =============================================================================
   50 · PAGES — everything around the library and the report:
     renderSources   #sources[/<id>]    the catalogue: its sources dispersed into a spectrum,
                                        then every record, one line each, watched first
     renderAccounts  #accounts[/<id>]   the people and teams we watch
     renderEditions  #editions[/<id>]   the logbook: a contact sheet of the exposure, frame by
                                        frame, then one entry per scan
     renderMethod    #method[/<id>]     how the instrument works
     renderSettings  #settings[/<id>]   observing conditions
   and the two decoration hooks the engine looks for:
     paletteOptionExtra(item)           a report's spectrum and score beside its title
     queueProgressHTML(entry, record)   reading progress as a short trail of light
   Each page composes its own opening for its own content; none borrows the hero's gestures
   (no italic second half in a page title, no row of light numerals). The plate's grammar
   runs through all of them: the logbook is the exposure frame by frame (plateFrame), the
   catalogue opens on its sources dispersed like light, and every report listed outside the
   library carries its spectrum.
   Every other top-level name in this fragment starts with pg / PG, so it cannot collide
   with another fragment. Shell styling (masthead, colophon, dialogs) is in 50-pages.css.
   ============================================================================= */

const PG_PAGE = 100;
const PG = {
  src: { page: 1, open: new Set(), pin: '', want: '', key: '', list: [], numbers: null, width: 4, note: '' },
  acc: { page: 1, open: new Set(), pin: '', want: '', key: '', list: [], numbers: null, width: 3, note: '', ranks: null },
  tokens: null
};
const pgAnnounce = debounce(text => announce(text), 700);

/* ------------------------------------------------------------- shared pieces */
const pgSep = '<span class="pg-sep" aria-hidden="true">·</span>';
const pgWords = value => String(value ?? '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
const pgLabel = value => { const w = pgWords(value); return w ? capitalise(w) : 'Not recorded'; };
const pgPad = (n, width) => String(n).padStart(width, '0');
const pgGlyph = shape => `<span class="pg-glyph pg-glyph--${shape}" aria-hidden="true"></span>`;
/* A status that is not the ordinary one: its shape alone, named for assistive technology. */
const pgMark = (shape, label) => `<span class="pg-mark" title="${esc(label)}">${pgGlyph(shape)}<span class="sr-only">${esc(label)}</span></span>`;
const pgTime = value => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : NaN; };
/* A line of instrument annotation (trusted HTML items). Every item keeps together; the
   stylesheet draws the separators and cuts off one that would open a line, so no line ends
   or begins on "·" and no date splits. */
const pgMeta = (items, cls = '') => `<p class="pg-meta${cls ? ` ${cls}` : ''}">${items.filter(Boolean).map(i => `<span>${i}</span>`).join('')}</p>`;
const pgEyebrow = parts => pgMeta(parts.filter(Boolean).map(p => esc(p)), 'pg-eyebrow');

/* An address as a reader recognises it: host and path, no scheme, no "www.", no trailing slash. */
function pgShortURL(value) {
  const href = safeURL(value);
  if (!href) return String(value ?? '');
  try {
    const u = new URL(href);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch (_) { return href; }
}
/* A name that opens the publisher's own page. The new tab is said to assistive technology on
   every link; the arrow is drawn once, where the list explains its links, not after every name. */
function pgOut(url, text) {
  const href = safeURL(url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="sr-only"> (opens in a new tab)</span></a>` : esc(text);
}
/* A page's opening: the mono eyebrow, the display title, a lede; an instrument beside them on
   wide screens (aside); and below, the composition this page opens on (after). */
function pgHead({ kind, eyebrow, title, lede = '', aside = '', asideId = '', after = '' }) {
  return `<header class="pg-head pg-head--${kind}">
${eyebrow}
<div class="pg-head-main"><h1 class="pg-title">${title}</h1>${lede ? `<div class="pg-lede">${lede}</div>` : ''}</div>
${aside || asideId ? `<div class="pg-head-aside"${asideId ? ` id="${asideId}"` : ''}>${aside}</div>` : ''}
${after}
</header>`;
}
/* Ghost lines while a file arrives: the catalogue's shape, nothing to read. */
function pgGhosts(n) {
  return `<ol class="pg-lines pg-lines--ghost" role="list" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<li class="pg-ghost"><span class="skeleton-line pg-ghost-no"></span><span class="skeleton-line${i % 3 === 2 ? ' short' : ''}"></span><span class="skeleton-line pg-ghost-meta"></span></li>`).join('')}</ol>`;
}
/* How a list is cut into pages: [start, end) ranges. A grouped list is cut at its group
   boundaries (whole kinds, whole platforms) up to PG_GROUPED a page, and a group larger than
   that is split into equal parts, so no page ends a few lines into the next group or leaves
   a short remnant; an ungrouped list (a search) is cut every PG_PAGE. */
const PG_GROUPED = 240;
function pgPlan(list, groupOf) {
  const pages = [];
  if (!groupOf) { for (let i = 0; i < list.length; i += PG_PAGE) pages.push([i, Math.min(list.length, i + PG_PAGE)]); }
  else {
    let cur = null;
    for (let i = 0; i < list.length;) {
      const g = groupOf(list[i]);
      let j = i + 1;
      while (j < list.length && groupOf(list[j]) === g) j++;
      const n = j - i;
      if (n > PG_GROUPED) {
        if (cur) { pages.push(cur); cur = null; }
        const size = Math.ceil(n / Math.ceil(n / PG_GROUPED));
        for (let x = i; x < j; x += size) pages.push([x, Math.min(j, x + size)]);
      } else {
        if (cur && cur[1] - cur[0] + n > PG_GROUPED) { pages.push(cur); cur = null; }
        cur = cur ? [cur[0], j] : [i, j];
      }
      i = j;
    }
    if (cur) pages.push(cur);
  }
  return pages.length ? pages : [[0, 0]];
}
const pgPageOf = (plan, at) => Math.max(1, plan.findIndex(([a, b]) => at >= a && at < b) + 1);
/* Pages of a catalogue: previous / numbered / next, all buttons (no history entries). */
function pgPager(list, page, plan, total, noun) {
  const pages = plan.length;
  if (pages <= 1) return '';
  const from = plan[page - 1][0] + 1, to = plan[page - 1][1];
  const nums = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
  let items = '', last = 0;
  for (const p of nums) {
    if (p - last > 1) items += '<li class="pg-pager-gap" aria-hidden="true">…</li>';
    items += `<li><button type="button" class="pg-pager-num" data-action="pg-page" data-list="${list}" data-page="${p}" aria-label="Page ${p}"${p === page ? ' aria-current="page"' : ''}>${p}</button></li>`;
    last = p;
  }
  return `<nav class="pg-pager" aria-label="Pages of the ${noun}">
<button type="button" class="pg-pager-step" data-action="pg-page" data-list="${list}" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}><span aria-hidden="true">‹ </span>Previous<span class="sr-only"> page</span></button>
<p class="pg-pager-at">${esc(`${fmtInt(from)}–${fmtInt(to)} of ${fmtInt(total)}`)}<span class="pg-pager-of">${esc(`page ${page} of ${pages}`)}</span></p>
<ol class="pg-pager-nums" role="list">${items}</ol>
<button type="button" class="pg-pager-step" data-action="pg-page" data-list="${list}" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Next<span class="sr-only"> page</span><span aria-hidden="true"> ›</span></button>
</nav>`;
}
/* Keep a sticky filter strip out of the way of anchors and focus (html scroll-padding). */
function pgStickyStrip(el) {
  if (!el) return;
  const root = document.documentElement;
  const measure = () => {
    if (!el.isConnected) return;
    const sticky = getComputedStyle(el).position === 'sticky';
    root.style.setProperty('--sticky-extra', sticky ? `${Math.round(el.getBoundingClientRect().height)}px` : '0px');
  };
  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(measure); ro.observe(el); }
  measure();
  onLeave(() => { if (ro) ro.disconnect(); root.style.removeProperty('--sticky-extra'); });
}
/* After the router has settled (it scrolls to the top and focuses the h1 first), bring an
   element into view under the sticky chrome, light it briefly, and optionally focus it: a
   selector inside it, or true for the element itself. Entering the view from another one
   (entering), the focus moves on only while it is still on the page's h1, where the router
   left it: the entry is what the reader came for, a first visit keeps the skip link first,
   and a reader who has already moved on keeps their place. */
const pgOnHeading = () => { const h1 = app.querySelector('h1'); return !!h1 && document.activeElement === h1; };
function pgReveal(elementId, { focus = null, scrollTo = '', entering = false } = {}) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(elementId);
    if (!el || !app.contains(el)) return;
    scrollToAnchor(scrollTo && document.getElementById(scrollTo) ? scrollTo : elementId, { focus: false });
    el.classList.remove('is-lit');
    void el.offsetWidth;
    el.classList.add('is-lit');
    setTimeout(() => el.classList.remove('is-lit'), 2400);
    if (!focus || (entering && !pgOnHeading())) return;
    const target = focus === true ? el : el.querySelector(focus);
    if (!target) return;
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }));
}
/* The moment the last scan began: a check older than that is worth a mention, a newer one is not. */
function pgLastScan() {
  const runs = state.runsLight && state.runsLight.length ? state.runsLight : (state.runs || []);
  const t = Math.max(-Infinity, ...runs.map(r => pgTime(r.startedAt || r.finishedAt)).filter(Number.isFinite));
  return Number.isFinite(t) ? t : NaN;
}
/* One catalogue line, for a record or an account: running number, name (the link out), host or
   handle, what is particular about it, a mark where its status is not the ordinary one, and
   the toggle that opens its notes and evidence beneath. */
function pgLineHTML({ kind, id, n, width, open, name, host, extra = '', strip = '', mark = '', toggle, more }) {
  return `<li class="pg-line pg-line--${kind}${open ? ' is-open' : ''}" id="${kind}-${esc(id)}" data-${kind}-id="${esc(id)}">
<span class="pg-line-no" aria-hidden="true">${esc(pgPad(n, width))}</span>
<span class="pg-line-name">${name}</span>
<span class="pg-line-host">${host}</span>
${extra ? `<span class="pg-line-extra">${extra}</span>` : ''}
${strip ? `<span class="pg-line-strip" aria-hidden="true">${strip}</span>` : ''}
<span class="pg-line-mark">${mark}</span>
${toggle}
<div class="pg-line-more" id="${kind}-more-${esc(id)}"${open ? '' : ' hidden'}>${open ? more() : ''}</div>
</li>`;
}

/* ==================================================================== SOURCES */
const PG_KINDS = ['official', 'research', 'repository', 'model_hub', 'newsletter', 'blog', 'news', 'community', 'social'];
const PG_KIND_MANY = { official: 'Official', research: 'Research', repository: 'Repositories', model_hub: 'Model hubs', newsletter: 'Newsletters', blog: 'Blogs', news: 'News', community: 'Communities', social: 'Social' };
const PG_KIND_ONE = { official: 'Official', research: 'Research', repository: 'Repository', model_hub: 'Model hub', newsletter: 'Newsletter', blog: 'Blog', news: 'News', community: 'Community', social: 'Social' };
const PG_SRC_STATUS = { active: ['Active', 'filled', 0], unverified: ['Unverified', 'ring', 1], blocked: ['Blocked', 'cross', 2], retired: ['Retired', 'cross', 3] };
const PG_SCOPES = [['', 'Watched'], ['evidence', 'Evidence pages'], ['all', 'Everything']];
const pgKindRank = kind => { const i = PG_KINDS.indexOf(kind); return i < 0 ? PG_KINDS.length : i; };
const pgKindName = (kind, many = true) => (many ? PG_KIND_MANY : PG_KIND_ONE)[kind] || pgLabel(kind);
const pgSrcStatus = status => PG_SRC_STATUS[status] || [pgLabel(status), 'ring', 4];
const pgInScope = (s, scope) => (scope === 'all' ? true : scope === 'evidence' ? !isMonitoring(s) : isMonitoring(s));
const pgScopeName = scope => (PG_SCOPES.find(([v]) => v === scope) || PG_SCOPES[0])[1];
const pgScopeNoun = scope => (scope === '' ? 'watched entrypoint' : scope === 'evidence' ? 'evidence page' : 'record');

function pgSourceStats() {
  const st = state.sourceStats || (state.sources ? sourceStatsOf(state.sources) : null) || { total: 0, monitored: 0, checked: 0, byKind: {}, byStatus: {} };
  const total = num(st.total) ?? 0, watched = num(st.monitored) ?? 0;
  return { total, watched, evidence: Math.max(0, total - watched), checked: num(st.checked) ?? 0, byKind: st.byKind || {}, byStatus: st.byStatus || {} };
}

/* ---- the spectrum of sources ----------------------------------------------
   The observatory's light, dispersed as a spectrograph disperses it: one 1 px line for every
   entrypoint it watches, grouped into bands by kind, each band about as wide as its share.
   Every line carries data:
   - where it stands is when its entrypoint joined the watch, on the plate's own axis (the
     first scan on a band's left, tonight on its right). The lines of one night stand a
     pixel apart, in the list's order, so each night that grew the watch is a cluster (75
     seeds on the first night, 216 social accounts in one) and every quiet stretch is dark;
   - how bright it burns is the evidence filed through it: the pages found through it, or
     else at an address under its own, log-scaled from .3 to 1, so the few entrypoints that
     lead to most of the evidence stand out like the strong lines of a spectrum;
   - an entrypoint that did not answer on the last scan is a gap, with a small ✕ above it.
   On the flat night ground of a print, in light alone: colour inside a data mark only ever
   means a run. Pointing at a line names its source beneath the band and lights its row (a
   tap does the same); the list below is the band's accessible equivalent, and the sentences
   beside the title say what it shows. Where a single band would be too narrow for a pixel a
   line, or for its names, it is cut into orders, one per kind, each named on its own order,
   as an echelle spectrograph cuts a spectrum. Until the ledger arrives the print is
   unexposed (the ground alone, at its size). */
const PG_BAND_GAP = 8;
const pgNormURL = value => {
  const href = safeURL(value);
  if (!href) return '';
  try {
    const u = new URL(href);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch (_) { return ''; }
};
/* Answered on the last scan: reached at or after the moment it began (12 h of grace). */
function pgAnswered(s, last) {
  const t = pgTime(s.lastSuccessAt);
  return Number.isFinite(t) && (!Number.isFinite(last) || t >= last - 432e5);
}
/* The band's data, once per ledger. An evidence page is filed under the watched entrypoint
   it was found through (discoveredFrom), or else under the watched address that contains its
   own (the longest one), so every page counts once. */
function pgBandData() {
  if (!state.sources) return null;
  if (PG.band && PG.band.of === state.sources) return PG.band;
  const ep = pgEpoch(), last = pgLastScan();
  const span = Math.max(1, ep.tNow - ep.t0);
  const watched = state.sources.filter(isMonitoring);
  const byId = new Map(watched.map(s => [s.id, s]));
  const byURL = new Map();
  for (const s of watched) { const k = pgNormURL(s.url); if (k && !byURL.has(k)) byURL.set(k, s); }
  const filed = new Map();
  for (const e of state.sources) {
    if (isMonitoring(e)) continue;
    let home = byId.get(e.discoveredFrom) || byURL.get(pgNormURL(e.discoveredFrom)) || null;
    for (let k = home ? '' : pgNormURL(e.url); k && !home; k = k.slice(0, Math.max(0, k.lastIndexOf('/')))) home = byURL.get(k) || null;
    if (home) filed.set(home.id, (filed.get(home.id) || 0) + 1);
  }
  const top = Math.max(1, ...filed.values());
  const kinds = new Map();
  let silent = 0;
  for (const s of watched) {
    const t = pgTime(s.discoveredAt);
    const n = filed.get(s.id) || 0;
    const lit = pgAnswered(s, last);
    if (!lit) silent++;
    const line = { s, n, lit, t, x: 0, f: Number.isFinite(t) ? clamp((t - ep.t0) / span, 0, 1) : 0, day: Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '', o: 0.3 + 0.7 * Math.log1p(n) / Math.log1p(top) };
    if (!kinds.has(s.kind)) kinds.set(s.kind, []);
    kinds.get(s.kind).push(line);
  }
  const st = pgSourceStats();
  const list = [...kinds].map(([kind, lines]) => {
    const nights = new Map();
    for (const l of lines) { if (!nights.has(l.day)) nights.set(l.day, []); nights.get(l.day).push(l); }
    const ordered = [...nights.values()].map(night => ({
      f: Math.min(...night.map(l => l.f)),
      lines: night.sort((a, b) => collator.compare(pgSourceName(a.s), pgSourceName(b.s)))
    })).sort((a, b) => a.f - b.f);
    return { kind, records: num(st.byKind[kind]) ?? lines.length, count: lines.length, silent: lines.filter(l => !l.lit).length, nights: ordered, lines: [] };
  }).sort((a, b) => pgKindRank(a.kind) - pgKindRank(b.kind) || collator.compare(a.kind, b.kind));
  PG.band = { of: state.sources, ep, kinds: list, n: watched.length, silent, top };
  return PG.band;
}
/* A kind's lines into w px at a pitch of P px (2: a line, then a pixel of dark): each night
   centred on its moment; a night that would land on its neighbour moves along, and the run
   is kept inside the band. A night of more than PG_DENSE lines is packed at one pixel a line,
   with no dark between: one dense emission band at its own date rather than a wall across
   its kind. (Narrower than its lines, every pitch shrinks rather than spill.) */
const PG_DENSE = 20;
const pgPitchOf = (night, P) => (night.lines.length > PG_DENSE ? Math.min(P, 1) : P);
/* The run's length at full pitch: each line one pitch from the last (the wider of the two
   where nights meet). */
function pgSpan(k, P = 2) {
  let span = 0, prevP = 0;
  for (const night of k.nights) {
    const p = pgPitchOf(night, P);
    night.lines.forEach((l, i) => { if (prevP) span += i ? p : Math.max(p, prevP); prevP = p; });
  }
  return span;
}
function pgPack(k, w, P = 2) {
  const out = [];
  const span = pgSpan(k, P);
  const s = span > w - 1 ? (w - 1) / span : 1;
  let prev = -Infinity, prevP = 0;
  for (const night of k.nights) {
    const p = pgPitchOf(night, P) * s;
    let x = night.f * (w - 1) - ((night.lines.length - 1) * p) / 2;
    night.lines.forEach((l, i) => {
      x = Math.max(x, prev + (i ? p : Math.max(p, prevP)), 0);
      l.x = s === 1 ? Math.round(x) : x;
      l.p = p;
      prev = l.x; prevP = p;
      x = l.x + p;
      out.push(l);
    });
  }
  let lim = w - 1;
  for (let i = out.length - 1; i >= 0; i--) {
    out[i].x = Math.min(out[i].x, lim);
    lim = out[i].x - (i ? Math.max(out[i].p, out[i - 1].p) : 0);
  }
  k.lines = out;
  return out;
}
/* The print: every line of every kind at its pixel, the strong ones with a halo (the
   page's glow); the silent ones as gaps, one ✕ above each group of them (gaps closer than a
   ✕ is wide share one, bracketed across the group); each kind's axis ruled beneath it, from
   the first scan to tonight; and the pointer's line. */
function pgBandSVG(segs, W, H, P = 2) {
  const levels = new Map();
  const fine = P < 2 && (window.devicePixelRatio || 1) >= 1.5;
  const mid = fine ? 0.25 : 0.5;
  let glow = '', cross = '', rule = '';
  const mark = (g, a, b) => {
    const c = g.x0 + (a + b) / 2 + 0.5;
    cross += `M${(c - 2).toFixed(1)} ${g.y0 - 8}l4 4m0 -4l-4 4`;
    if (b - a >= 1) cross += `M${(g.x0 + a + 0.5).toFixed(1)} ${g.y0 - 2}H${(g.x0 + b + 0.5).toFixed(1)}`;
  };
  for (const g of segs) {
    let run = null;
    for (const l of g.k.lines) {
      if (!l.lit) { if (run && l.x - run[1] <= 6) run[1] = l.x; else { if (run) mark(g, ...run); run = [l.x, l.x]; } continue; }
      const X = (g.x0 + l.x + mid).toFixed(2);
      const o = Math.round(l.o * 20) / 20;
      /* Intensity is carried in length as well as light: a faint line stands short, centred
         on its kind's band, and a strong one the band's full height. */
      const h = Math.round(g.h * (0.45 + 0.55 * o)), d = `M${X} ${g.y0 + Math.round((g.h - h) / 2)}v${h}`;
      levels.set(o, (levels.get(o) || '') + d);
      if (l.o >= 0.78) glow += d;
    }
    if (run) mark(g, ...run);
    const y = g.y0 + g.h + 4.5, x1 = g.x0 + g.w - 0.5;
    rule += `M${g.x0} ${y}H${x1 + 0.5}M${g.x0 + 0.5} ${y - 2.5}v5M${x1} ${y - 2.5}v5`;
  }
  const paths = [...levels].sort((a, b) => a[0] - b[0]).map(([o, d], i) => `<path class="pg-band-on" style="--i:${i}" stroke-opacity="${o}" d="${d}"/>`).join('');
  return `<svg class="pg-band-art${fine ? ' is-fine' : ''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" focusable="false"><defs><filter id="pg-band-blur" x="-2%" y="-10%" width="104%" height="120%"><feGaussianBlur stdDeviation="1.5"/></filter></defs>${glow ? `<path class="pg-band-glow" d="${glow}"/>` : ''}${paths}${cross ? `<path class="pg-band-x" d="${cross}"/>` : ''}<path class="pg-band-rule" d="${rule}"/><path class="pg-band-hi" d=""/></svg>`;
}
function pgBandHTML() {
  const data = pgBandData();
  const kinds = data ? data.kinds : [];
  const keys = kinds.map((k, i) => `<li class="pg-band-key" data-side="${i % 2 ? 'below' : 'above'}"><span class="pg-band-name">${esc(pgKindName(k.kind))}</span> <span class="pg-band-n">${esc(fmtInt(k.count))}</span><span class="sr-only"> watched, of ${esc(plural(k.records, 'record'))}${k.silent ? `; ${esc(fmtInt(k.silent))} did not answer on the last scan` : ''}</span></li>`);
  return `<figure class="pg-band${kinds.length ? ' is-exposed' : ''}" data-band aria-labelledby="source-band-note">
${kinds.length ? `<ol class="pg-band-keys" role="list" aria-label="Watched entrypoints by kind">${keys.join('')}</ol><svg class="pg-band-guides" aria-hidden="true" focusable="false"></svg>` : ''}
<div class="pg-band-strip night-print" aria-hidden="true"></div>
${kinds.length ? `<figcaption class="pg-readout" data-readout>${pgBandReadout(null)}</figcaption>` : ''}
</figure>`;
}
/* Beneath the band: its key, or the source under the pointer. */
function pgBandReadout(l) {
  const data = PG.band;
  if (!l || !data) {
    const opened = data ? fmtDate(new Date(data.ep.t0).toISOString(), { short: true }) : '';
    const scale = `<svg class="pg-scale night-print" viewBox="0 0 34 12" width="34" height="12" aria-hidden="true" focusable="false">${[0.3, 0.44, 0.58, 0.72, 0.86, 1].map((o, i) => { const h = Math.round(8 * (0.45 + 0.55 * o)); return `<path d="M${4.5 + i * 5} ${2 + Math.floor((8 - h) / 2)}v${h}" stroke-opacity="${o}"/>`; }).join('')}</svg>`;
    return `<span class="pg-readout-hint"><span class="pg-hint-fine">Point at a line to name its source</span><span class="pg-hint-touch">Tap a line to name its source</span></span>
${pgMeta([data ? esc(`${opened} → tonight, across each kind`) : '', `${scale}taller and brighter: more evidence filed through it`, data && data.silent ? `${pgGlyph('cross')}silent on the last scan` : ''], 'pg-readout-key')}`;
  }
  const s = l.s;
  const facts = [
    esc(pgKindName(s.kind, false)),
    esc(Number.isFinite(l.t) ? `added ${fmtDate(s.discoveredAt, { short: true })}` : 'date added not recorded'),
    esc(l.n ? `${plural(l.n, 'evidence page')} filed through it` : 'no evidence page filed yet'),
    esc(l.lit ? `answered ${fmtDate(s.lastSuccessAt, { short: true })}` : 'silent on the last scan')
  ];
  return `<span class="pg-readout-name">${esc(pgSourceName(s))}</span>${pgMeta(facts, 'pg-readout-facts')}<a class="pg-act pg-readout-go" href="#sources/${esc(encodeURIComponent(s.id))}">Open its record</a>`;
}
/* The sentences beside the title say what the band shows. */
function pgBandNote() {
  const st = pgSourceStats();
  const b = v => `<b>${esc(fmtInt(v))}</b>`;
  if (!state.sources) return `<p class="pg-band-note" id="source-band-note">${b(st.total)} records of every page the observatory has opened, cited or been pointed to. ${b(st.watched)} of them are the entrypoints it watches on every scan; their spectrum develops as the ledger arrives.</p>`;
  const data = pgBandData();
  const opened = fmtDate(new Date(data.ep.t0).toISOString(), { short: true });
  return `<p class="pg-band-note" id="source-band-note">${b(st.total)} records of every page the observatory has opened, cited or been pointed to. Below is its light: the ${b(data.n)} entrypoints it watches on every scan, one line each, dispersed by kind. Across each kind a line stands where it joined the watch, from the first scan on ${esc(opened)} to tonight, and burns as bright as the evidence it has led to.${data.silent ? ` ${b(data.n - data.silent)} answered on the last scan; the ${b(data.silent)} gaps marked <span aria-hidden="true">✕</span><span class="sr-only">with a cross</span> did not.` : ' Every one answered on the last scan.'}</p>`;
}
/* Lay the band out at its real width. A single band names its kinds above and below it in
   turn, each name on a hairline drawn to its band, lifted a tier where it would touch its
   neighbour; where a band would be narrower than its lines, or a name would need a third
   tier, the spectrum is cut into orders instead, one per kind, each named on its order. */
function pgBandLayout(fig) {
  if (!fig || !fig.isConnected) return;
  const data = pgBandData();
  const strip = fig.querySelector('.pg-band-strip');
  const keys = $$('.pg-band-key', fig);
  if (!data || !strip || !data.kinds.length || keys.length !== data.kinds.length) return;
  const guides = fig.querySelector('.pg-band-guides');
  fig.classList.remove('is-echelle');
  const cs = getComputedStyle(strip);
  const padL = parseFloat(cs.paddingLeft) || 0, padT = parseFloat(cs.paddingTop) || 0;
  const W = Math.floor(strip.clientWidth - padL - (parseFloat(cs.paddingRight) || 0));
  if (W <= 0) return;
  const K = data.kinds.length, gap = PG_BAND_GAP;
  /* One band only where every kind would fit at two pixels a line; narrower, the orders read
     better, each kind on its own axis. */
  const need = data.kinds.reduce((t, k) => t + 2 * k.count + 2, 0) + gap * (K - 1);
  const FW = fig.clientWidth, offX = strip.offsetLeft + padL;
  const rh = keys[0].offsetHeight || 24, space = Math.round(rh / 3);
  let segs = null, placed = null;
  if (W >= need) {
    /* Each kind takes the width its lines need, a pixel each (a dense night packed close),
       then a share of what is left by the square root of its count: a crowded kind does not
       become a wall, and a small one still has room for its nights to stand apart. */
    const base = data.kinds.map(k => pgSpan(k, 2) + 4);
    const spare = W - gap * (K - 1) - base.reduce((t, b) => t + b, 0);
    const roots = data.kinds.reduce((t, k) => t + Math.sqrt(k.count), 0) || 1;
    segs = data.kinds.map((k, i) => ({ k, w: base[i] + Math.floor((spare * Math.sqrt(k.count)) / roots) }));
    segs.reduce((a, g) => (g.w > a.w ? g : a)).w += W - gap * (K - 1) - segs.reduce((t, g) => t + g.w, 0);
    let x = 0;
    for (const g of segs) { g.x0 = x; x += g.w + gap; }
    const used = { above: [], below: [] };
    placed = [];
    for (let i = 0; i < K; i++) {
      const key = keys[i], g = segs[i];
      const cx = offX + g.x0 + g.w / 2;
      const w = Math.ceil(key.getBoundingClientRect().width);
      const start = Math.max(0, Math.min(FW - w, cx - w / 2));
      const tiers = used[key.dataset.side];
      let t = 0;
      while (t < tiers.length && tiers[t] > start - 12) t++;
      if (t > 1 || w > FW) { placed = null; break; }
      tiers[t] = start + w;
      placed.push({ key, cx, start, t, side: key.dataset.side });
    }
    if (placed) {
      const above = Math.max(1, used.above.length), below = Math.max(1, used.below.length);
      fig.style.setProperty('--above', above);
      fig.style.setProperty('--below', below);
      const H = Math.round(strip.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0));
      for (const g of segs) { g.y0 = 10; g.h = H - 18; pgPack(g.k, g.w, 2); }
      strip.innerHTML = pgBandSVG(segs, W, H, 2);
      const sTop = strip.offsetTop, sBottom = sTop + strip.offsetHeight;
      let d = '';
      for (const p of placed) {
        const top = p.side === 'above' ? sTop - space - (p.t + 1) * rh : sBottom + space + p.t * rh;
        p.key.style.setProperty('--left', `${p.start.toFixed(1)}px`);
        p.key.style.setProperty('--top', `${top}px`);
        p.key.style.removeProperty('--w');
        const X = Math.round(p.cx) + 0.5;
        d += p.side === 'above' ? `M${X} ${top + rh - 4}V${sTop + padT + 8}` : `M${X} ${top + 4}V${sBottom - (parseFloat(cs.paddingBottom) || 0)}`;
      }
      if (guides) { guides.setAttribute('viewBox', `0 0 ${FW} ${fig.offsetHeight}`); guides.innerHTML = `<path d="${d}"/>`; }
      fig._band = { segs, mode: 'band' };
      return;
    }
  }
  /* The orders: one per kind, its name and count on the order's own top line. */
  fig.classList.add('is-echelle');
  const lh = keys[0].offsetHeight || 16;
  const lineH = 16, pitch = lh + 7 + lineH + 12;
  segs = data.kinds.map((k, i) => ({ k, x0: 0, w: W, y0: Math.round(i * pitch + lh + 7), h: lineH, top: i * pitch, pitch }));
  const most = Math.max(...data.kinds.map(k => k.count));
  const P = W >= 2 * most + 2 ? 2 : 1;
  for (const g of segs) pgPack(g.k, g.w, P);
  const H = K * pitch - 12;
  strip.innerHTML = pgBandSVG(segs, W, H, P);
  if (guides) guides.innerHTML = '';
  segs.forEach((g, i) => {
    keys[i].style.setProperty('--left', `${offX}px`);
    keys[i].style.setProperty('--top', `${strip.offsetTop + padT + g.top}px`);
    keys[i].style.setProperty('--w', `${W}px`);
  });
  fig._band = { segs, mode: 'echelle' };
}
/* The line nearest the pointer, within a few pixels (a fingertip's width for a tap); in the
   orders, on the order under it. */
function pgBandHit(fig, ev, coarse = ev.pointerType === 'touch') {
  const art = fig && fig.querySelector('.pg-band-art');
  const B = fig && fig._band;
  if (!art || !B) return null;
  const r = art.getBoundingClientRect();
  const px = ev.clientX - r.left, py = ev.clientY - r.top;
  const g = B.mode === 'echelle'
    ? B.segs.find(s => py >= s.top && py < s.top + s.pitch)
    : B.segs.find(s => px >= s.x0 - PG_BAND_GAP / 2 && px < s.x0 + s.w + PG_BAND_GAP / 2);
  if (!g || py < -12 || py > r.height + 12) return null;
  let best = null, bd = coarse ? 22 : 5;
  for (const l of g.k.lines) { const d = Math.abs(g.x0 + l.x + 0.5 - px); if (d < bd) { bd = d; best = l; } }
  return best ? { l: best, g } : null;
}
function pgBandPoint(fig, hit, { row = true } = {}) {
  const art = fig.querySelector('.pg-band-art');
  const hi = art && art.querySelector('.pg-band-hi');
  const out = fig.querySelector('[data-readout]');
  const S = PG.src;
  if (S.pointed && (!hit || S.pointed !== hit.l.s.id)) { const old = document.getElementById(`source-${S.pointed}`); if (old) old.classList.remove('is-pointed'); }
  if (!hit) { if (hi) hi.setAttribute('d', ''); S.pointed = ''; return; }
  const { l, g } = hit;
  const X = (g.x0 + l.x + 0.5).toFixed(1);
  if (hi) { hi.setAttribute('d', `M${X} ${g.y0 - (fig._band.mode === 'echelle' ? 4 : 10)}v${g.h + (fig._band.mode === 'echelle' ? 8 : 16)}`); hi.classList.toggle('is-silent', !l.lit); }
  if (out && out.dataset.id !== l.s.id) { out.innerHTML = pgBandReadout(l); out.dataset.id = l.s.id; }
  S.pointed = l.s.id;
  const rowEl = row ? document.getElementById(`source-${l.s.id}`) : null;
  if (rowEl) rowEl.classList.add('is-pointed');
}
function pgBandWatch() {
  const lay = () => pgBandLayout(document.querySelector('[data-band]'));
  lay();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lay, () => {});
  const holder = document.getElementById('source-band');
  if (!holder) return;
  /* Pointing: a mouse (or pen) names the line under it, and a click opens only what the
     readout names: the line the pointer was last aimed at, never a fresh hit at the click's
     whole pixel, and nothing where no line is named. A tap names the line nearest it, and
     the readout's link opens it. */
  let touch = false, aimed = null;
  holder.addEventListener('pointerdown', ev => { touch = ev.pointerType === 'touch'; });
  holder.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'touch') return;
    const fig = holder.querySelector('[data-band]');
    const strip = fig && fig.querySelector('.pg-band-strip');
    aimed = ev.target.closest('.pg-band-strip') ? pgBandHit(fig, ev, false) : null;
    if (aimed) pgBandPoint(fig, aimed);
    if (strip) strip.style.cursor = aimed ? 'pointer' : '';
  });
  holder.addEventListener('pointerleave', () => {
    aimed = null;
    const row = PG.src.pointed && document.getElementById(`source-${PG.src.pointed}`);
    if (row) row.classList.remove('is-pointed');
  });
  holder.addEventListener('click', ev => {
    if (!ev.target.closest('.pg-band-strip')) return;
    const fig = holder.querySelector('[data-band]');
    if (touch) { const hit = pgBandHit(fig, ev, true); if (hit) pgBandPoint(fig, hit); return; }
    const out = fig && fig.querySelector('[data-readout]');
    if (aimed && out && out.dataset.id === aimed.l.s.id) location.hash = `#sources/${encodeURIComponent(aimed.l.s.id)}`;
  });
  if (typeof ResizeObserver !== 'function') return;
  let last = 0;
  const ro = new ResizeObserver(() => {
    const fig = document.querySelector('[data-band]');
    const w = fig ? fig.clientWidth : 0;
    if (w && w !== last) { last = w; lay(); }
  });
  ro.observe(holder);
  onLeave(() => { ro.disconnect(); PG.src.pointed = ''; });
}
function pgSourcesHead() {
  return pgHead({
    kind: 'sources',
    eyebrow: pgEyebrow(['Sources', 'The ledger']),
    title: 'The catalogue',
    aside: pgBandNote(),
    asideId: 'source-note',
    after: `<div class="pg-band-holder" id="source-band">${pgBandHTML()}</div>`
  });
}

/* The records that match the filters, in reading order. Without a search they are grouped
   by kind (official first) and, inside a kind, active before unverified; with a search,
   watched entrypoints come first, then records that were reached, then leads. */
function pgSourceResults() {
  const f = state.sourceFilters;
  const key = JSON.stringify([f.q.trim().toLowerCase(), f.kind, f.status, f.scope, state.sources.length]);
  const S = PG.src;
  if (S.key === key) return S.list;
  const words = queryWords(f.q);
  const list = state.sources.filter(s => pgInScope(s, f.scope) && (!f.kind || s.kind === f.kind) && (!f.status || s.status === f.status) && (!words.length || words.every(w => s._hay.includes(w))));
  const name = pgSourceName;
  if (words.length) {
    const score = s => { const n = lower(s.name), u = lower(s.url); return words.reduce((t, w) => t + (n.startsWith(w) ? 6 : n.includes(w) ? 4 : u.includes(w) ? 3 : 1), 0); };
    const scored = new Map(list.map(s => [s, score(s)]));
    list.sort((a, b) => (isMonitoring(b) - isMonitoring(a)) || (pgSrcStatus(a.status)[2] - pgSrcStatus(b.status)[2]) || (scored.get(b) - scored.get(a)) || collator.compare(name(a), name(b)));
  } else {
    list.sort((a, b) => (pgKindRank(a.kind) - pgKindRank(b.kind)) || collator.compare(String(a.kind), String(b.kind)) || (pgSrcStatus(a.status)[2] - pgSrcStatus(b.status)[2]) || collator.compare(name(a), name(b)));
  }
  S.key = key;
  S.list = list;
  return list;
}
/* Facet counts: for each option, how many records it would leave with the other filters kept. */
function pgSourceFacets() {
  const f = state.sourceFilters;
  const words = queryWords(f.q);
  const kinds = {}, statuses = {}, scopes = { '': 0, evidence: 0, all: 0 };
  for (const s of state.sources) {
    if (words.length && !words.every(w => s._hay.includes(w))) continue;
    const okKind = !f.kind || s.kind === f.kind, okStatus = !f.status || s.status === f.status, inScope = pgInScope(s, f.scope);
    if (okKind && okStatus) { scopes.all++; scopes[isMonitoring(s) ? '' : 'evidence']++; }
    if (inScope && okStatus) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
    if (inScope && okKind) statuses[s.status] = (statuses[s.status] || 0) + 1;
  }
  return { kinds, statuses, scopes };
}
function pgSourceStrip() {
  const f = state.sourceFilters;
  const st = pgSourceStats();
  const scopeN = { '': st.watched, evidence: st.evidence, all: st.total };
  return `<form id="source-filters" class="pg-strip" role="search" aria-label="Search and filter the catalogue">
<div class="pg-ctl pg-ctl--search"><label class="pg-ctl-label" for="source-search">Search</label><input class="pg-input" id="source-search" name="q" type="search" autocomplete="off" spellcheck="false" data-search placeholder="Publisher, topic or address" value="${esc(f.q)}"></div>
<fieldset class="pg-ctl pg-seg"><legend class="pg-ctl-label">Show</legend><div class="pg-seg-opts">${PG_SCOPES.map(([v, label]) => `<label class="pg-seg-opt"><input type="radio" name="scope" value="${v}"${f.scope === v ? ' checked' : ''}><span>${esc(label)}</span><span class="pg-seg-n" data-scope-n="${v}">${esc(fmtInt(scopeN[v]))}</span></label>`).join('')}</div></fieldset>
<div class="pg-ctl"><label class="pg-ctl-label" for="source-kind">Kind</label><select class="pg-select" id="source-kind" name="kind">${pgSourceKindOptions()}</select></div>
<div class="pg-ctl"><label class="pg-ctl-label" for="source-status">Status</label><select class="pg-select" id="source-status" name="status">${pgSourceStatusOptions()}</select></div>
</form>`;
}
function pgSourceKindOptions(counts) {
  const f = state.sourceFilters;
  const kinds = Object.keys(counts || pgSourceStats().byKind).filter(k => !counts || counts[k] || k === f.kind);
  if (f.kind && !kinds.includes(f.kind)) kinds.push(f.kind);
  kinds.sort((a, b) => pgKindRank(a) - pgKindRank(b) || collator.compare(a, b));
  return `<option value="">All kinds</option>${kinds.map(k => `<option value="${esc(k)}"${f.kind === k ? ' selected' : ''}>${esc(pgKindName(k))}${counts ? ` (${fmtInt(counts[k] || 0)})` : ''}</option>`).join('')}`;
}
function pgSourceStatusOptions(counts) {
  const f = state.sourceFilters;
  const all = Object.keys(counts || pgSourceStats().byStatus).filter(k => !counts || counts[k] || k === f.status);
  if (f.status && !all.includes(f.status)) all.push(f.status);
  all.sort((a, b) => pgSrcStatus(a)[2] - pgSrcStatus(b)[2]);
  return `<option value="">Any status</option>${all.map(k => `<option value="${esc(k)}"${f.status === k ? ' selected' : ''}>${esc(pgSrcStatus(k)[0])}${counts ? ` (${fmtInt(counts[k] || 0)})` : ''}</option>`).join('')}`;
}
/* A record's name as a reader wants it. Some records were named after their own address
   ("Observed linked resource: https://github.com/…"): those drop the label and show the
   address's path in the serif, since the host is already beside it. */
const PG_OBSERVED = /^observed\s+(?:linked\s+)?resource:\s*/i;
function pgHost(url) {
  const href = safeURL(url);
  if (!href) return '';
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}
const pgNames = new Map();
function pgSourceName(s) {
  const key = s.id || s.url;
  if (pgNames.has(key)) return pgNames.get(key);
  const shown = pgSourceNameOf(s);
  pgNames.set(key, shown);
  return shown;
}
function pgSourceNameOf(s) {
  const raw = String(s.name || '').trim();
  if (raw && !PG_OBSERVED.test(raw)) return raw;
  const href = safeURL(raw.replace(PG_OBSERVED, '').trim()) || safeURL(s.url);
  if (href) {
    try {
      const u = new URL(href);
      let path = `${u.pathname.replace(/^\/+|\/+$/g, '')}${u.search}`;
      try { path = decodeURI(path); } catch (_) { /* keep it encoded */ }
      return path || u.hostname.replace(/^www\./, '');
    } catch (_) { /* fall through */ }
  }
  return raw.replace(PG_OBSERVED, '').trim() || pgShortURL(s.url) || s.id;
}
/* One record, one line. Inside a kind's group the kind is not repeated; the status is drawn
   only where it is not "active"; the last check is mentioned only when it is older than the
   last scan; the name is the link out, the host beside it. Notes and the full record open
   beneath. */
function pgSourceRow(s, { pinned = false } = {}) {
  const S = PG.src;
  const f = state.sourceFilters;
  const grouped = !pinned && !f.q.trim();
  const name = pgSourceName(s);
  const [statusLabel, shape] = pgSrcStatus(s.status);
  const facts = [];
  if (!grouped) facts.push(esc(pgKindName(s.kind, false)));
  if ((pinned || f.scope === 'all') && isMonitoring(s)) facts.push('watched');
  const t = pgTime(s.lastCheckedAt), last = pgLastScan();
  if (Number.isFinite(t) && Number.isFinite(last) && t < last - 432e5) facts.push(`checked ${esc(fmtDate(s.lastCheckedAt, { short: true }))}`);
  return pgLineHTML({
    kind: 'source', id: s.id, n: S.numbers ? S.numbers.get(s.id) || 0 : 0, width: S.width, open: S.open.has(s.id),
    name: pgOut(s.url, name),
    host: esc(pgHost(s.url) || pgShortURL(s.url)),
    extra: facts.join(' · '),
    mark: s.status && s.status !== 'active' ? pgMark(shape, statusLabel) : '',
    toggle: `<button type="button" class="pg-toggle" data-action="pg-record" data-id="${esc(s.id)}" aria-expanded="${S.open.has(s.id)}" aria-controls="source-more-${esc(s.id)}"><span class="sr-only">Record: ${esc(name)}</span></button>`,
    more: () => pgSourceDetail(s)
  });
}
function pgSourceDetail(s) {
  const via = s.discoveredFrom ? state.sourceById.get(s.discoveredFrom) : null;
  const from = via ? `<a href="#sources/${esc(encodeURIComponent(via.id))}">${esc(via.name || via.id)}</a>`
    : safeURL(s.discoveredFrom) ? external(s.discoveredFrom, pgShortURL(s.discoveredFrom)) : esc(pgWords(s.discoveredFrom) || 'Not recorded');
  const [statusLabel] = pgSrcStatus(s.status);
  const shown = pgSourceName(s), raw = String(s.name || '').trim();
  const rows = [
    raw && raw !== shown ? ['Recorded as', raw] : null,
    safeURL(s.url) ? ['Address', external(s.url, pgShortURL(s.url)), true] : null,
    ['Kind', `${pgKindName(s.kind, false)}; ${isMonitoring(s) ? 'a watched entrypoint, revisited on every scan' : 'an evidence page or lead, not watched'}`],
    ['Status', statusLabel],
    ['Found through', from, true],
    ['Added', fmtDate(s.discoveredAt)],
    ['Last checked', s.lastCheckedAt ? fmtDate(s.lastCheckedAt, { time: true }) : 'Not yet checked'],
    ['Last reached', s.lastSuccessAt ? fmtDate(s.lastSuccessAt, { time: true }) : 'Not established'],
    ['Covered through', s.lastCoverageAt ? fmtDate(s.lastCoverageAt, { time: true }) : 'No complete scan window recorded'],
    s.feedUrl ? ['Feed', external(s.feedUrl, pgShortURL(s.feedUrl)), true] : null,
    Array.isArray(s.topics) && s.topics.length ? ['Topics', s.topics.map(pgWords).join(', ')] : null
  ].filter(Boolean);
  /* The ledger's note was written when the record was added; once the record has been
     reached since, the note says so, so it never contradicts the dates beneath it. */
  const added = pgTime(s.discoveredAt), reached = pgTime(s.lastSuccessAt);
  const dated = Number.isFinite(added) && Number.isFinite(reached) && reached > added + 36e5;
  const note = s.notes ? `<p class="pg-line-notes">${dated ? `<span class="pg-line-notes-when">Note from when it was added, ${esc(fmtDate(s.discoveredAt, { short: true }))}:</span> ` : ''}${esc(s.notes)}</p>` : '';
  return `${note}<dl class="pg-dl">${rows.map(([k, v, html]) => `<div><dt>${esc(k)}</dt><dd>${html ? v : esc(v)}</dd></div>`).join('')}</dl>
<p class="pg-permalink"><a href="#sources/${esc(encodeURIComponent(s.id))}">Link to this record</a></p>`;
}
function pgSourceCount(results) {
  const f = state.sourceFilters;
  const st = pgSourceStats();
  const total = state.sources ? state.sources.length : st.total;
  if (!state.sources) return `${esc(plural(total, 'record'))} in the catalogue <span class="pg-count-note">Loading the records…</span>`;
  const what = f.q.trim() ? `${pgScopeName(f.scope).toLowerCase()}, matching “${esc(f.q.trim())}”` : f.scope === '' ? 'watched entrypoints, by kind' : f.scope === 'evidence' ? 'evidence pages and leads, by kind' : 'every record, by kind';
  return `<strong>${esc(fmtInt(results.length))}</strong> of ${esc(plural(total, 'record'))} <span class="pg-count-note">${what}</span>`;
}
function pgSourceEmpty() {
  const f = state.sourceFilters;
  const facets = pgSourceFacets();
  const elsewhere = f.scope !== 'all' ? facets.scopes.all : 0;
  const ways = [];
  if (f.q.trim()) ways.push('<button type="button" class="pg-act" data-action="pg-clear-search" data-list="sources">Clear the search</button>');
  if (elsewhere) ways.push(`<button type="button" class="pg-act" data-action="pg-scope-all">Search everything (${esc(fmtInt(elsewhere))})</button>`);
  if (f.kind || f.status) ways.push('<button type="button" class="pg-act" data-action="pg-reset" data-list="sources">Show every kind and status</button>');
  return `<div class="pg-empty"><p class="pg-empty-line">No record matches.</p><p>${elsewhere ? `${esc(plural(elsewhere, 'record'))} outside ${esc(pgScopeName(f.scope).toLowerCase())} ${elsewhere === 1 ? 'does' : 'do'}.` : 'Try fewer words, or a publisher’s name or address.'}</p><div class="pg-empty-ways">${ways.join('')}</div></div>`;
}
function pgDrawSources() {
  const listEl = document.getElementById('source-list');
  if (!listEl) return;
  const S = PG.src;
  const count = document.getElementById('source-count');
  if (!state.sources) { if (count) count.innerHTML = pgSourceCount([]); return; }
  const f = state.sourceFilters;
  const results = pgSourceResults();
  const grouped = !f.q.trim();
  const plan = pgPlan(results, grouped ? s => s.kind : null);
  const pages = plan.length;
  S.page = clamp(S.page, 1, pages);
  const [from, until] = plan[S.page - 1];
  const slice = results.slice(from, until);
  const pin = S.pin ? state.sourceById.get(S.pin) : null;
  /* The watched entrypoints are set as an index: two columns on a wide screen, each kind
     about a screen long. */
  const lines = `pg-lines${grouped && f.scope === '' ? ' pg-lines--index' : ''}`;
  let html = '';
  if (!slice.length) html = pgSourceEmpty();
  else if (!grouped) html = `<ol class="pg-lines" role="list">${slice.map(s => pgSourceRow(s)).join('')}</ol>`;
  else {
    const perKind = {};
    for (const s of results) perKind[s.kind] = (perKind[s.kind] || 0) + 1;
    let kind = null;
    slice.forEach((s, i) => {
      if (s.kind !== kind) {
        if (kind !== null) html += '</ol>';
        kind = s.kind;
        const cont = i === 0 && from > 0 && results[from - 1].kind === kind;
        html += `<h3 class="pg-group"><span class="pg-group-name">${esc(pgKindName(kind))}</span><span class="pg-group-n">${cont ? 'continued · ' : ''}${esc(plural(perKind[kind], pgScopeNoun(f.scope)))}</span></h3><ol class="${lines}" role="list">`;
      }
      html += pgSourceRow(s);
    });
    html += '</ol>';
  }
  listEl.innerHTML = html;
  listEl.setAttribute('aria-busy', 'false');
  if (count) count.innerHTML = pgSourceCount(results);
  const pinEl = document.getElementById('source-pin');
  if (pinEl) pinEl.innerHTML = pin ? pgPinHTML('source', pin, pgSourceRow(pin, { pinned: true }), pgSourcePinWhy(pin)) : '';
  const note = document.getElementById('source-notice');
  if (note) { note.innerHTML = S.note ? `<p class="pg-notice" tabindex="-1">${esc(S.note)}</p>` : ''; }
  const pager = document.getElementById('source-pager');
  if (pager) pager.innerHTML = pgPager('sources', S.page, plan, results.length, 'catalogue');
  pgSourceFacetsPaint();
}
function pgSourceFacetsPaint() {
  const form = document.getElementById('source-filters');
  if (!form || !state.sources) return;
  const facets = pgSourceFacets();
  for (const [v] of PG_SCOPES) { const el = form.querySelector(`[data-scope-n="${v}"]`); if (el) el.textContent = fmtInt(facets.scopes[v]); }
  const active = document.activeElement;
  const kind = form.elements.kind, status = form.elements.status;
  if (kind && kind !== active) kind.innerHTML = pgSourceKindOptions(facets.kinds);
  if (status && status !== active) status.innerHTML = pgSourceStatusOptions(facets.statuses);
}
function pgSourcePinWhy(s) {
  const f = state.sourceFilters;
  const why = [];
  if (!pgInScope(s, f.scope)) why.push(isMonitoring(s) ? 'it is a watched entrypoint' : 'it is an evidence page, not a watched entrypoint');
  if (f.kind && s.kind !== f.kind) why.push(`its kind is ${pgKindName(s.kind, false).toLowerCase()}`);
  if (f.status && s.status !== f.status) why.push(`it is ${pgSrcStatus(s.status)[0].toLowerCase()}`);
  if (f.q.trim() && !queryWords(f.q).every(w => s._hay.includes(w))) why.push('it does not match the search');
  return why.length ? `Outside the current view: ${why.join(', ')}.` : 'Opened from a link.';
}
/* A record or account opened from an address that the current view does not include. */
function pgPinHTML(kind, item, rowHTML, why) {
  const back = kind === 'source' ? '#sources' : '#accounts';
  return `<section class="pg-pin" aria-labelledby="${kind}-pin-title">
<div class="pg-pin-head"><h2 class="pg-pin-title" id="${kind}-pin-title">Opened from a link</h2><p class="pg-pin-why">${esc(why)}</p><a class="pg-act" href="${back}">Close<span class="sr-only"> this ${kind === 'source' ? 'record' : 'entry'}</span></a></div>
<ol class="pg-lines" role="list">${rowHTML}</ol>
</section>`;
}
/* Back to the list. The engine restores scroll itself (history.scrollRestoration is manual),
   and an entry opened inside the catalogue or the directory is a change of its subroute, so
   the view keeps the place: opening an entry from the bare list remembers where the reader
   was (the page of the list, the scroll, whether the entry was already open, and the
   readout's link if that is what opened it), and the way back to the bare list restores it. */
function pgBackFrom(S, id) {
  const active = document.activeElement;
  return { y: window.scrollY, page: S.page, id, open: S.open.has(id), sel: active && active.matches && active.matches('a.pg-readout-go') ? 'a.pg-readout-go' : '' };
}
function pgBackTo(back) {
  window.scrollTo({ top: back.y, left: 0, behavior: 'instant' });
  const el = back.sel ? app.querySelector(back.sel) : null;
  if (el) el.focus({ preventScroll: true });
}
/* #sources/<id>: open that record wherever it is — on its page of the current view, or pinned
   above the list when the filters leave it out. Never adds a history entry. An address that
   names no record says so where the reader is looking, and out loud. */
function pgSourceRoute(id, { focus = false, entering = false } = {}) {
  const S = PG.src;
  const was = S.want;
  S.want = id || '';
  if (!state.sources) return;
  S.note = '';
  if (!id) {
    const back = was ? S.back : null;
    S.back = null;
    S.pin = '';
    if (back) { S.page = back.page; if (!back.open) S.open.delete(back.id); }
    pgDrawSources();
    if (back) pgBackTo(back);
    return;
  }
  if (!was && !entering) S.back = pgBackFrom(S, id);
  const s = state.sourceById.get(id);
  if (!s) {
    S.pin = '';
    S.note = `No record with the address #sources/${id} is in this catalogue. It may have been merged or renamed; the full ledger is below.`;
    pgDrawSources();
    pgReveal('source-notice', { focus: focus ? '.pg-notice' : null, entering });
    announce(S.note);
    return;
  }
  S.open.add(id);
  const results = pgSourceResults();
  const at = results.indexOf(s);
  if (at >= 0) { S.pin = ''; S.page = pgPageOf(pgPlan(results, state.sourceFilters.q.trim() ? null : x => x.kind), at); } else S.pin = id;
  pgDrawSources();
  pgReveal(`source-${id}`, { focus: focus ? '.pg-line-name a' : null, scrollTo: S.pin ? 'source-pin' : '', entering });
}
function pgSourcesReady(fresh = false) {
  const S = PG.src;
  /* A catalogue without sourceStats: the header was drawn from nothing; draw it from the ledger. */
  if (S.statsLate) {
    S.statsLate = false;
    const head = document.querySelector('.pg--sources > .pg-head');
    if (head) {
      const focused = head.contains(document.activeElement);
      head.outerHTML = pgSourcesHead();
      if (focused) focusHeading();
      pgBandWatch();
    }
  } else {
    /* The ledger is in: the spectrum is exposed, the faint lines first and the strong ones
       last, as light accumulates, where motion is allowed. */
    const holder = document.getElementById('source-band');
    if (holder) {
      holder.innerHTML = pgBandHTML();
      const fig = holder.querySelector('[data-band]');
      pgBandLayout(fig);
      if (fresh && fig && !motionReduced()) { fig.classList.add('is-developing'); setTimeout(() => fig.classList.remove('is-developing'), 2000); }
    }
    const note = document.getElementById('source-note');
    if (note) note.innerHTML = pgBandNote();
  }
  if (!S.numbers || S.numbers.size !== state.sources.length) {
    S.numbers = new Map(state.sources.map((s, i) => [s.id, i + 1]));
    S.width = Math.max(4, String(state.sources.length).length);
    S.key = '';
  }
  pgSourceRoute(S.want, { focus: true, entering: true });
}
function pgSourcesFailed() {
  const listEl = document.getElementById('source-list');
  if (!listEl) return;
  listEl.setAttribute('aria-busy', 'false');
  listEl.innerHTML = '<div class="pg-empty"><p class="pg-empty-line">The records did not arrive.</p><p>The figures above come with the library; the full ledger is a separate file that could not be loaded just now.</p><div class="pg-empty-ways"><button type="button" class="pg-act" data-action="retry">Try again</button></div></div>';
  const count = document.getElementById('source-count');
  if (count) count.innerHTML = `${esc(plural(pgSourceStats().total, 'record'))} in the catalogue <span class="pg-count-note">The records could not be loaded.</span>`;
  announce('The records did not arrive. Use Try again to load them.');
}
/* Filters: text is debounced, choices apply at once; any change drops a pinned record and
   returns to the first page, without touching history. */
function pgWireFilters(formId, list) {
  const form = document.getElementById(formId);
  if (!form) return;
  const filters = list === 'sources' ? state.sourceFilters : state.accountFilters;
  const S = list === 'sources' ? PG.src : PG.acc;
  const apply = () => {
    for (const key of Object.keys(filters)) {
      const control = form.elements[key];
      if (control) filters[key] = String(control.value ?? '');
    }
    S.page = 1;
    S.note = '';
    S.pin = '';
    S.back = null;
    /* A record opened from an address gives way to the new selection; the address follows
       without a history entry (the view's subroute handler redraws). */
    if (state.route.id) replaceRoute(list === 'sources' ? '#sources' : '#accounts');
    else if (list === 'sources') pgDrawSources(); else pgDrawAccounts();
    const n = list === 'sources' ? (state.sources ? pgSourceResults().length : null) : (state.accounts ? pgAccountResults().length : null);
    if (n !== null) pgAnnounce(`${plural(n, list === 'sources' ? 'record' : 'account')}.`);
  };
  const typed = debounce(apply, 140);
  form.addEventListener('input', event => { if (event.target && event.target.name === 'q') typed(); else { typed.cancel(); apply(); } });
}
function renderSources(route, token) {
  const S = PG.src;
  S.statsLate = !state.sourceStats && !state.sources;
  S.pin = '';
  S.note = '';
  S.want = route.id || '';
  app.innerHTML = `<div class="pg pg--sources">
${pgSourcesHead()}
<section class="pg-cat" aria-labelledby="source-results-title">
${pgSourceStrip()}
<div class="pg-cat-head"><h2 class="pg-cat-title" id="source-results-title">Records</h2><p id="source-count" class="pg-count" tabindex="-1">${pgSourceCount([])}</p><p class="pg-cat-key">Numbers are ledger order; unverified leads never come first. Each name opens the publisher’s own page <span aria-hidden="true">↗</span>; a ring <span class="pg-key-glyph">${pgGlyph('ring')}</span> marks a lead not yet verified, a cross <span class="pg-key-glyph">${pgGlyph('cross')}</span> one that is blocked.</p></div>
<div id="source-notice"></div>
<div id="source-pin"></div>
<div id="source-list" class="pg-list" aria-busy="true">${pgGhosts(10)}<p class="sr-only">Loading the records.</p></div>
<div id="source-pager"></div>
</section>
</div>`;
  pgWireFilters('source-filters', 'sources');
  pgStickyStrip(document.getElementById('source-filters'));
  pgBandWatch();
  onSubroute(next => { pgSourceRoute(next.id, { focus: true }); return true; });
  if (state.sources) { pgSourcesReady(); return; }
  loadSources().then(() => { if (isCurrent(token)) pgSourcesReady(true); }, error => { if (isCurrent(token)) pgSourcesFailed(error); });
}

/* =================================================================== ACCOUNTS */
const PG_ACC_STATUS = { verified: ['Verified', 'target', 0], specialist: ['Specialist', 'filled', 1], provisional: ['Provisional', 'ring', 2] };
const pgAccStatus = status => PG_ACC_STATUS[status] || [pgLabel(status), 'ring', 3];
/* "Assessed" is the directory's default selection: verified or specialist, entrypoint opened. */
const pgAssessed = a => ['verified', 'specialist'].includes(a.status) && !!(a.access && a.access.entrypointInspected === true);
const pgEvidence = a => (Array.isArray(a.evidence) ? a.evidence.filter(e => e && e.url) : []);
function pgHandle(a) {
  const short = pgShortURL(a.url);
  const m = short.match(/^(?:x\.com|twitter\.com)\/([^/?#]+)/i) || short.match(/^bsky\.app\/profile\/([^/?#]+)/i);
  return m ? `@${m[1]}` : short;
}
/* The directory opens on the people and teams themselves: one of each kind it watches for,
   each the assessed account from which the most evidence has been recorded (then the most
   recently assessed, then by name), so the choice is the data's, not a favourite. */
const PG_WHO = [
  ['A lab, announcing its releases', /official|announce/i],
  ['A researcher, publishing their work', /research/i],
  ['A builder, reporting their own experiments', /firsthand|experiment|builder/i]
];
function pgAccountsWho() {
  if (!state.accounts) {
    return `<ul class="pg-who pg-who--wait" role="list" aria-hidden="true">${PG_WHO.map(() => '<li class="pg-who-one"><span class="skeleton-line short"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></li>').join('')}</ul>`;
  }
  const pool = state.accounts.filter(pgAssessed);
  const used = new Set();
  const picks = [];
  for (const [kind, re] of PG_WHO) {
    const best = pool.filter(a => !used.has(a.id) && re.test(String(a.editorialRole || '')))
      .sort((x, y) => pgEvidence(y).length - pgEvidence(x).length || String(y.lastAssessedAt || '').localeCompare(String(x.lastAssessedAt || '')) || collator.compare(String(x.name || ''), String(y.name || '')))[0];
    if (best) { used.add(best.id); picks.push([kind, best]); }
  }
  if (!picks.length) return '';
  const ep = pgEpoch();
  return `${pgDriftHTML(ep, picks)}<ul class="pg-who" role="list" aria-label="Three of the accounts we watch">${picks.map(([kind, a]) => `<li class="pg-who-one" data-account="${esc(a.id)}">
<p class="pg-who-kind">${esc(kind)}</p>
<p class="pg-who-name"><a href="#accounts/${esc(encodeURIComponent(a.id))}">${esc(a.name || pgHandle(a))}</a></p>
${pgMeta([esc(pgHandle(a)), esc(a.platform || 'Web'), esc(plural(pgEvidence(a).length, 'post'))+ ' on record'], 'pg-who-meta')}
${pgWhoStrip(a, ep)}
${a.whyMonitor ? `<p class="pg-who-why">${esc(a.whyMonitor)}</p>` : ''}
</li>`).join('')}</ul>`;
}
/* The directory as the plate sees it, a drift scan. One row for every assessed account with a
   dated post, the account whose latest post is newest at the top; each post a point of light
   across at the moment it was published, and a faint trail from the account's first post to
   its last. Read down, the trail heads sweep from tonight's hand back into the past: a
   long exposure, its front of heads with their tails behind. Right of the dashed line is the
   plate's own time, from the first scan to tonight; left of it, the years before the shutter
   opened, compressed (by the logarithm of their age) and dimmed, since the plate did not see
   them. The three accounts set out beneath are lit in full ink and named at the right edge.
   A night print, aria-hidden: pointing at a trail names its account beneath the scan and
   lights its row, a click opens its entry; the caption says what the scan shows, and the
   directory below carries every post in words. Rows are 2 px apart, drawn on whole pixels. */
const PG_DRIFT = { pitch: 2, split: 0.26, scale: 30 * 864e5 };
function pgDriftData(ep) {
  const S = PG.acc;
  if (S.drift && S.drift.of === state.accounts && S.drift.t0 === ep.t0) return S.drift;
  const list = state.accounts.filter(pgAssessed);
  const rows = [];
  let earliest = ep.t0;
  for (const a of list) {
    const ts = pgEvidence(a).map(e => pgTime(e.publishedAt)).filter(Number.isFinite).sort((x, y) => x - y);
    if (!ts.length) continue;
    rows.push({ a, ts, first: ts[0], last: ts[ts.length - 1] });
    earliest = Math.min(earliest, ts[0]);
  }
  rows.sort((p, q) => q.last - p.last || q.first - p.first || collator.compare(String(p.a.name || ''), String(q.a.name || '')));
  const split = earliest < ep.t0 ? PG_DRIFT.split : 0;
  const span = Math.max(1, ep.tNow - ep.t0), deep = Math.log1p((ep.t0 - earliest) / PG_DRIFT.scale) || 1;
  const x = t => (t >= ep.t0
    ? 1000 * (split + (1 - split) * Math.min(1, (t - ep.t0) / span))
    : 1000 * split * (1 - Math.log1p((ep.t0 - t) / PG_DRIFT.scale) / deep));
  rows.forEach((r, i) => { r.i = i; r.xs = r.ts.map(x); });
  S.drift = { of: state.accounts, t0: ep.t0, ep, rows, x, split, earliest, undated: list.length - rows.length, posts: rows.reduce((t, r) => t + r.ts.length, 0), since: rows.reduce((t, r) => t + r.ts.filter(v => v >= ep.t0).length, 0) };
  return S.drift;
}
const pgDriftY = i => i * PG_DRIFT.pitch;
function pgDriftRowPaths(r) {
  const y = pgDriftY(r.i);
  const a = r.xs[0], b = r.xs[r.xs.length - 1];
  return {
    trail: b - a >= 0.4 ? `M${a.toFixed(1)} ${y + 0.5}H${b.toFixed(1)}` : '',
    dots: r.xs.map(v => `M${v.toFixed(1)} ${y + 1}h0`).join('')
  };
}
function pgDriftHTML(ep, picks = []) {
  const d = pgDriftData(ep);
  if (!d.rows.length) return '';
  const H = d.rows.length * PG_DRIFT.pitch;
  const lit = new Map(picks.map(([kind, a]) => [a.id, kind]));
  let trails = '', dots = '', litTrails = '', litDots = '', leaders = '';
  const calls = [];
  for (const r of d.rows) {
    const p = pgDriftRowPaths(r);
    if (lit.has(r.a.id)) {
      litTrails += p.trail; litDots += p.dots;
      leaders += `M${(r.xs[r.xs.length - 1] + 6).toFixed(1)} ${pgDriftY(r.i) + 0.5}H1000`;
      calls.push({ r, kind: lit.get(r.a.id), y: pgDriftY(r.i) + 0.5 });
    } else { trails += p.trail; dots += p.dots; }
  }
  /* The names at the right edge keep apart: each at its row, moved down past the one above. */
  calls.sort((p, q) => p.y - q.y);
  for (let i = 1; i < calls.length; i++) calls[i].at = Math.max(calls[i].y, (calls[i - 1].at ?? calls[i - 1].y) + 40);
  const xs = 1000 * d.split;
  const years = [];
  if (d.split) {
    const y0 = new Date(d.earliest).getUTCFullYear() + 1, y1 = new Date(d.ep.t0).getUTCFullYear();
    for (let y = y1; y >= y0; y--) {
      const xv = d.x(Date.UTC(y, 0, 1));
      if (!years.length || years[years.length - 1].x - xv >= 46) years.push({ y, x: xv });
    }
  }
  const opened = fmtDate(new Date(d.ep.t0).toISOString(), { short: true });
  const kindShort = k => k.replace(/,.*$/, '');
  return `<figure class="pg-drift">
<div class="pg-drift-art night-print" data-drift aria-hidden="true">
<svg class="pg-drift-svg" viewBox="0 0 1000 ${H}" preserveAspectRatio="none" style="--h:${H}px" focusable="false">
<path class="pg-drift-trail" d="${trails}"/><path class="pg-drift-dots" d="${dots}"/>
${d.split ? `<rect class="pg-drift-past" x="0" y="-12" width="${xs.toFixed(1)}" height="${H + 24}"/>` : ''}
${d.split ? `<path class="pg-drift-open" d="M${xs.toFixed(1)} -12V${H + 12}"/>` : ''}
<path class="pg-drift-hand" d="M1000 -12V${H + 12}"/>
${years.map(y => `<path class="pg-drift-tick" d="M${y.x.toFixed(1)} ${H + 6}v5"/>`).join('')}
<path class="pg-drift-leader" d="${leaders}"/><path class="pg-drift-lit" d="${litTrails}"/><path class="pg-drift-litdots" d="${litDots}"/>
<path class="pg-drift-guide" d=""/><path class="pg-drift-hi" d=""/><path class="pg-drift-hidots" d=""/>
</svg>
${calls.map(c => `<span class="pg-drift-call" data-id="${esc(c.r.a.id)}" style="--y:${(c.at ?? c.y).toFixed(1)}px"><span class="pg-drift-call-name">${esc(c.r.a.name || pgHandle(c.r.a))}</span><span class="pg-drift-call-kind">${esc(kindShort(c.kind))}</span></span>`).join('')}
<span class="pg-drift-call pg-drift-call--hover" hidden><span class="pg-drift-call-name"></span><span class="pg-drift-call-kind"></span></span>
${years.map(y => `<span class="pg-drift-year" style="--x:${(y.x / 1000).toFixed(4)}">${esc(String(y.y))}</span>`).join('')}
${d.split ? `<span class="pg-drift-s" style="--x:${d.split}">${esc(opened)}<span class="pg-drift-more">, the shutter opens</span></span>` : `<span class="pg-drift-l">${esc(opened)}<span class="pg-drift-more">, the shutter opens</span></span>`}
<span class="pg-drift-r">Tonight</span>
</div>
<p class="pg-readout pg-readout--drift" data-readout>${pgDriftReadout(null)}</p>
<figcaption>A drift scan of the directory: one row for each of the <b>${esc(fmtInt(d.rows.length))}</b> assessed accounts with a dated post, the newest latest post at the top. Each of their <b>${esc(fmtInt(d.posts))}</b> posts is a point of light, across at the moment it was published, and a faint trail joins an account’s first post to its last. Right of the dashed line is the plate’s own time, from the first scan on ${esc(opened)} to tonight (<b>${esc(fmtInt(d.since))}</b> posts); left of it, the years before, compressed and dimmed.${d.undated ? ` ${esc(plural(d.undated, 'account'))} with no dated post ${d.undated === 1 ? 'is' : 'are'} not drawn.` : ''}</figcaption>
</figure>`;
}
/* A day of this year as "12 Nov"; any other with its year. */
const pgDriftDay = t => fmtDate(new Date(t).toISOString(), { short: new Date(t).getFullYear() === new Date().getFullYear() });
function pgDriftReadout(r) {
  if (!r) return `<span class="pg-readout-hint"><span class="pg-hint-fine">Point at a trail to name its account</span><span class="pg-hint-touch">Tap a trail to name its account</span></span>`;
  const a = r.a;
  const latest = pgDriftDay(r.last), first = pgDriftDay(r.first);
  const n = pgEvidence(a).length;
  return `<span class="pg-readout-name">${esc(a.name || pgHandle(a))}</span>${pgMeta([esc(pgHandle(a)), esc(a.platform || 'Web'), esc(`${plural(n, 'post')} on record`), esc(r.ts.length > 1 ? `${first} to ${latest}` : `posted ${latest}`)], 'pg-readout-facts')}<a class="pg-act pg-readout-go" href="#accounts/${esc(encodeURIComponent(a.id))}">Open the entry</a>`;
}
/* The row nearest the pointer whose trail or posts are within a few pixels of it (a
   fingertip's width for a tap). */
function pgDriftHit(art, ev, coarse = ev.pointerType === 'touch') {
  const d = PG.acc.drift;
  const svg = art && art.querySelector('.pg-drift-svg');
  if (!d || !svg) return null;
  const box = svg.getBoundingClientRect();
  if (!box.width) return null;
  const px = ev.clientX - box.left, py = ev.clientY - box.top;
  const k = box.width / 1000;
  const tol = coarse ? 22 : 5, reach = Math.ceil(tol / PG_DRIFT.pitch);
  const i0 = Math.round(py / PG_DRIFT.pitch);
  let best = null, bd = Infinity;
  for (let i = Math.max(0, i0 - reach); i <= Math.min(d.rows.length - 1, i0 + reach); i++) {
    const r = d.rows[i];
    const a = r.xs[0] * k, b = r.xs[r.xs.length - 1] * k;
    const dx = px < a ? a - px : px > b ? px - b : 0;
    const dy = pgDriftY(i) + 1 - py;
    const dist = dx * dx + dy * dy;
    if (dx <= tol && Math.abs(dy) <= tol && dist < bd) { bd = dist; best = r; }
  }
  return best;
}
function pgDriftLight(r, { readout = true, row = true } = {}) {
  const art = document.querySelector('[data-drift]');
  if (!art) return;
  const S = PG.acc;
  if (S.pointed && (!r || S.pointed !== r.a.id)) { const old = document.getElementById(`account-${S.pointed}`); if (old) old.classList.remove('is-pointed'); }
  const calls = $$('.pg-drift-call[data-id]', art);
  for (const c of calls) c.classList.toggle('is-pointed', !!r && c.dataset.id === r.a.id);
  /* Any other trail is named where the three are, at the right edge by its row, while they
     step back. */
  const named = !!r && calls.some(c => c.dataset.id === r.a.id);
  const hover = art.querySelector('.pg-drift-call--hover');
  if (hover) {
    const shown = !!r && !named;
    if (shown && hover.dataset.row !== r.a.id) {
      hover.style.setProperty('--y', `${(pgDriftY(r.i) + 0.5).toFixed(1)}px`);
      hover.firstElementChild.textContent = r.a.name || pgHandle(r.a);
      hover.lastElementChild.textContent = `${plural(r.ts.length, 'post')} · latest ${pgDriftDay(r.last).replace(/ /g, '\u00a0')}`;
      hover.dataset.row = r.a.id;
      hover.hidden = false;
      /* A stepped-back name that the hover name would print over gives way while it shows. */
      const hb = hover.getBoundingClientRect();
      for (const c of calls) { const cb = c.getBoundingClientRect(); c.classList.toggle('is-under', cb.top < hb.bottom + 4 && hb.top < cb.bottom + 4); }
    } else if (!shown && !hover.hidden) {
      hover.hidden = true;
      hover.removeAttribute('data-row');
      for (const c of calls) c.classList.remove('is-under');
    }
  }
  art.classList.toggle('is-hovering', !!r && !named);
  const hi = art.querySelector('.pg-drift-hi'), hd = art.querySelector('.pg-drift-hidots'), guide = art.querySelector('.pg-drift-guide');
  if (!r) { for (const el of [hi, hd, guide]) if (el) el.setAttribute('d', ''); S.pointed = ''; return; }
  const p = pgDriftRowPaths(r);
  if (guide) guide.setAttribute('d', `M0 ${pgDriftY(r.i) + 0.5}H1000`);
  if (hi) hi.setAttribute('d', p.trail);
  if (hd) hd.setAttribute('d', p.dots);
  S.pointed = r.a.id;
  const out = art.parentElement && art.parentElement.querySelector('[data-readout]');
  if (readout && out && out.dataset.id !== r.a.id) { out.innerHTML = pgDriftReadout(r); out.dataset.id = r.a.id; }
  const rowEl = row ? document.getElementById(`account-${r.a.id}`) : null;
  if (rowEl) rowEl.classList.add('is-pointed');
}
/* Pointing at the scan names a trail's account and a click opens its entry (a tap names it,
   and the readout's link opens it); pointing at or focusing one of the three accounts set
   out beneath lights its trail. */
function pgDriftWatch() {
  const holder = document.getElementById('account-who');
  if (!holder || holder.dataset.watched) return;
  holder.dataset.watched = 'true';
  /* As on the catalogue's band: a mouse click opens only the trail the readout names, the
     one the pointer was last aimed at, and nothing where none is named; a tap names. */
  let touch = false, aimedRow = null;
  const rowOf = id => (PG.acc.drift ? PG.acc.drift.rows.find(r => r.a.id === id) : null) || null;
  holder.addEventListener('pointerdown', ev => { touch = ev.pointerType === 'touch'; });
  holder.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'touch') return;
    const art = ev.target.closest && ev.target.closest('[data-drift]');
    aimedRow = art ? pgDriftHit(art, ev, false) : null;
    if (aimedRow) pgDriftLight(aimedRow);
    if (art) art.style.cursor = aimedRow ? 'pointer' : '';
  });
  holder.addEventListener('pointerleave', () => {
    aimedRow = null;
    const row = PG.acc.pointed && document.getElementById(`account-${PG.acc.pointed}`);
    if (row) row.classList.remove('is-pointed');
  });
  holder.addEventListener('click', ev => {
    const art = ev.target.closest && ev.target.closest('[data-drift]');
    if (!art) return;
    if (touch) { const r = pgDriftHit(art, ev, true); if (r) pgDriftLight(r); return; }
    const out = art.parentElement && art.parentElement.querySelector('[data-readout]');
    if (aimedRow && out && out.dataset.id === aimedRow.a.id) location.hash = `#accounts/${encodeURIComponent(aimedRow.a.id)}`;
  });
  const fromCard = ev => {
    const card = ev.target.closest && ev.target.closest('.pg-who-one[data-account]');
    if (card) pgDriftLight(rowOf(card.dataset.account), { row: false });
  };
  holder.addEventListener('focusin', fromCard);
  holder.addEventListener('pointerover', ev => { if (ev.pointerType !== 'touch') fromCard(ev); });
  /* The years beneath the scan are measured at its real width and text size. */
  const years = () => pgDriftYears(holder.querySelector('[data-drift]'));
  years();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(years, () => {});
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(years) : null;
  if (ro) ro.observe(holder);
  onLeave(() => { PG.acc.pointed = ''; if (ro) ro.disconnect(); });
}
/* A year that would touch its neighbour gives way: read from the shutter's opening back into
   the past, so the years nearest the plate's own time are the ones kept. */
function pgDriftYears(art) {
  if (!art || !art.isConnected) return;
  const years = $$('.pg-drift-year', art);
  for (const y of years) y.classList.remove('is-crowded');
  const opened = art.querySelector('.pg-drift-s');
  let edge = opened ? opened.getBoundingClientRect().left : Infinity;
  for (const y of years) {
    const b = y.getBoundingClientRect();
    if (!b.width) continue;
    if (b.right + 8 > edge) y.classList.add('is-crowded'); else edge = b.left;
  }
}
/* A featured account's strip, enlarged, with its axis named: the shutter's opening on the
   left (and how many of their posts came before it), tonight on the right. */
function pgWhoStrip(a, ep) {
  const posts = pgEvidence(a);
  const before = posts.filter(e => pgTime(e.publishedAt) < ep.t0).length;
  const opened = fmtDate(new Date(ep.t0).toISOString(), { short: true });
  return `<span class="pg-who-strip" aria-hidden="true">${pgStripHTML(posts, ep, { width: 240 })}<span class="pg-who-axis"><span>${esc(before ? `${fmtInt(before)} before ${opened}` : opened)}</span><span>Tonight</span></span></span>`;
}
function pgAccountsLede() {
  const all = state.accounts;
  const assessed = all ? all.filter(pgAssessed).length : null;
  return `<p>Public accounts whose posts lead to primary evidence: labs announcing releases, researchers publishing their work, builders reporting their own experiments. Each entry says why we watch it, and opens on what we saw there.</p>
<p class="pg-lede-quiet">${all ? `${esc(fmtInt(assessed))} of the ${esc(fmtInt(all.length))} accounts have been opened and assessed; the directory lists those first.` : 'The directory is a separate file; it is on its way.'}${state.accountsUpdatedAt ? ` Last updated ${esc(fmtDate(state.accountsUpdatedAt))}.` : ''}</p>`;
}
/* A platform as its group is headed: "On X", "On the web". */
const pgPlatformName = p => (/^web$/i.test(p) ? 'On the web' : `On ${p}`);
/* Platforms in the order of their size in the whole directory, then by name. */
function pgPlatformRanks() {
  const S = PG.acc;
  if (S.ranks && S.ranks.size && S.rankedFor === state.accounts) return S.ranks;
  const n = {};
  for (const a of state.accounts) n[a.platform || 'Web'] = (n[a.platform || 'Web'] || 0) + 1;
  S.ranks = new Map(Object.keys(n).sort((a, b) => n[b] - n[a] || collator.compare(a, b)).map((p, i) => [p, i]));
  S.rankedFor = state.accounts;
  return S.ranks;
}
function pgAccountResults() {
  const f = state.accountFilters;
  const key = JSON.stringify([f.q.trim().toLowerCase(), f.platform, f.status, state.accounts.length]);
  const S = PG.acc;
  if (S.key === key) return S.list;
  const words = queryWords(f.q);
  const ranks = pgPlatformRanks();
  const list = state.accounts.filter(a => (!f.platform || a.platform === f.platform) &&
    (f.status === 'all' || (f.status === 'assessed' || !f.status ? pgAssessed(a) : a.status === f.status)) &&
    (!words.length || words.every(w => a._hay.includes(w))));
  list.sort((a, b) => (ranks.get(a.platform || 'Web') ?? 99) - (ranks.get(b.platform || 'Web') ?? 99) || collator.compare(String(a.name || ''), String(b.name || '')));
  S.key = key;
  S.list = list;
  return list;
}
function pgAccountFacets() {
  const f = state.accountFilters;
  const words = queryWords(f.q);
  const platforms = {}, statuses = { assessed: 0, all: 0 };
  for (const a of state.accounts) {
    if (words.length && !words.every(w => a._hay.includes(w))) continue;
    const okStatus = f.status === 'all' || (f.status === 'assessed' || !f.status ? pgAssessed(a) : a.status === f.status);
    if (okStatus) platforms[a.platform] = (platforms[a.platform] || 0) + 1;
    if (!f.platform || a.platform === f.platform) {
      statuses.all++;
      if (pgAssessed(a)) statuses.assessed++;
      statuses[a.status] = (statuses[a.status] || 0) + 1;
    }
  }
  return { platforms, statuses };
}
function pgAccountPlatformOptions(counts) {
  const f = state.accountFilters;
  const list = counts ? Object.keys(counts).filter(p => counts[p] || p === f.platform) : [];
  if (f.platform && !list.includes(f.platform)) list.push(f.platform);
  list.sort((a, b) => ((counts && counts[b]) || 0) - ((counts && counts[a]) || 0) || collator.compare(a, b));
  return `<option value="">All platforms</option>${list.map(p => `<option value="${esc(p)}"${f.platform === p ? ' selected' : ''}>${esc(p)}${counts ? ` (${fmtInt(counts[p] || 0)})` : ''}</option>`).join('')}`;
}
function pgAccountStatusOptions(counts) {
  const f = state.accountFilters;
  const statuses = Object.keys(counts || {}).filter(k => k !== 'assessed' && k !== 'all').sort((a, b) => pgAccStatus(a)[2] - pgAccStatus(b)[2]);
  if (f.status && !['assessed', 'all'].includes(f.status) && !statuses.includes(f.status)) statuses.push(f.status);
  const n = k => (counts ? ` (${fmtInt(counts[k] || 0)})` : '');
  return `<option value="assessed"${f.status === 'assessed' || !f.status ? ' selected' : ''}>Assessed${n('assessed')}</option>` +
    `<option value="all"${f.status === 'all' ? ' selected' : ''}>Every account${n('all')}</option>` +
    statuses.map(k => `<option value="${esc(k)}"${f.status === k ? ' selected' : ''}>${esc(pgAccStatus(k)[0])} only${n(k)}</option>`).join('');
}
function pgAccountStrip() {
  const f = state.accountFilters;
  return `<form id="account-filters" class="pg-strip" role="search" aria-label="Search and filter the directory">
<div class="pg-ctl pg-ctl--search"><label class="pg-ctl-label" for="account-search">Search</label><input class="pg-input" id="account-search" name="q" type="search" autocomplete="off" spellcheck="false" data-search placeholder="Name, topic or what they publish" value="${esc(f.q)}"></div>
<div class="pg-ctl"><label class="pg-ctl-label" for="account-platform">Platform</label><select class="pg-select" id="account-platform" name="platform">${pgAccountPlatformOptions(state.accounts ? pgAccountFacets().platforms : null)}</select></div>
<div class="pg-ctl"><label class="pg-ctl-label" for="account-status">Status</label><select class="pg-select" id="account-status" name="status">${pgAccountStatusOptions(state.accounts ? pgAccountFacets().statuses : null)}</select></div>
</form>`;
}
/* An account's posts on the plate's own time axis: 120 px from the moment the shutter opened
   to tonight, where the hand stands. Each post on record is a 2 px tick of ink at the moment
   it was published; posts from before the opening gather into one small marker at the left
   edge, pointing back. Posts without a date are not drawn (the row's count says them). The
   strip is aria-hidden: the row's own words carry what matters. */
const pgEpoch = () => plateEpoch(state.entries || [], state.runsLight || state.runs || []);
function pgStripHTML(posts, ep, { width = 120 } = {}) {
  const W = width, x0 = 8, x1 = W - 6;
  const span = Math.max(1, ep.tNow - ep.t0);
  let ticks = '', before = 0;
  const seen = new Set();
  for (const e of posts) {
    const t = pgTime(e.publishedAt);
    if (!Number.isFinite(t)) continue;
    if (t < ep.t0) { before++; continue; }
    const x = Math.round(x0 + Math.min(1, (t - ep.t0) / span) * (x1 - x0 - 3)) + 1;
    if (seen.has(x)) continue;
    seen.add(x);
    ticks += `M${x} 3V13`;
  }
  return `<svg class="pg-strip-t" viewBox="0 0 ${W} 16" width="${W}" height="16" focusable="false">` +
    `<path class="pg-strip-axis" d="M${x0} 8.5H${x1}"/>` +
    (before ? `<path class="pg-strip-before" d="M5 5L1.5 8.5L5 12Z"/>` : '') +
    (ticks ? `<path class="pg-strip-tick" d="${ticks}"/>` : '') +
    `<path class="pg-strip-hand" d="M${W - 1.5} 0V16"/></svg>`;
}
/* One account, one line: number, name (the link to the profile), handle, what they are to us
   in plain words, their posts on the plate's time axis; a mark only where the status is not
   "specialist"; the platform is the group it is listed under. Why we watch them and what we
   saw open beneath. */
function pgAccountRow(a, { pinned = false } = {}) {
  const S = PG.acc;
  const [statusLabel, shape] = pgAccStatus(a.status);
  const evidence = pgEvidence(a);
  const name = a.name || pgHandle(a);
  return pgLineHTML({
    kind: 'account', id: a.id, n: S.numbers ? S.numbers.get(a.id) || 0 : 0, width: S.width, open: S.open.has(a.id),
    name: pgOut(a.url, name),
    host: `${esc(pgHandle(a))}${pinned ? ` · ${esc(a.platform || 'Web')}` : ''}`,
    extra: esc(pgLabel(a.editorialRole)),
    strip: pgStripHTML(evidence, S.ep || pgEpoch()),
    mark: a.status !== 'specialist' ? pgMark(shape, statusLabel) : '',
    toggle: `<button type="button" class="pg-toggle" data-action="pg-account" data-id="${esc(a.id)}" aria-expanded="${S.open.has(a.id)}" aria-controls="account-more-${esc(a.id)}"><span class="pg-toggle-label">${esc(plural(evidence.length, 'post'))}</span><span class="sr-only"> on record: ${esc(name)}</span></button>`,
    more: () => pgAccountDetail(a)
  });
}
function pgAccountDetail(a) {
  const evidence = pgEvidence(a);
  const access = a.access || {};
  const limits = Array.isArray(access.limitations) ? access.limitations.filter(Boolean) : [];
  const cadence = a.cadence && a.cadence.basis ? a.cadence.basis : '';
  const rate = a.cadence && num(a.cadence.ratePerWeek) !== null ? `About ${fmtInt(a.cadence.ratePerWeek)} relevant posts a week. ` : '';
  const topics = Array.isArray(a.topics) ? a.topics.filter(Boolean).map(pgWords) : [];
  const [statusLabel] = pgAccStatus(a.status);
  return `<div class="pg-acc-grid">
<section class="pg-acc-evidence" aria-label="Why we watch, and what we saw">
${a.whyMonitor ? `<p class="pg-acc-why">${esc(a.whyMonitor)}</p>` : ''}
${topics.length ? `<p class="pg-acc-topics"><span class="pg-mini">Topics</span> ${esc(topics.join(', '))}</p>` : ''}
<p class="pg-mini">What we saw</p>
${evidence.length ? `<ol class="pg-ev" role="list">${evidence.map(e => `<li><p class="pg-ev-text">${esc(e.observation || 'Observed post')}</p>${pgMeta([external(e.url, pgShortURL(e.url)), esc(e.publishedAt ? `posted ${fmtDate(e.publishedAt)}` : 'posting date not established'), esc(e.observedAt ? `seen ${fmtDate(e.observedAt)}` : 'seen date not recorded')], 'pg-ev-meta')}</li>`).join('')}</ol>` : '<p class="pg-ev-text">No individual posts were recorded for this account.</p>'}
</section>
<section class="pg-acc-limits" aria-label="Limits of what we know"><p class="pg-mini">Limits of what we know</p>
<dl class="pg-dl">
<div><dt>Profile</dt><dd>${external(a.url, pgHandle(a))}${a.platform ? ` on ${esc(a.platform)}` : ''}</dd></div>
<div><dt>Status</dt><dd>${esc(statusLabel)}${a.lastAssessedAt ? `, assessed ${esc(fmtDate(a.lastAssessedAt))}` : ', not yet assessed'}.</dd></div>
<div><dt>Entrypoint</dt><dd>${access.entrypointInspected ? 'Opened and read' : 'Not opened yet'}${access.coverageComplete ? '; complete coverage recorded' : '; coverage is not complete'}.</dd></div>
${cadence || rate ? `<div><dt>Posting rate</dt><dd>${esc(`${rate}${cadence}`)}</dd></div>` : ''}
${a.lastObservedAt ? `<div><dt>Last observed</dt><dd>${esc(fmtDate(a.lastObservedAt, { time: true }))}</dd></div>` : ''}
</dl>
${limits.length ? `<ul class="pg-limits-list" role="list">${limits.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
<p class="pg-permalink"><a href="#accounts/${esc(encodeURIComponent(a.id))}">Link to this entry</a></p>
</section>
</div>`;
}
function pgAccountCount(results) {
  const f = state.accountFilters;
  if (!state.accounts) return 'Loading the directory…';
  const parts = [];
  parts.push(f.status === 'all' ? 'every account' : f.status === 'assessed' || !f.status ? 'assessed' : `${pgAccStatus(f.status)[0].toLowerCase()} only`);
  if (f.platform) parts.push(`on ${f.platform}`);
  if (f.q.trim()) parts.push(`matching “${esc(f.q.trim())}”`);
  return `<strong>${esc(fmtInt(results.length))}</strong> of ${esc(plural(state.accounts.length, 'account'))} <span class="pg-count-note">${parts.join(', ')}</span>`;
}
function pgAccountEmpty() {
  const f = state.accountFilters;
  const ways = [];
  if (f.q.trim()) ways.push('<button type="button" class="pg-act" data-action="pg-clear-search" data-list="accounts">Clear the search</button>');
  if (f.platform || f.status !== 'all') ways.push('<button type="button" class="pg-act" data-action="pg-reset" data-list="accounts">Show every account</button>');
  return `<div class="pg-empty"><p class="pg-empty-line">No account matches.</p><p>Try a name, a handle or a topic such as “robotics”.</p><div class="pg-empty-ways">${ways.join('')}</div></div>`;
}
function pgDrawAccounts() {
  const listEl = document.getElementById('account-list');
  if (!listEl) return;
  const S = PG.acc;
  const count = document.getElementById('account-count');
  if (!state.accounts) { if (count) count.innerHTML = pgAccountCount([]); return; }
  const results = pgAccountResults();
  const plan = pgPlan(results, a => a.platform || 'Web');
  const pages = plan.length;
  S.page = clamp(S.page, 1, pages);
  const [from, until] = plan[S.page - 1];
  const slice = results.slice(from, until);
  S.ep = pgEpoch();
  let html = '';
  if (!slice.length) html = pgAccountEmpty();
  else {
    const perPlatform = {}, posts = {};
    for (const a of results) {
      const p = a.platform || 'Web';
      perPlatform[p] = (perPlatform[p] || 0) + 1;
      (posts[p] || (posts[p] = [])).push(...pgEvidence(a));
    }
    let platform = null;
    slice.forEach((a, i) => {
      const p = a.platform || 'Web';
      if (p !== platform) {
        if (platform !== null) html += '</ol>';
        platform = p;
        const cont = i === 0 && from > 0 && (results[from - 1].platform || 'Web') === p;
        /* The group's head carries all its accounts' posts on the same axis, aligned over the
           strips of its rows: the platform's light curve. */
        html += `<h3 class="pg-group pg-group--acc"><span class="pg-group-name">${esc(pgPlatformName(p))}</span><span class="pg-group-n">${cont ? 'continued · ' : ''}${esc(plural(perPlatform[p], 'account'))}</span><span class="pg-group-strip" aria-hidden="true">${pgStripHTML(posts[p], S.ep)}</span></h3><ol class="pg-lines" role="list">`;
      }
      html += pgAccountRow(a);
    });
    html += '</ol>';
  }
  listEl.innerHTML = html;
  listEl.setAttribute('aria-busy', 'false');
  if (count) count.innerHTML = pgAccountCount(results);
  const pin = S.pin ? state.accounts.find(a => a.id === S.pin) : null;
  const pinEl = document.getElementById('account-pin');
  if (pinEl) pinEl.innerHTML = pin ? pgPinHTML('account', pin, pgAccountRow(pin, { pinned: true }), pgAccountPinWhy(pin)) : '';
  const note = document.getElementById('account-notice');
  if (note) note.innerHTML = S.note ? `<p class="pg-notice" tabindex="-1">${esc(S.note)}</p>` : '';
  const pager = document.getElementById('account-pager');
  if (pager) pager.innerHTML = pgPager('accounts', S.page, plan, results.length, 'directory');
  const form = document.getElementById('account-filters');
  if (form) {
    const facets = pgAccountFacets();
    const active = document.activeElement;
    if (form.elements.platform && form.elements.platform !== active) form.elements.platform.innerHTML = pgAccountPlatformOptions(facets.platforms);
    if (form.elements.status && form.elements.status !== active) form.elements.status.innerHTML = pgAccountStatusOptions(facets.statuses);
  }
}
function pgAccountPinWhy(a) {
  const f = state.accountFilters;
  const why = [];
  if (f.status !== 'all') {
    if ((f.status === 'assessed' || !f.status) && !pgAssessed(a)) why.push(`its status is ${pgAccStatus(a.status)[0].toLowerCase()}, not assessed`);
    else if (f.status !== 'assessed' && f.status && a.status !== f.status) why.push(`its status is ${pgAccStatus(a.status)[0].toLowerCase()}`);
  }
  if (f.platform && a.platform !== f.platform) why.push(`it is on ${a.platform}`);
  if (f.q.trim() && !queryWords(f.q).every(w => a._hay.includes(w))) why.push('it does not match the search');
  return why.length ? `Outside the current view: ${why.join(', ')}.` : 'Opened from a link.';
}
function pgAccountRoute(id, { focus = false, entering = false } = {}) {
  const S = PG.acc;
  const was = S.want;
  S.want = id || '';
  if (!state.accounts) return;
  S.note = '';
  if (!id) {
    const back = was ? S.back : null;
    S.back = null;
    S.pin = '';
    if (back) { S.page = back.page; if (!back.open) S.open.delete(back.id); }
    pgDrawAccounts();
    if (back) pgBackTo(back);
    return;
  }
  if (!was && !entering) S.back = pgBackFrom(S, id);
  const a = state.accounts.find(x => x.id === id);
  if (!a) {
    S.pin = '';
    S.note = `No account with the address #accounts/${id} is in this directory. It may have been merged or renamed; the directory is below.`;
    pgDrawAccounts();
    pgReveal('account-notice', { focus: focus ? '.pg-notice' : null, entering });
    announce(S.note);
    return;
  }
  S.open.add(id);
  const results = pgAccountResults();
  const at = results.indexOf(a);
  if (at >= 0) { S.pin = ''; S.page = pgPageOf(pgPlan(results, x => x.platform || 'Web'), at); } else S.pin = id;
  pgDrawAccounts();
  pgReveal(`account-${id}`, { focus: focus ? '.pg-line-name a' : null, scrollTo: S.pin ? 'account-pin' : '', entering });
}
function pgAccountsReady() {
  const S = PG.acc;
  if (!S.numbers || S.numbers.size !== state.accounts.length) {
    S.numbers = new Map(state.accounts.map((a, i) => [a.id, i + 1]));
    S.width = Math.max(3, String(state.accounts.length).length);
    S.key = '';
  }
  const who = document.getElementById('account-who');
  if (who) who.innerHTML = pgAccountsWho();
  const lede = document.querySelector('.pg--accounts .pg-lede');
  if (lede) lede.innerHTML = pgAccountsLede();
  pgDriftWatch();
  pgDriftYears(document.querySelector('[data-drift]'));
  pgAccountRoute(S.want, { focus: true, entering: true });
}
function pgAccountsFailed(error) {
  const listEl = document.getElementById('account-list');
  if (!listEl) return;
  listEl.setAttribute('aria-busy', 'false');
  listEl.innerHTML = `<div class="pg-empty"><p class="pg-empty-line">The directory did not arrive.</p><p>${error && error.name === 'NotFoundError' ? 'This edition was published without its account directory.' : 'It is a separate file, and it could not be loaded just now.'}</p><div class="pg-empty-ways"><button type="button" class="pg-act" data-action="retry">Try again</button><a class="pg-act" href="#sources">Browse the source catalogue</a></div></div>`;
  const count = document.getElementById('account-count');
  if (count) count.textContent = 'The account directory could not be loaded.';
  const who = document.getElementById('account-who');
  if (who) who.innerHTML = '';
  announce('The directory did not arrive. Use Try again to load it.');
}
function renderAccounts(route, token) {
  const S = PG.acc;
  S.pin = '';
  S.note = '';
  S.want = route.id || '';
  app.innerHTML = `<div class="pg pg--accounts">
${pgHead({ kind: 'accounts', eyebrow: pgEyebrow(['AI accounts', 'The directory']), title: 'The people and teams we watch', aside: `<div class="pg-lede">${pgAccountsLede()}</div>`, after: `<div class="pg-who-holder" id="account-who">${pgAccountsWho()}</div>` })}
<section class="pg-cat" aria-labelledby="account-results-title">
${pgAccountStrip()}
<div class="pg-cat-head"><h2 class="pg-cat-title" id="account-results-title">Entries</h2><p id="account-count" class="pg-count" tabindex="-1">${pgAccountCount([])}</p><p class="pg-cat-key">By platform, then by name; numbers are directory order. Each name opens the public profile <span aria-hidden="true">↗</span>; a target <span class="pg-key-glyph">${pgGlyph('target')}</span> marks a verified account, a ring <span class="pg-key-glyph">${pgGlyph('ring')}</span> one still provisional.</p></div>
<div id="account-notice"></div>
<div id="account-pin"></div>
<div id="account-list" class="pg-list" aria-busy="true">${pgGhosts(10)}<p class="sr-only">Loading the directory.</p></div>
<div id="account-pager"></div>
</section>
</div>`;
  pgWireFilters('account-filters', 'accounts');
  pgStickyStrip(document.getElementById('account-filters'));
  onSubroute(next => { pgAccountRoute(next.id, { focus: true }); return true; });
  if (state.accounts) { pgAccountsReady(); return; }
  loadAccounts().then(() => { if (isCurrent(token)) pgAccountsReady(); }, error => { if (isCurrent(token)) pgAccountsFailed(error); });
}

/* =================================================================== EDITIONS */
/* A scan that finished counts as an edition. The plate (20-plate.js) and the library's
   "Edition k" (30-library.js) count the same way, so the three always agree; a scan that did
   not finish keeps its place in the logbook under its status, without a number. */
const pgFinished = run => !run.status || /complete|success|finished|published/i.test(String(run.status));
/* Each scan owns the window from its start to the next scan's start: a report belongs to
   the scan in whose window it was first found (the day its trail begins on the plate), and
   is counted as revised under the scan that last revised it. */
function pgEditions() {
  const source = state.runsLight && state.runsLight.length ? state.runsLight : (state.runs || []);
  const runs = source.filter(r => r && Number.isFinite(pgTime(r.startedAt || r.finishedAt)))
    .slice().sort((a, b) => pgTime(a.startedAt || a.finishedAt) - pgTime(b.startedAt || b.finishedAt));
  const eds = runs.map((run, i) => ({ run, i, n: 0, t0: pgTime(run.startedAt || run.finishedAt), t1: i + 1 < runs.length ? pgTime(runs[i + 1].startedAt || runs[i + 1].finishedAt) : Infinity, found: [], revised: [] }));
  if (!eds.length) return eds;
  const counted = eds.some(x => pgFinished(x.run)) ? eds.filter(x => pgFinished(x.run)) : eds;
  counted.forEach((x, k) => { x.n = k + 1; });
  for (const e of state.entries || []) {
    const t = pgTime(e.discoveredAt || e.publishedAt);
    let home = null;
    if (Number.isFinite(t)) {
      home = eds.find(x => t >= x.t0 && t < x.t1) || (t < eds[0].t0 ? eds[0] : null);
      if (home) home.found.push(e);
    }
    const u = pgTime(e.updatedAt);
    if (Number.isFinite(u) && Number.isFinite(t) && u - t > 36e5) {
      const ed = eds.find(x => u >= x.t0 && u < x.t1);
      if (ed && ed !== home) ed.revised.push(e);
    }
  }
  return eds;
}
const pgClock = value => { const text = fmtDate(value, { time: true }); return text.includes(', ') ? text.split(', ').pop() : ''; };
function pgScanSpan(run) {
  const a = run.startedAt, b = run.finishedAt;
  if (!a && !b) return '';
  if (!a || !b) return `${fmtDate(a || b, { short: true })}, ${pgClock(a || b)}`;
  return fmtDate(a) === fmtDate(b) ? `${pgClock(a)}–${pgClock(b)}` : `${fmtDate(a, { short: true })}, ${pgClock(a)} – ${fmtDate(b, { short: true })}, ${pgClock(b)}`;
}
const pgRunId = ed => String(ed.run.id || `scan-${ed.i + 1}`);
/* The moment a frame is taken: when its scan finished, or later if a report it found was
   recorded after that, so every new star of the night is on its frame. */
function pgFrameTime(ed) {
  const times = [pgTime(ed.run.finishedAt || ed.run.startedAt), ...ed.found.map(e => pgTime(e.discoveredAt || e.publishedAt))].filter(Number.isFinite);
  return times.length ? Math.max(...times) : NaN;
}
const pgNewIds = ed => new Set(ed.found.map(e => e.id));
/* How many trails the plate held that night: the reports found by the moment its frame was taken. */
function pgOnPlate(ed) {
  const t = pgFrameTime(ed);
  return (state.entries || []).filter(e => { const f = pgTime(e.discoveredAt || e.publishedAt); return Number.isFinite(f) && f <= t + 432e5; }).length;
}
/* The contact sheet: the plate as it stood after every scan, oldest first, printed side by
   side on strips of film. Read across, it is the exposure itself: the meridian advances like
   a clock hand, the trails lengthen behind it, and each night's new reports appear on it as
   new stars. Every frame opens its entry in the log; the last frame is the next, unexposed. */
function pgSheetHTML(eds) {
  if (!eds.length || !(state.entries || []).length) return '';
  const cells = eds.map(ed => {
    const id = pgRunId(ed);
    const when = ed.run.finishedAt || ed.run.startedAt;
    const n = ed.found.length;
    const name = `${ed.n ? `Edition ${ed.n}` : `Scan (${pgLabel(ed.run.status).toLowerCase()})`}, ${fmtDate(when)}`;
    return `<li class="pg-sheet-cell" style="--i:${ed.i}"><a class="pg-sheet-frame" href="#editions/${esc(encodeURIComponent(id))}" aria-label="${esc(`${name}: ${n ? plural(n, 'new report') : 'no new report'}. Open its entry in the log.`)}">
<span class="pg-sheet-art" aria-hidden="true">${plateFrame({ asOf: pgFrameTime(ed), newIds: pgNewIds(ed), size: 168 })}</span>
<span class="pg-sheet-edge" aria-hidden="true"><span class="pg-sheet-no">${ed.n ? esc(pgPad(ed.n, 2)) : '—'}</span><span class="pg-sheet-day">${esc(fmtDate(when, { short: true }))}</span><span class="pg-sheet-new">${n ? `+${esc(fmtInt(n))}` : ''}</span></span>
</a></li>`;
  });
  const m = state.meta || {};
  const counted = eds.filter(x => x.n).length;
  if (m.nextScanAt && m.enabled !== false) {
    cells.push(`<li class="pg-sheet-cell pg-sheet-cell--next" style="--i:${eds.length}"><span class="pg-sheet-frame">
<span class="pg-sheet-art" aria-hidden="true"><svg class="pg-sheet-blank" viewBox="0 0 168 168" width="168" height="168" focusable="false"><circle cx="84" cy="84" r="80"/><line x1="84" y1="84" x2="84" y2="2"/></svg></span>
<span class="pg-sheet-edge" aria-hidden="true"><span class="pg-sheet-no">${esc(pgPad(counted + 1, 2))}</span><span class="pg-sheet-day">${esc(fmtDate(m.nextScanAt, { short: true }))}</span><span class="pg-sheet-new">next</span></span>
<span class="sr-only">The next frame is not yet exposed: the next scan is expected after ${esc(fmtDate(m.nextScanAt, { time: true }))}.</span>
</span></li>`);
  }
  return `<section class="pg-sheet" aria-labelledby="sheet-title">
<div class="pg-sheet-head"><h2 class="pg-sheet-title" id="sheet-title">The contact sheet</h2><p class="pg-sheet-key">One frame per scan, oldest first: the plate as it stood that night, its new reports drawn as stars on the hand, split <span class="pg-run-a">cool</span> and <span class="pg-run-b">warm</span> where the two runs differ. Read across, it is the exposure. A frame shows every report found by that night, including those published in later scans.</p></div>
<ol class="pg-sheet-strip" role="list">${cells.join('')}</ol>
</section>`;
}
/* The log keeps two clocks, and names both: the reports first found on a night (the trails
   that begin there, some published in later scans), and what the scan published, with the
   library it left behind. Published is this scan's library less the one before it. */
function pgPublished(ed, eds) {
  const b = v => `<b>${esc(fmtInt(v))}</b>`;
  const count = num(ed.run.publishedCount);
  if (count === null) return [];
  let before = ed.i === 0 ? 0 : null;
  for (let i = ed.i - 1; i >= 0 && before === null; i--) before = eds[i] ? num(eds[i].run.publishedCount) : null;
  const added = before === null ? null : count - before;
  return [added === null || added < 0 ? '' : added ? `${b(added)} published` : 'none published', `library ${b(count)} after this scan`];
}
/* One scan in the log: its frame enlarged, the date, what the night added (each new report
   with its spectrum), the counts on one line, the operator's note, the limitations folded. */
function pgEditionHTML(ed, eds = []) {
  const { run, n, found, revised } = ed;
  const id = pgRunId(ed);
  const when = run.finishedAt || run.startedAt;
  const iso = isoDate(when);
  const year = iso ? iso.slice(0, 4) : '';
  const zone = String((state.meta && state.meta.timezone) || 'UTC').replace(/_/g, ' ');
  const limits = num(run.limitationCount) ?? (Array.isArray(run.limitations) ? run.limitations.length : 0);
  const sorted = found.slice().sort((a, b) => (num(b.score) ?? 0) - (num(a.score) ?? 0) || collator.compare(a.title || '', b.title || ''));
  const b = v => `<b>${esc(fmtInt(v))}</b>`;
  const failed = num(run.sourcesFailed);
  const counts = [
    num(run.sourcesChecked) !== null ? `${b(run.sourcesChecked)} sources checked` : '',
    failed ? `${b(failed)} failed` : failed === 0 ? 'none failed' : '',
    num(run.candidatesFound) !== null ? `${b(run.candidatesFound)} candidates read` : '',
    `${b(found.length)} first found this night`,
    revised.length ? `${b(revised.length)} revised` : '',
    ...pgPublished(ed, eds)
  ];
  const span = pgScanSpan(run);
  const seen = run.windowStart && run.windowEnd ? `looked back to ${fmtDate(run.windowStart, { short: true })}` : '';
  return `<article class="pg-ed" id="${esc(id)}" aria-labelledby="${esc(id)}-title">
<div class="pg-ed-frame"><div class="pg-ed-print night-print">${plateFrame({ asOf: pgFrameTime(ed), newIds: pgNewIds(ed), size: 216 })}</div>${pgMeta([n ? `Frame ${esc(pgPad(n, 2))}` : 'Frame —', esc(plural(pgOnPlate(ed), 'trail'))], 'pg-ed-frame-cap')}</div>
<div class="pg-ed-main">
${pgMeta([n ? `Edition ${esc(fmtInt(n))}` : 'Scan', run.status && !pgFinished(run) ? esc(pgLabel(run.status)) : '', esc(span), esc(zone)], 'pg-ed-no')}
<h3 class="pg-ed-date" id="${esc(id)}-title"><time datetime="${esc(iso)}">${esc(fmtDate(when, { short: true }))}</time> <span class="pg-ed-year">${esc(year)}</span></h3>
${sorted.length ? `<section class="pg-ed-new" aria-label="What this scan added"><p class="pg-mini">${esc(capitalise(numberWords(sorted.length)))} new ${sorted.length === 1 ? 'trail' : 'trails'}</p><ul role="list">${sorted.map(pgTrailHTML).join('')}</ul></section>` : '<p class="pg-ed-none">No new trail began in this scan.</p>'}
${pgMeta([...counts, esc(seen)].filter(Boolean), 'pg-ed-counts')}
${pgNoteHTML(run.coverageNote)}
${limits ? `<details class="pg-ed-limits" data-run="${esc(id)}"><summary><span class="pg-sum-text">${esc(plural(limits, 'recorded limitation'))}</span></summary><div class="pg-ed-limits-body" data-run-body="${esc(id)}"><p class="pg-wait">Loading the limitations…</p></div></details>` : ''}
</div>
</article>`;
}
/* The operator's note, folded to its first sentence: the counts line above is the entry's
   one-line summary, and the note is there for whoever wants the working. */
function pgNoteHTML(note) {
  const text = pgWords(note);
  if (!text) return '';
  const m = text.match(/^(.+?[.!?])\s+(?=[A-Z0-9“"‘(])([\s\S]+)$/);
  const first = m ? m[1] : text, rest = m ? m[2].trim() : '';
  const head = `<span class="pg-ed-note-label">Operator’s note:</span> ${esc(first)}`;
  return rest
    ? `<details class="pg-ed-note"><summary><span class="pg-sum-text">${head}</span></summary><p>${esc(rest)}</p></details>`
    : `<p class="pg-ed-note pg-ed-note--one">${head}</p>`;
}
/* A report in a list outside the library: its title, then its readout as the library reads
   it — spectrum, score, agreement (the spectrum speaks the agreement, so the line is not
   read twice). */
function pgTrailHTML(e) {
  const split = runsOf(e).differing > 0;
  return `<li class="pg-trail"><a class="pg-trail-link" href="${esc(reportURL(e.id))}">${esc(e.title || e.id)}</a><span class="pg-trail-read">${spectrum(e)}<span class="pg-trail-score"><span class="sr-only">Rated </span>${esc(fmtScore(e.score, '–'))}</span></span><span class="agreement${split ? ' is-split' : ''}" aria-hidden="true">${esc(agreementSentence(e))}</span></li>`;
}
function pgLimitsHTML(full) {
  const items = Array.isArray(full && full.limitations) ? full.limitations.filter(Boolean).map(String) : [];
  if (!items.length) return '<p>No limitations were recorded for this scan.</p>';
  const general = [], per = [];
  for (const text of items) {
    const m = text.match(/^([a-z0-9]+(?:-[a-z0-9]+)+):\s+([\s\S]+)$/);
    if (m) per.push([m[1], m[2]]); else general.push(text);
  }
  return `${general.length ? `<p class="pg-mini">The whole scan ${pgSep} ${esc(fmtInt(general.length))}</p><ul class="pg-limits-list" role="list">${general.map(t => `<li>${esc(pgWords(t))}</li>`).join('')}</ul>` : ''}
${per.length ? `<details class="pg-ed-per"><summary><span class="pg-sum-text">Source by source ${pgSep} ${esc(fmtInt(per.length))}</span></summary><ul class="pg-limits-list pg-limits-list--per" role="list">${per.map(([sid, t]) => `<li><a class="pg-limit-id" href="#sources/${esc(encodeURIComponent(sid))}">${esc(sid)}</a> ${esc(pgWords(t))}</li>`).join('')}</ul></details>` : ''}`;
}
function pgFillLimits(failed = false) {
  for (const body of $$('[data-run-body]', app)) {
    const details = body.closest('details');
    if (!details || !details.open || body.dataset.filled === 'true') continue;
    if (failed) { body.innerHTML = '<p class="pg-wait">The limitations could not be loaded. <button type="button" class="pg-act" data-action="retry">Try again</button></p>'; continue; }
    if (!state.runs) continue;
    const full = state.runs.find(r => r && String(r.id) === body.dataset.runBody);
    body.innerHTML = full ? pgLimitsHTML(full) : '<p>The full record of this scan is not in this edition’s files.</p>';
    body.dataset.filled = 'true';
  }
}
/* The first time the sheet comes into view, its frames develop one after another, oldest
   first, the way the exposure was made. Only where motion is allowed; without the observer,
   or once it has played, every frame is simply there. */
function pgDevelop(sheet) {
  if (!sheet || motionReduced() || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver(seen => {
    if (!seen.some(s => s.isIntersecting)) return;
    io.disconnect();
    sheet.classList.add('is-developing');
    setTimeout(() => sheet.classList.remove('is-developing'), 2600);
  }, { threshold: 0.2 });
  io.observe(sheet);
  onLeave(() => io.disconnect());
}
function pgEditionRoute(id, { focus = false, entering = false } = {}) {
  const old = document.getElementById('edition-notice');
  if (old) old.remove();
  if (!id) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (focus) focusHeading();
    return;
  }
  const target = document.getElementById(id);
  if (target && app.contains(target)) {
    if (focus && !entering) scrollToAnchor(id);
    else requestAnimationFrame(() => requestAnimationFrame(() => scrollToAnchor(id, { focus: focus && pgOnHeading() })));
    return;
  }
  const text = `No scan with the address #editions/${id} is in this logbook. The contact sheet above lists every scan.`;
  const notice = `<div id="edition-notice" class="pg-notice" role="status" tabindex="-1">${esc(text)}</div>`;
  const log = app.querySelector('.pg-log-wrap');
  if (log) log.insertAdjacentHTML('beforebegin', notice);
  else { const page = app.querySelector('.pg--editions'); if (page) page.insertAdjacentHTML('beforeend', notice); }
  pgReveal('edition-notice', { focus: focus || null, entering });
  announce(text);
}
function renderEditions(route, token) {
  const eds = pgEditions();
  const m = state.meta || {};
  const interval = num(m.intervalHours);
  const first = eds[0];
  const lede = `<p>Every ${interval ? `${esc(fmtInt(interval))} hours` : 'few days'} the observatory checks its watched entrypoints, reads what is new and writes up what deserves a report. Each scan is bounded, and is recorded here with what it covered, what it found and what it could not see.</p>`;
  app.innerHTML = `<div class="pg pg--editions">
${pgHead({ kind: 'editions', eyebrow: pgEyebrow(['Editions', first ? `Since ${fmtDate(first.run.startedAt || first.run.finishedAt)}` : '']), title: 'The logbook', aside: `<div class="pg-lede">${lede}</div>`, after: pgSheetHTML(eds) })}
${eds.length ? `<section class="pg-log-wrap" aria-labelledby="log-title"><h2 class="pg-log-title" id="log-title">The log <span>newest first</span></h2><ol class="pg-log" role="list">${eds.slice().reverse().map(ed => `<li class="pg-log-item">${pgEditionHTML(ed, eds)}</li>`).join('')}</ol></section>`
    : '<div class="pg-empty"><p class="pg-empty-line">The first scan has not finished.</p><p>Its entry will appear here, with what it covered and what it could not see.</p><div class="pg-empty-ways"><a class="pg-act" href="#method">How the instrument works</a></div></div>'}
</div>`;
  pgDevelop(document.querySelector('.pg-sheet'));
  /* #editions/<id>: that scan's entry, or, for an address that names no scan, a notice where
     the log begins, said out loud. Never adds a history entry. */
  onSubroute(next => { pgEditionRoute(next.id, { focus: true }); return true; });
  if (route.id) pgEditionRoute(route.id, { focus: true, entering: true });
  let failed = false;
  for (const details of $$('details[data-run]', app)) details.addEventListener('toggle', () => { if (details.open) pgFillLimits(failed); });
  if (!state.runs) {
    loadRuns().then(() => { if (isCurrent(token)) pgFillLimits(); }, () => { failed = true; if (isCurrent(token)) pgFillLimits(true); });
  }
}

/* ===================================================================== METHOD */
/* The worked example: the report whose two runs disagree on the most dimensions. */
function pgExample() {
  const all = state.entries || [];
  return all.slice().sort((a, b) => runsOf(b).differing - runsOf(a).differing || (num(b.score) ?? 0) - (num(a.score) ?? 0) || String(b.discoveredAt || '').localeCompare(String(a.discoveredAt || '')))[0] || null;
}
function pgSection(id, no, title, body, { wide = false } = {}) {
  return `<section class="pg-sec${wide ? ' pg-sec--wide' : ''}" id="${id}" aria-labelledby="${id}-title">
<header class="pg-sec-head"><p class="pg-sec-no" aria-hidden="true">${no}</p><h2 class="pg-sec-title" id="${id}-title">${title}</h2></header>
<div class="pg-sec-body">${body}</div>
</section>`;
}
/* The plate in miniature: every trail, three of them lit and numbered at their heads, the
   rating rings drawn beneath. The geometry is the mini-dial's own (10-marks.js): centre
   size/2, rim size/2 − 8, pole at 0.17 of the rim. */
function pgMethodPlate() {
  const all = state.entries || [];
  if (!all.length) return '<p>The plate is still dark: no report has been published yet.</p>';
  const size = 320, c = size / 2, rMax = size / 2 - 8, rMin = rMax * 0.17;
  const ties = plateTies(all);
  const best = all.slice().sort((a, b) => (num(b.score) ?? 0) - (num(a.score) ?? 0) || String(b.discoveredAt || '').localeCompare(String(a.discoveredAt || '')))[0];
  const newest = sortEntries(all, 'latest')[0];
  const picks = [];
  for (const [e, kind] of [[best, 'Highest rated'], [pgExample(), 'Runs differ most'], [newest, 'Newest']]) if (e && !picks.some(p => p.e.id === e.id)) picks.push({ e, kind });
  for (const p of picks) p.y = c - (plateRadius(p.e.score, rMin, rMax) + (ties.get(p.e.id) || 0) * (size / 220));
  picks.sort((a, b) => a.y - b.y);
  let lastY = -Infinity, step = 0;
  for (const p of picks) { step = p.y - lastY < 13 ? step + 1 : 0; p.x = c - 12 - step * 12; lastY = p.y; }
  const wedge = PLATE.now + (Math.PI * 2 - PLATE.sweep) * 0.86;
  let rings = '';
  for (let k = 4; k <= 8; k++) {
    const r = plateRadius(k, rMin, rMax);
    rings += `<circle class="${k === 6 ? 'pg-ring pg-ring--mid' : 'pg-ring'}" cx="${c}" cy="${c}" r="${r.toFixed(2)}"/><text class="pg-ring-n" x="${(c + Math.cos(wedge) * r).toFixed(1)}" y="${(c + Math.sin(wedge) * r + 3.5).toFixed(1)}">${k}</text>`;
  }
  const marks = picks.map((p, i) => `<text class="pg-mark-n" x="${p.x.toFixed(1)}" y="${(p.y + 3.8).toFixed(1)}">${i + 1}</text>`).join('');
  const opened = fmtDate(new Date(plateEpoch(all, state.runsLight || state.runs || []).t0).toISOString());
  return `<p>Every report this observatory has written is a trail of light on one long exposure. The shutter opened on <b>${esc(opened)}</b>, the day of the first scan. A trail begins on the day its report was found and ends tonight, at twelve o’clock.</p>
<p>Its distance from the pole is its rating: the rings mark 4 to 8, higher further out. Its weight is the length of the read: on the full plate, the longer a report takes to read, the heavier its trail and the larger the star at its head, so a heavy trail is a long read, not a better one. Where the two reviewer runs disagreed on any dimension, the trail is doubled: <span class="pg-run-a">run A</span> on the inside, <span class="pg-run-b">run B</span> on the outside, set further apart the more dimensions they disagreed on. Run A is drawn in the cool colour and run B in the warm one; under night vision, the lighter and the darker red.</p>
<figure class="pg-dialfig">
<div class="pg-dialfig-art night-print">
<svg class="pg-dial-rings" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" focusable="false">${rings}</svg>
${miniDial(null, { size, highlight: new Set(picks.map(p => p.e.id)) })}
<svg class="pg-dial-marks" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" focusable="false">${marks}</svg>
<span class="pg-dial-tonight" aria-hidden="true">Tonight</span>
</div>
<ol class="pg-legend" role="list">${picks.map((p, i) => `<li><span class="pg-legend-n" aria-hidden="true">${i + 1}</span><span class="pg-legend-kind">${esc(p.kind)}</span><a class="pg-legend-name" href="${esc(reportURL(p.e.id))}">${esc(p.e.title || p.e.id)}</a><span class="pg-legend-meta">${spectrum(p.e)}<span class="pg-legend-score"><span class="sr-only">Rated </span>${esc(fmtScore(p.e.score, '–'))}</span><span class="agreement${runsOf(p.e).differing ? ' is-split' : ''}" aria-hidden="true">${esc(agreementSentence(p.e))}</span></span></li>`).join('')}</ol>
<figcaption>The plate in miniature: all ${esc(fmtInt(all.length))} trails, ${esc(numberWords(picks.length))} of them lit and numbered. A miniature draws every trail at one weight; the full plate, which opens <a href="#index">the library</a>, weighs each by its reading time.</figcaption>
</figure>`;
}
function pgMethodSpectrum() {
  const e = pgExample();
  if (!e) return '<p>The spectrum appears once a report has been rated.</p>';
  const r = runsOf(e);
  const reading = r.dims.map(d => (d.a === d.b ? `${d.label} ${d.a ?? '–'} from both runs` : `${d.label} ${d.a ?? '–'} from run A and ${d.b ?? '–'} from run B`));
  return `<p>Every report also carries its spectrum: five lines, one per dimension, in the rubric’s order. <span class="pg-run-a">Run A</span> rises from the axis to its score; <span class="pg-run-b">run B</span> falls from it to its score. Where they agree, the halves meet in one unbroken stroke of ink. Where they disagree, the halves shift apart sideways, so a disagreement is visible at a glance and never averaged out of sight.</p>
<figure class="pg-specfig">
<div class="pg-specfig-art"><p class="pg-specfig-keys" aria-hidden="true"><span class="pg-key-a">Run A ↑</span><span class="pg-key-b">Run B ↓</span></p>${spectrum(e, { size: 'hero' })}</div>
<figcaption><a href="${esc(reportURL(e.id))}">${esc(e.title || e.id)}</a>: ${esc(reading.join('; '))}. <span class="agreement${r.differing ? ' is-split' : ''}">${esc(agreementSentence(e))}</span></figcaption>
</figure>`;
}
function pgMethodDims() {
  const all = state.entries || [];
  const x = s => 6 + ((s - 1) / 9) * 188;
  const items = DIMENSIONS.map((d, i) => {
    const v = all.map(e => num(e.scores && e.scores[d.key])).filter(n => n !== null);
    let range = '';
    if (v.length) {
      const lo = Math.min(...v), hi = Math.max(...v), mean = v.reduce((s, n) => s + n, 0) / v.length;
      range = `<p class="pg-dim-range"><svg class="pg-range" viewBox="0 0 200 24" width="200" height="24" aria-hidden="true" focusable="false"><line class="pg-range-axis" x1="6" x2="194" y1="12" y2="12"/>${[1, 5, 10].map(t => `<line class="pg-range-tick" x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="7" y2="17"/>`).join('')}<line class="pg-range-span" x1="${x(lo).toFixed(1)}" x2="${x(hi).toFixed(1)}" y1="12" y2="12"/><circle class="pg-range-mean" cx="${x(mean).toFixed(1)}" cy="12" r="3.4"/></svg><span>In this library ${esc(fmtScore(lo))} to ${esc(fmtScore(hi))}, mean ${esc(fmtScore(mean))}</span></p>`;
    }
    return `<li class="pg-dim" id="dimension-${esc(d.key)}"><span class="pg-dim-no" aria-hidden="true">${pgPad(i + 1, 2)}</span><div class="pg-dim-main"><h3 class="pg-dim-name">${esc(d.label)}</h3><p class="pg-dim-text">${esc(d.text)}</p>${range}</div></li>`;
  }).join('');
  const e = pgExample();
  return `<p>Each report is rated on five dimensions, each from 1 to 10. A 1 means little demonstrated value on that dimension, a 5 moderate or task-specific value, a 10 exceptional value backed by evidence.</p>
<ol class="pg-dims" role="list">${items}</ol>
<p>A dimension’s score is the mean of run A and run B. The overall score is the plain mean of the five, rounded to one decimal${e ? '; for the example above:' : '.'}</p>
${e ? `<p class="pg-arith">${esc(arithmetic(e))}</p>` : ''}
<p>Read the dimensions, not only the score: a useful tool can still be closed, immature or costly to adopt.</p>`;
}
function pgMethodRuns() {
  const all = state.entries || [];
  const both = all.filter(e => runsOf(e).both);
  const agree = both.filter(e => runsOf(e).agree).length;
  const differ = both.filter(e => runsOf(e).differing > 0).length;
  const gap = both.reduce((g, e) => Math.max(g, ...runsOf(e).dims.map(d => d.diff ?? 0)), 0);
  const m = state.meta || {};
  const steps = [
    ['Discover', 'Each scan checks the watched entrypoints: official announcements, documentation, repositories, model hubs, research, specialist coverage and public communities. New sources enter the catalogue.'],
    ['Verify', 'A researcher follows the primary evidence, keeps release dates apart from retrieval dates, and separates vendor claims from demonstrated facts. A baseline study is not presented as a new launch.'],
    ['Explain', 'The report connects what a tool does to teaching and creative work, with practical workflows and the limits of access and licensing.'],
    ['Review twice', 'Two separate, blind runs of the same reviewer model rate the report against the same evidence and rubric. Neither sees the other’s ratings.'],
    ['Publish', 'Both runs must approve the exact text and evidence being published: every review records their content hashes. A missing, stale or rejected review blocks publication, and so does a gap of more than two points on any dimension.']
  ];
  return `<p class="pg-honesty">${esc(HONESTY)}</p>
<p>The runs share the model’s training and its blind spots, so their agreement says the reading is stable, not that it is right. What they do offer is a check: two readings of the same evidence, kept side by side instead of blended into one number. The model is named on every review, under each report’s ratings.</p>
${both.length ? `<p class="pg-runs-tally">In this library the two runs agree on all five dimensions for <b>${esc(plural(agree, 'report'))}</b> and differ on one or more for <b>${esc(plural(differ, 'report'))}</b>; the widest gap on any dimension is <b>${esc(plural(gap, 'point'))}</b>.</p>` : ''}
<p class="pg-mini">From discovery to publication</p>
<ol class="pg-steps" role="list">${steps.map(([t, d], i) => `<li><span class="pg-step-no" aria-hidden="true">${pgPad(i + 1, 2)}</span><p><b>${esc(t)}.</b> ${esc(d)}</p></li>`).join('')}</ol>
${m.rubricVersion ? `<p class="pg-rubric">Rubric ${esc(m.rubricVersion)}${m.rubricHash ? ` ${pgSep} <span title="${esc(m.rubricHash)}">${esc(String(m.rubricHash).slice(0, 16))}…</span>` : ''}</p>` : ''}`;
}
function pgMethodDepth() {
  const all = state.entries || [];
  const tiers = [
    { words: 1000, name: 'Impact below 5', test: i => i < 5 },
    { words: 2000, name: 'Impact 5 to 7', test: i => i >= 5 && i <= 7 },
    { words: 3000, name: 'Impact above 7', test: i => i > 7 }
  ];
  const median = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return `<p>Length follows impact, never the other way round. A report’s final mean impact sets its depth, each tier allows ten percent either way, and the evidence decides the judgment: length is never a reason to raise a rating. On the plate, depth is what gives a trail its weight.</p>
<ul class="pg-tiers" role="list">${tiers.map((t, i) => {
    const here = all.filter(e => { const v = num(e.scores && e.scores.impact); return v !== null && t.test(v); });
    const md = median(here.map(e => num(e.wordCount)).filter(n => n !== null));
    return `<li class="pg-tier pg-tier--${i + 1}"><span class="pg-tier-trail" aria-hidden="true"></span><p class="pg-tier-name">${esc(t.name)}</p><p class="pg-tier-words">About ${esc(fmtInt(t.words))} words</p><p class="pg-tier-here">${here.length ? `${esc(plural(here.length, 'report'))} here${md ? `, median ${esc(fmtInt(md))} words` : ''}` : 'None in this edition'}</p></li>`;
  }).join('')}</ul>`;
}
function pgMethodLimits() {
  const m = state.meta || {};
  const repo = m.repository ? safeURL(`https://github.com/${m.repository}`) : '';
  return `<p>The internet has no complete, fixed boundary. Each scan is bounded by access, by what sources make available and by research time. The <a href="#sources">catalogue</a> keeps unvisited and blocked sources in view, and the <a href="#editions">logbook</a> records what each scan covered and what it could not see.</p>
<p>Unless a report says otherwise, products were researched from their sources: not installed, benchmarked or tested. A rating is not a performance benchmark, an endorsement or a guarantee.</p>
<p>${repo ? `Reports, evidence and review history are public in the ${external(repo, 'source and research archive')}. ` : ''}Your reading data stays in this browser and is never sent anywhere.</p>`;
}
function renderMethod() {
  const m = state.meta || {};
  const sections = [['plate', 'The plate'], ['spectrum', 'The spectrum'], ['dimensions', 'Five dimensions'], ['runs', 'Two runs, one model'], ['depth', 'Depth follows impact'], ['limits', 'What it cannot promise']];
  const toc = `<nav class="pg-toc" aria-label="On this page"><p class="pg-mini" aria-hidden="true">On this page</p><ol role="list">${sections.map(([id, t], i) => `<li><a href="#method/${id}"><span class="pg-toc-no" aria-hidden="true">${pgPad(i + 1, 2)}</span>${esc(t)}</a></li>`).join('')}</ol></nav>`;
  const lede = '<p>Parallax watches the public record of AI for releases that matter to people who teach and build. Each one it writes up is researched from primary sources and rated twice by the same reviewer model. This page explains everything you see on the plate and in a report, and what the instrument cannot see.</p>';
  const body = [pgMethodPlate(), pgMethodSpectrum(), pgMethodDims(), pgMethodRuns(), pgMethodDepth(), pgMethodLimits()];
  app.innerHTML = `<div class="pg pg--method">
${pgHead({ kind: 'method', eyebrow: pgEyebrow(['Method', m.rubricVersion ? `Rubric ${m.rubricVersion}` : '']), title: 'How the instrument works', lede, aside: toc })}
${sections.map(([id, t], i) => pgSection(id, pgPad(i + 1, 2), esc(t), body[i], { wide: id === 'plate' })).join('\n')}
</div>`;
}

/* =================================================================== SETTINGS */
/* Each theme card previews the plate and a spectrum in that theme's own tokens, read from
   the token rules in the stylesheet (never copied here), so the previews cannot drift. */
const PG_PREVIEW_PROPS = ['--bg', '--bg-2', '--surface', '--surface-2', '--ink', '--ink-2', '--ink-3', '--line', '--line-2', '--accent', '--mark', '--cool', '--warm', '--glow', '--sky-0', '--sky-1', '--sky-glow', '--sky-ink', '--sky-ink-3', '--sky-ring', '--sky-ring-2', '--trail', '--trail-a', '--trail-b'];
function pgThemeTokens() {
  if (PG.tokens) return PG.tokens;
  const found = { night: {}, plate: {}, redlight: {} };
  const visit = rules => {
    for (const rule of Array.from(rules || [])) {
      if (typeof CSSMediaRule === 'function' && rule instanceof CSSMediaRule) continue;
      if (typeof CSSStyleRule === 'function' && rule instanceof CSSStyleRule) {
        const sel = String(rule.selectorText || '').replace(/\s+/g, '').replace(/'/g, '"');
        const target = sel === ':root' ? found.night : sel === ':root[data-theme="plate"]' ? found.plate : sel === ':root[data-theme="redlight"]' ? found.redlight : null;
        if (target) for (const p of PG_PREVIEW_PROPS) { const v = rule.style.getPropertyValue(p).trim(); if (v) target[p] = v; }
        continue;
      }
      if (rule.cssRules) visit(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) { try { visit(sheet.cssRules); } catch (_) { /* a sheet from elsewhere: skip */ } }
  if (!Object.keys(found.night).length) return { night: {}, plate: {}, redlight: {} };
  PG.tokens = { night: found.night, plate: { ...found.night, ...found.plate }, redlight: { ...found.night, ...found.redlight } };
  return PG.tokens;
}
const pgArc = (cx, cy, r, a0, a1) => {
  if (!(a1 - a0 > 0.004) || !(r > 0)) return '';
  const f = v => v.toFixed(2);
  return `M${f(cx + Math.cos(a0) * r)} ${f(cy + Math.sin(a0) * r)}A${f(r)} ${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(cx + Math.cos(a1) * r)} ${f(cy + Math.sin(a1) * r)}`;
};
/* A crop of the plate around tonight's meridian, drawn from the real library. */
function pgPlateCrop(w, h) {
  const all = state.entries || [];
  if (!all.length) return '';
  const epoch = plateEpoch(all, state.runsLight || state.runs || []);
  const ties = plateTies(all);
  const cx = w * 0.5, cy = h * 1.14, rMax = h * 1.02, rMin = rMax * 0.17;
  /* Split trails alternate which half is drawn last, so where cool and warm touch neither
     wins: the even ones cool then warm, the odd ones warm then cool. */
  let one = '', heads = '', split = 0;
  const halves = [['', ''], ['', '']];
  for (const e of all) {
    const t = pgTime(e.discoveredAt || e.publishedAt);
    if (!Number.isFinite(t)) continue;
    const r = plateRadius(e.score, rMin, rMax) + (ties.get(e.id) || 0) * 0.8;
    const a0 = plateAngle(t, epoch);
    const d = runsOf(e).differing;
    if (d) {
      const off = 0.6 + d * 0.4, pair = halves[split++ % 2];
      pair[0] += pgArc(cx, cy, r - off, a0, PLATE.now);
      pair[1] += pgArc(cx, cy, r + off, a0, PLATE.now);
    } else one += pgArc(cx, cy, r, a0, PLATE.now);
    heads += `<circle cx="${cx.toFixed(1)}" cy="${(cy - r).toFixed(1)}" r=".9"/>`;
  }
  const [even, odd] = halves;
  return `<svg class="pg-crop" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><path class="pg-crop-t" d="${one}"/><path class="pg-crop-a" d="${even[0]}"/><path class="pg-crop-b" d="${even[1]}"/><path class="pg-crop-b" d="${odd[1]}"/><path class="pg-crop-a" d="${odd[0]}"/><g class="pg-crop-h">${heads}</g></svg>`;
}
function pgSwatch(tokens, crop, spec) {
  const style = Object.entries(tokens || {}).map(([k, v]) => `${k}:${v}`).join(';');
  return `<span class="pg-sw"${style ? ` style="${esc(style)}"` : ''}><span class="pg-sw-sky">${crop}</span><span class="pg-sw-page"><span class="pg-sw-aa">Aa</span>${spec}</span></span>`;
}
const PG_THEME_NOTE = { auto: 'Follows this device', darkroom: 'Light on a dark sky', plate: 'Ink on paper; the plate stays a night sky', redlight: 'Red light only, for eyes adapted to the dark' };
const pgAutoNote = () => `${PG_THEME_NOTE.auto}: now ${THEME_LABEL[systemDark() ? 'darkroom' : 'plate']}`;
function pgThemeCard(value, crop, spec) {
  const T = pgThemeTokens();
  const preview = value === 'auto' ? pgSwatch(T.night, crop, spec) + pgSwatch(T.plate, crop, spec) : pgSwatch(value === 'darkroom' ? T.night : T[value], crop, spec);
  return `<label class="pg-theme pg-theme--${value}"><input type="radio" name="theme" value="${value}"${pref('theme') === value ? ' checked' : ''}><span class="pg-theme-preview${value === 'auto' ? ' is-split' : ''}" aria-hidden="true">${preview}</span><span class="pg-theme-name">${esc(THEME_LABEL[value])}</span><span class="pg-theme-note"${value === 'auto' ? ' data-auto-note' : ''}>${esc(value === 'auto' ? pgAutoNote() : PG_THEME_NOTE[value])}</span></label>`;
}
function pgChoice(name, value, title, note) {
  return `<label class="pg-choice"><input type="radio" name="${name}" value="${value}"${pref(name) === value ? ' checked' : ''}><span class="pg-choice-title">${esc(title)}</span><span class="pg-choice-note">${esc(note)}</span></label>`;
}
function pgSet(id, title, note, body) {
  return `<section class="pg-set" id="${id}" aria-labelledby="${id}-title"><div class="pg-set-head"><h2 class="pg-set-title" id="${id}-title">${esc(title)}</h2>${note ? `<p class="pg-set-note">${note}</p>` : ''}</div><div class="pg-set-body">${body}</div></section>`;
}
function pgReadingFacts() {
  const ids = Object.keys(state.reading);
  if (!ids.length) return '<p class="pg-set-fact">Nothing is stored yet. Save a report to your queue or read one, and it is remembered here.</p>';
  const here = ids.filter(id => state.byId.has(id));
  const elsewhere = ids.length - here.length;
  const queued = here.filter(id => record(id).queued).length, read = here.filter(id => record(id).read).length, part = here.filter(id => inProgress(id)).length;
  const said = [queued ? `${plural(queued, 'report')} in your queue` : 'an empty queue', `${fmtInt(read)} read`, part ? `${fmtInt(part)} part-read` : ''].filter(Boolean);
  return `<p class="pg-set-fact">This browser holds ${esc(plural(ids.length, 'record'))}: ${esc(said.length > 2 ? `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}` : said.join(' and '))}${elsewhere ? `, and ${esc(fmtInt(elsewhere))} for reports not in this edition, kept untouched` : ''}.</p>`;
}
function pgSchedule() {
  const m = state.meta || {};
  const interval = num(m.intervalHours);
  const zone = String(m.timezone || 'UTC').replace(/_/g, ' ');
  const last = m.lastScanAt ? fmtDate(m.lastScanAt, { time: true }) : '';
  const next = m.nextScanAt ? fmtDate(m.nextScanAt, { time: true }) : '';
  const text = m.enabled === false
    ? `Scanning is paused.${last ? ` The last scan finished on ${last}.` : ''}`
    : `The observatory scans on a public schedule${interval ? `, every ${fmtInt(interval)} hours` : ''}.${last ? ` The last scan finished on ${last}` : ''}${next ? `; the next is expected after ${next}` : ''}.`;
  const repo = m.repository ? safeURL(`https://github.com/${m.repository}`) : '';
  return `<p class="pg-set-fact">${esc(text)} <span class="pg-quiet">Times are ${esc(zone)} time.</span></p>
<ul class="pg-links" role="list"><li><a class="pg-act" href="feed.xml">RSS feed of new reports</a></li>${repo ? `<li>${external(repo, 'Source and research archive', 'class="pg-act"')}</li>` : ''}<li><a class="pg-act" href="#editions">The logbook of every scan</a></li></ul>`;
}
function renderSettings() {
  const crop = pgPlateCrop(240, 78);
  const ex = pgExample();
  const spec = ex ? spectrum(ex, { size: 'row' }) : '';
  const stored = Object.keys(state.reading).length;
  const lede = '<p>How Parallax looks and behaves in this browser. Every choice is kept here, on this device, and nowhere else; the site sets no cookies.</p>';
  app.innerHTML = `<div class="pg pg--settings">
${pgHead({ kind: 'settings', eyebrow: pgEyebrow(['Settings', 'Kept in this browser']), title: 'Observing conditions', lede })}
<form id="preferences" class="pg-prefs" aria-label="Preferences">
${pgSet('appearance', 'Appearance', 'The plate is always the night sky; only the page around it changes.', `<fieldset class="pg-themes"><legend class="sr-only">Appearance</legend>${PREF_VALUES.theme.map(v => pgThemeCard(v, crop, spec)).join('')}</fieldset>`)}
${pgSet('text-size', 'Text size', 'Everything scales with it, the plate’s annotations included.', `<fieldset class="pg-ladder"><legend class="sr-only">Text size</legend>${[['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']].map(([v, l]) => `<label class="pg-step pg-step--${v}"><input type="radio" name="text" value="${v}"${pref('text') === v ? ' checked' : ''}><span class="pg-step-aa" aria-hidden="true">Aa</span><span class="pg-step-name">${esc(l)}</span></label>`).join('')}</fieldset>`)}
${pgSet('motion', 'Motion', 'The plate’s exposure plays once per visit, and pages cross-fade.', `<fieldset class="pg-choices"><legend class="sr-only">Motion</legend>${pgChoice('motion', 'allow', 'Follow this device', 'Motion plays unless the device asks for less.')}${pgChoice('motion', 'reduce', 'Reduce', 'Nothing moves on this site, whatever the device says.')}</fieldset>`)}
${pgSet('shortcuts', 'Single-key shortcuts', 'Press <kbd>/</kbd> to search the page you are on.', `<fieldset class="pg-choices"><legend class="sr-only">Single-key shortcuts</legend>${pgChoice('keys', 'on', 'On', 'The slash key jumps to search.')}${pgChoice('keys', 'off', 'Off', 'For speech input and switch control.')}</fieldset>`)}
</form>
${pgSet('reading-data', 'Your reading', 'Your queue, read marks and progress live only in this browser. Export them to move to another device; importing merges by report and leaves everything else as it is.', `<div id="reading-facts">${pgReadingFacts()}</div>
<div class="pg-data-actions"><button type="button" class="pg-act" data-action="export">Export reading data</button><button type="button" class="pg-act" data-action="import">Import reading data</button><input id="reading-import" type="file" accept="application/json,.json" hidden tabindex="-1"><button type="button" class="pg-act pg-act--quiet" data-action="pg-clear-ask" id="clear-ask"${stored ? '' : ' hidden'}>Clear reading data…</button></div>
<div class="pg-confirm" id="clear-confirm" role="group" aria-labelledby="clear-question" hidden><p id="clear-question"></p><div class="pg-confirm-ways"><button type="button" class="pg-act pg-act--danger" data-action="clear-reading">Remove them</button><button type="button" class="pg-act" data-action="pg-clear-cancel">Keep them</button></div></div>
<p id="settings-status" class="pg-status"></p>`)}
${pgSet('schedule', 'The scan schedule', '', pgSchedule())}
</div>`;
  const form = document.getElementById('preferences');
  const sync = () => {
    if (!form || !form.isConnected) return;
    for (const key of ['theme', 'text', 'motion', 'keys']) { const group = form.elements[key]; if (group && 'value' in group) group.value = pref(key); }
    const note = form.querySelector('[data-auto-note]');
    if (note) note.textContent = pgAutoNote();
  };
  /* The engine announces every change of preferences ('parallax:prefs'): a choice here, the
     theme toggle, another tab, or the device switching between light and dark. */
  document.addEventListener('parallax:prefs', sync);
  const onReading = () => {
    const facts = document.getElementById('reading-facts');
    if (facts) facts.innerHTML = pgReadingFacts();
    const n = Object.keys(state.reading).length;
    const ask = document.getElementById('clear-ask');
    const confirm = document.getElementById('clear-confirm');
    if (ask) ask.hidden = !n;
    if (confirm && !confirm.hidden && !n) {
      confirm.hidden = true;
      const back = document.querySelector('#reading-data [data-action="export"]');
      if (back) back.focus();
    }
  };
  document.addEventListener('parallax:reading', onReading);
  onLeave(() => {
    document.removeEventListener('parallax:prefs', sync);
    document.removeEventListener('parallax:reading', onReading);
  });
}

/* ================================================================ SHELL HOOKS */
/* The palette: a report's spectrum and score beside its title (inside an aria-hidden span;
   the option's own detail text already says the same in words). */
function paletteOptionExtra(item) {
  if (!item || item.kind !== 'report' || !item.entry) return '';
  return `${spectrum(item.entry, { size: 'row' })}<span class="pg-pal-score">${esc(fmtScore(item.entry.score, '–'))}</span>`;
}
/* The queue sheet: reading progress drawn as the plate draws a report, a trail of light that
   runs clockwise from twelve o'clock and ends in a bright head where the reader stopped. No
   track, so it never reads as a spinner; nothing at all before the first paragraph is read. */
function queueProgressHTML(entry, rec) {
  const p = clamp(Math.round(num(rec && rec.progress) ?? 0), 0, 100);
  const title = (entry && (entry.title || entry.id)) || 'this report';
  const a0 = -Math.PI / 2, a1 = a0 + (Math.min(p, 99.9) / 100) * Math.PI * 2;
  const f = v => v.toFixed(2);
  const pt = a => `${f(12 + Math.cos(a) * 9)} ${f(12 + Math.sin(a) * 9)}`;
  const trail = p ? `<path class="pg-arc-trail" d="M${pt(a0)}A9 9 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}"/><circle class="pg-arc-head" cx="${f(12 + Math.cos(a1) * 9)}" cy="${f(12 + Math.sin(a1) * 9)}" r="2.1"/>` : '';
  return `<span class="pg-arc${p ? '' : ' is-unread'}" role="progressbar" aria-label="Reading progress, ${esc(title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-valuetext="${p ? `${p}% read` : 'Not started'}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${trail}</svg></span>`;
}

/* ==================================================================== ACTIONS */
function pgListOf(el) { return el && el.dataset.list === 'accounts' ? 'accounts' : 'sources'; }
function pgRedraw(list) { if (list === 'accounts') pgDrawAccounts(); else pgDrawSources(); }
registerAction('pg-page', el => {
  const list = pgListOf(el);
  const page = Number(el.dataset.page);
  if (!Number.isFinite(page)) return;
  const S = list === 'accounts' ? PG.acc : PG.src;
  S.page = page;
  pgRedraw(list);
  const count = document.getElementById(list === 'accounts' ? 'account-count' : 'source-count');
  if (count) { count.scrollIntoView({ block: 'start', behavior: 'instant' }); count.focus({ preventScroll: true }); }
  announce(`Page ${S.page}. ${count ? count.textContent.replace(/\s+/g, ' ').trim() : ''}`);
});
function pgToggle(el, kind) {
  const id = el.dataset.id;
  const S = kind === 'source' ? PG.src : PG.acc;
  const panel = document.getElementById(`${kind}-more-${id}`);
  if (!id || !panel) return;
  const open = el.getAttribute('aria-expanded') !== 'true';
  if (open) {
    S.open.add(id);
    if (!panel.firstElementChild) {
      const item = kind === 'source' ? state.sourceById.get(id) : (state.accounts || []).find(a => a.id === id);
      if (item) panel.innerHTML = kind === 'source' ? pgSourceDetail(item) : pgAccountDetail(item);
    }
  } else S.open.delete(id);
  panel.hidden = !open;
  el.setAttribute('aria-expanded', String(open));
  const row = el.closest('.pg-line');
  if (row) row.classList.toggle('is-open', open);
}
registerAction('pg-record', el => pgToggle(el, 'source'));
registerAction('pg-account', el => pgToggle(el, 'account'));
function pgSetControls(formId, values) {
  const form = document.getElementById(formId);
  if (!form) return null;
  for (const [key, value] of Object.entries(values)) {
    const control = form.elements[key];
    if (control && 'value' in control) control.value = value;
  }
  form.dispatchEvent(new Event('input', { bubbles: true }));
  return form;
}
registerAction('pg-clear-search', el => {
  const list = pgListOf(el);
  const form = pgSetControls(list === 'accounts' ? 'account-filters' : 'source-filters', { q: '' });
  const field = form && form.elements.q;
  if (field) field.focus();
});
registerAction('pg-reset', el => {
  const list = pgListOf(el);
  const form = list === 'accounts'
    ? pgSetControls('account-filters', { q: '', platform: '', status: 'all' })
    : pgSetControls('source-filters', { kind: '', status: '' });
  const field = form && form.elements.q;
  if (field) field.focus();
});
registerAction('pg-scope-all', () => {
  const form = pgSetControls('source-filters', { scope: 'all' });
  const field = form && form.elements.q;
  if (field) field.focus();
});
registerAction('pg-clear-ask', () => {
  const confirm = document.getElementById('clear-confirm');
  const question = document.getElementById('clear-question');
  if (!confirm || !question) return;
  const n = Object.keys(state.reading).length;
  question.textContent = `Remove ${plural(n, 'record')} from this browser? This cannot be undone here; export first if you want a copy.`;
  const remove = confirm.querySelector('[data-action="clear-reading"]');
  if (remove) remove.textContent = `Remove ${plural(n, 'record')}`;
  confirm.hidden = false;
  const keep = confirm.querySelector('[data-action="pg-clear-cancel"]');
  if (keep) keep.focus();
});
registerAction('pg-clear-cancel', () => {
  const confirm = document.getElementById('clear-confirm');
  if (confirm) confirm.hidden = true;
  const ask = document.getElementById('clear-ask');
  if (ask) ask.focus();
});
/* ================================================================ end 50 · PAGES */


/* ===== 99-boot.js ===== */
/* 99-boot.js — last fragment: start the app and close the IIFE opened in 00-core.js. */
start();
})();

