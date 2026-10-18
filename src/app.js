/* Parallax: a local-first reader for validated AI Observatory editions. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dimensions = {
    usefulness: ['Usefulness', 'Actionable value for educational and creative builders.'],
    impact: ['Impact', 'Potential significance to AI development, grounded in evidence.'],
    novelty: ['Novelty', 'Demonstrated differentiation, rather than promotional claims.'],
    maturity: ['Maturity', 'Documented readiness and reliability; no assumed benchmark performance.'],
    openness: ['Openness', 'Inspectability, licensing, portability and reproducibility.']
  };
  const readingKey = 'parallax.v1.reading';
  const prefsKey = 'parallax.v1.prefs';
  const preferenceValues = {theme:['plate','darkroom','redlight'], text:['s','m','l','xl'], motion:['allow','reduce']};
  const validPrefs = value => Object.fromEntries(Object.entries(preferenceValues).filter(([key, values]) => value && values.includes(value[key])).map(([key]) => [key, value[key]]));
  const app = $('#app') || $('#view');
  let data, entries = [], sources = [], reading = Object.create(null), prefs = {};
  let storageAvailable = true, activeReport = null, scrollTick = false, progressTimer;
  let listScroll = 0, paletteIndex = 0, paletteItems = [];
  const filters = {q: '', category: '', min: '', sort: 'latest', reading: ''};
  const sourceFilters = {q: '', kind: '', status: '', scope: ''};
  const safeURL = value => {
    try { const u = new URL(String(value)); return /^(https?:)$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; }
  };
  const external = (url, text, extra = '') => {
    const href = safeURL(url);
    return href ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer" ${extra}>${escape(text)}<span aria-hidden="true"> ↗</span></a>` : escape(text);
  };
  const reportURL = id => `#report/${encodeURIComponent(id)}`;
  const titleCase = text => String(text || '').replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
  const score = value => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';
  const date = (value, time = false) => {
    if (!value) return 'Not established';
    const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
    if (!Number.isFinite(d.getTime())) return 'Not established';
    try { return new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', ...(time ? {hour:'2-digit',minute:'2-digit',timeZoneName:'short'} : {}), timeZone:data?.metadata?.timezone || 'Europe/Berlin'}).format(d); }
    catch (_) { return d.toISOString().slice(0,10); }
  };
  const cadence = () => {
    const hours = Number(data.metadata.intervalHours);
    return hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hours`;
  };
  const record = id => reading[id] || {queued:false, read:false, progress:0};
  const announce = message => {
    const box = $('#announcer');
    if (box) { box.textContent = ''; requestAnimationFrame(() => { box.textContent = message; }); }
    const status = $('#settings-status');
    if (status) status.textContent = message;
  };
  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (_) { storageAvailable = false; return fallback; }
  }
  function saveReading() {
    try { localStorage.setItem(readingKey, JSON.stringify({schemaVersion:1, records:reading})); }
    catch (_) { storageAvailable = false; announce('Browser storage is unavailable. Export your reading data before closing this tab.'); }
  }
  function validateReading(value) {
    if (!value || value.schemaVersion !== 1 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) throw new Error('Choose a Parallax reading-data export (schema version 1).');
    const valid = Object.create(null);
    let count = 0;
    for (const entry of entries) {
      if (!Object.prototype.hasOwnProperty.call(value.records, entry.id)) continue;
      const item = value.records[entry.id];
      if (!item || typeof item !== 'object' || typeof item.queued !== 'boolean' || typeof item.read !== 'boolean' || typeof item.progress !== 'number' || !Number.isFinite(item.progress) || item.progress < 0 || item.progress > 100) throw new Error('Reading data contains invalid values. Nothing was imported.');
      valid[entry.id] = {queued:item.queued, read:item.read, progress:Math.round(item.progress)};
      count++;
    }
    return {records:valid, count};
  }
  function setRecord(id, change) {
    if (!entries.some(entry => entry.id === id)) return;
    reading[id] = {...record(id), ...change};
    saveReading(); updateReadingControls();
  }
  function updateReadingControls() {
    const queued = entries.filter(entry => record(entry.id).queued);
    const count = $('#queue-count');
    if (count) { count.textContent = queued.length; count.hidden = !queued.length; }
    $$('[data-action="queue"]').forEach(button => {
      const on = record(button.dataset.id).queued;
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? 'In queue ✓' : 'Save to queue';
    });
    $$('[data-action="read"]').forEach(button => {
      const on = record(button.dataset.id).read;
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? 'Read ✓' : 'Mark as read';
    });
    $$('[data-reading-label]').forEach(label => {
      const value = record(label.dataset.readingLabel);
      label.textContent = value.read ? 'Read' : value.progress > 0 ? `${value.progress}% read` : 'Unread';
    });
    if ($('#queue')?.open) renderQueue();
  }
  function safeBody(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const allowed = new Set(['P','H3','UL','OL','LI','STRONG','EM','A','CODE','PRE','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD','BR']);
    const visit = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.COMMENT_NODE) child.remove();
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowed.has(child.tagName)) { child.remove(); continue; }
          const href = child.tagName === 'A' ? safeURL(child.getAttribute('href')) : '';
          [...child.attributes].forEach(attribute => child.removeAttribute(attribute.name));
          if (href) { child.setAttribute('href', href); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
          visit(child);
        }
      }
    };
    visit(parsed.body);
    return parsed.body.innerHTML;
  }
  const button = (action, entry) => `<button class="button button-secondary" type="button" data-action="${action}" data-id="${escape(entry.id)}" aria-pressed="${record(entry.id)[action === 'queue' ? 'queued' : 'read']}">${action === 'queue' ? (record(entry.id).queued ? 'In queue ✓' : 'Save to queue') : (record(entry.id).read ? 'Read ✓' : 'Mark as read')}</button>`;
  const options = (items, selected, first) => `<option value="">${escape(first)}</option>${items.map(item => `<option value="${escape(item)}" ${selected === item ? 'selected' : ''}>${escape(titleCase(item))}</option>`).join('')}`;
  const empty = (title, text) => `<div class="empty-state state"><h2>${escape(title)}</h2><p>${escape(text)}</p></div>`;
  function reportRow(entry, index = 0) {
    const state = record(entry.id);
    return `<article class="report-row" data-report-id="${escape(entry.id)}">
      <div class="report-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
      <div class="report-row-main"><div class="report-meta"><span class="eyebrow">${escape(entry.category)}</span><span class="tag change-${escape(entry.changeType)}">${entry.changeType === 'baseline' ? 'Baseline study' : escape(titleCase(entry.changeType))}</span><span>${entry.publishedAt ? `Published ${date(entry.publishedAt)}` : `Added ${date(entry.discoveredAt)}`}</span></div>
      <h2 class="report-title"><a href="${reportURL(entry.id)}">${escape(entry.title)}</a></h2><p class="report-summary">${escape(entry.summary)}</p>
      <div class="tags">${(entry.tags || []).map(tag => `<span class="tag">${escape(tag)}</span>`).join('')}</div>
      <div class="row-actions"><span>${escape(entry.readMinutes)} min read</span><span data-reading-label="${escape(entry.id)}">${state.read ? 'Read' : state.progress ? `${state.progress}% read` : 'Unread'}</span>${button('queue', entry)}</div></div>
      <a class="score report-row-score" href="${reportURL(entry.id)}/ratings" aria-label="${escape(entry.entity)}: overall rating ${score(entry.score)} out of 10. View both reviews."><span class="score-value">${score(entry.score)}</span><span class="score-label">/ 10 · two reviews</span></a>
    </article>`;
  }
  function filteredEntries(queueOnly = false) {
    const q = filters.q.trim().toLowerCase();
    return entries.filter(entry => (!queueOnly || record(entry.id).queued) && (!q || [entry.title, entry.entity, entry.summary, ...(entry.tags || [])].join(' ').toLowerCase().includes(q)) && (!filters.category || entry.category === filters.category) && (!filters.min || Number(entry.score) >= Number(filters.min)) && (!filters.reading || (filters.reading === 'read' ? record(entry.id).read : filters.reading === 'queued' ? record(entry.id).queued : !record(entry.id).read))).sort((a,b) => filters.sort === 'score' ? b.score - a.score || a.title.localeCompare(b.title) : filters.sort === 'title' ? a.title.localeCompare(b.title) : String(b.discoveredAt).localeCompare(String(a.discoveredAt)) || a.title.localeCompare(b.title));
  }
  function renderIndex(queueOnly = false) {
    const metadata = data.metadata;
    app.innerHTML = `<section class="hero wrap"><p class="eyebrow">${queueOnly ? 'Your personal reading room' : 'A different angle on artificial intelligence'}</p><h1>${queueOnly ? 'The reading queue.' : 'Look closer.'}</h1><p class="hero-deck">${queueOnly ? 'The reports you saved, with your place kept in this browser.' : 'Tools, models and ideas worth understanding. Source-linked research, practical implications, and two independent passes on every rating.'}</p>
      <div class="stats"><span><strong>${entries.length}</strong> reports</span><span><strong>${metadata.sourceCount || sources.length}</strong> source records</span><span><strong>${metadata.monitoringSourceCount ?? sources.filter(s => s.monitor !== false && s.status !== 'retired').length}</strong> recurring entrypoints</span><span>Updated <strong>${date(metadata.lastScanAt)}</strong></span></div></section>
      <section class="discovery wrap" aria-label="Report library"><form class="toolbar" id="report-filters" role="search"><div class="search"><label for="report-search">Find a report</label><input id="report-search" name="q" type="search" placeholder="Search tools, models, ideas…" value="${escape(filters.q)}" autocomplete="off" aria-keyshortcuts="/"></div><div class="filters">
      <label class="field">Category<select name="category">${options([...new Set(entries.map(e => e.category))].sort(), filters.category, 'All categories')}</select></label>
      <label class="field">Minimum rating<select name="min">${options(['5','6','7','8','9'], filters.min, 'Any rating')}</select></label>
      <label class="field">Reading<select name="reading"><option value="">All reports</option><option value="unread" ${filters.reading === 'unread' ? 'selected' : ''}>Unread</option><option value="read" ${filters.reading === 'read' ? 'selected' : ''}>Read</option><option value="queued" ${filters.reading === 'queued' ? 'selected' : ''}>In queue</option></select></label>
      <label class="field">Sort<select name="sort"><option value="latest" ${filters.sort === 'latest' ? 'selected' : ''}>Latest additions</option><option value="score" ${filters.sort === 'score' ? 'selected' : ''}>Highest rating</option><option value="title" ${filters.sort === 'title' ? 'selected' : ''}>Title A–Z</option></select></label><button type="button" class="button button-secondary" data-action="reset-filters">Reset</button></div></form>
      <p class="filter-count" id="report-count" aria-live="polite"></p><div class="report-list" id="report-list"></div><p class="coverage-note">${escape(metadata.coverageNote)} <a href="#editions">Read the coverage notes →</a></p></section>`;
    $('#report-filters').addEventListener('submit', event => event.preventDefault());
    $('#report-filters').addEventListener('input', event => {
      if (Object.prototype.hasOwnProperty.call(filters, event.target.name)) { filters[event.target.name] = event.target.value; renderReportList(queueOnly); }
    });
    renderReportList(queueOnly);
  }
  function renderReportList(queueOnly = false) {
    const selected = filteredEntries(queueOnly);
    $('#report-list').innerHTML = selected.length ? selected.map(reportRow).join('') : empty(queueOnly ? 'No saved reports match.' : 'No reports match.', 'Try a different search or reset the filters.');
    $('#report-count').textContent = `${selected.length} of ${queueOnly ? entries.filter(e => record(e.id).queued).length : entries.length} reports`;
  }
  function scoreGrid(entry) {
    return `<div class="score-grid">${Object.entries(dimensions).map(([key, [label, description]]) => `<div class="score-item"><span class="score-label" title="${escape(description)}">${label}</span><strong class="score-value">${score(entry.scores?.[key])}<small> / 10</small></strong><p>${escape(description)}</p><span class="score-review-pair">A ${escape(entry.reviews?.[0]?.scores?.[key] ?? '—')} · B ${escape(entry.reviews?.[1]?.scores?.[key] ?? '—')}</span></div>`).join('')}</div>`;
  }
  function renderReport(entry, anchor) {
    activeReport = entry;
    const reviews = Array.isArray(entry.reviews) ? entry.reviews : [];
    const sectionId = section => `section-${section.id}`;
    const routeTo = id => `${reportURL(entry.id)}/${encodeURIComponent(id)}`;
    app.innerHTML = `<article class="report wrap"><header class="report-header"><a class="back-link" href="#index">← Back to the index</a><div class="report-meta"><span class="eyebrow">${escape(entry.category)}</span><span class="tag">${entry.changeType === 'baseline' ? 'Baseline study' : escape(titleCase(entry.changeType))}</span><span>${escape(entry.entity)}</span></div><h1>${escape(entry.title)}</h1><p class="report-deck">${escape(entry.summary)}</p><div class="report-meta"><span>${entry.readMinutes} min read · ${Number(entry.wordCount).toLocaleString('en-GB')} words</span><span>Added ${date(entry.discoveredAt)}</span><span>${entry.publishedAt ? `Source publication ${date(entry.publishedAt)}` : 'Launch / publication date not established'}</span></div><div class="report-actions">${button('queue', entry)}${button('read', entry)}${external(entry.officialUrl, 'Visit official source', 'class="button button-secondary"')}</div></header>
      <div class="reading-layout"><aside class="report-sidebar"><nav class="toc" aria-label="On this page"><p class="eyebrow">In this report</p><ol>${entry.sections.map(section => `<li><a href="${routeTo(sectionId(section))}">${escape(section.title)}</a></li>`).join('')}<li><a href="${routeTo('ratings')}">Two views, five ratings</a></li><li><a href="${routeTo('sources')}">Sources & research notes</a></li></ol></nav><div class="reading-progress"><label for="report-progress">Your reading progress</label><progress id="report-progress" max="100" value="${record(entry.id).progress}"></progress><span id="progress-label">${record(entry.id).progress}%</span>${record(entry.id).progress > 0 && record(entry.id).progress < 95 ? `<button type="button" class="button button-secondary" data-action="resume" data-id="${escape(entry.id)}">Resume reading</button>` : ''}</div></aside>
      <div class="report-body" id="report-body">${entry.sections.map(section => `<section class="report-section" id="${escape(sectionId(section))}"><h2>${escape(section.title)}</h2>${safeBody(section.html)}</section>`).join('')}
      ${entry.images?.length ? `<div class="report-images">${entry.images.map(image => safeURL(image.src) ? `<figure><img loading="lazy" src="${escape(safeURL(image.src))}" alt="${escape(image.alt)}"><figcaption>${escape(image.caption)} ${image.sourceUrl ? external(image.sourceUrl, 'Image source') : ''}</figcaption></figure>` : '').join('')}</div>` : ''}
      ${entry.judgment ? `<aside class="editorial-judgment"><p class="eyebrow">The practical judgment</p><p>${escape(entry.judgment)}</p></aside>` : ''}
      ${entry.useCases?.length ? `<section class="report-section"><h2>Where you could use it</h2><ul>${entry.useCases.map(text => `<li>${escape(text)}</li>`).join('')}</ul></section>` : ''}
      ${entry.limitations?.length ? `<section class="report-section"><h2>Limits to keep in view</h2><ul>${entry.limitations.map(text => `<li>${escape(text)}</li>`).join('')}</ul></section>` : ''}
      <section class="report-section ratings" id="ratings"><p class="eyebrow">Two views, five ratings</p><h2>A closer look at the score.</h2><p class="overall-score"><strong>${score(entry.score)}</strong> / 10 overall. Each dimension is the mean of two independent Astra review runs. <a href="#method">Read the rubric.</a></p>${scoreGrid(entry)}<p>These are editorial judgments about the documented evidence. Separate runs of the same model do not establish independent experimental validation.</p>
      ${reviews.map((review, i) => `<details class="review"><summary>Reviewer ${i ? 'B' : 'A'} · ${escape(titleCase(review.verdict))} · ${escape(review.confidence)} confidence</summary><p class="review-meta">${escape(review.model)} · ${escape(review.effort)} effort · reviewed ${date(review.reviewedAt)}</p><dl class="review-rationale">${Object.entries(dimensions).map(([key, [label]]) => `<div><dt>${label} <strong>${escape(review.scores?.[key])} / 10</strong></dt><dd>${escape(review.rationale?.[key] || 'No rationale supplied.')}</dd></div>`).join('')}</dl>${review.concerns?.length ? `<h3>Review qualifications</h3><ul>${review.concerns.map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : ''}<details class="review-integrity"><summary>Content verification</summary><p>Approval is tied to the exact report, evidence and rubric.</p><dl><dt>Report SHA-256</dt><dd><code>${escape(review.reportHash)}</code></dd><dt>Evidence SHA-256</dt><dd><code>${escape(review.evidenceHash)}</code></dd><dt>Rubric version</dt><dd>${escape(review.rubricVersion)}</dd></dl></details></details>`).join('')}</section>
      <section class="report-section bibliography" id="sources"><h2>Sources & research notes</h2><p>${escape(entry.researchNote)}</p><ol>${(entry.sources || []).map(source => `<li>${external(source.url, source.title || source.id)}<p>${escape(source.supports || '')}</p><p class="source-meta">Locator: ${escape(source.locator || 'See source')} · Accessed ${date(source.accessedAt)}${source.publishedAt ? ` · Published ${date(source.publishedAt)}` : ' · Publication date not established'}</p></li>`).join('')}</ol></section><div class="report-actions">${button('read', entry)}<a class="button button-secondary" href="#index">Back to the index</a></div></div></div></article>`;
    if (anchor) requestAnimationFrame(() => scrollToAnchor(anchor));
  }
  function renderSources() {
    const monitored = sources.filter(source => source.monitor !== false && source.status !== 'retired').length;
    const visited = sources.filter(source => source.lastCheckedAt).length;
    app.innerHTML = `<section class="page-header wrap"><p class="eyebrow">An expanding source ledger</p><h1>Follow the evidence.</h1><p>Every new story can add a new source. Recurring entrypoints and individual evidence pages are recorded separately, with their access status kept visible.</p><div class="stats"><span><strong>${sources.length}</strong> source records</span><span><strong>${monitored}</strong> recurring entrypoints</span><span><strong>${visited}</strong> checked or surfaced</span></div><p>“Active” records may include bounded page reads, profile cards or search results; the access notes show what was actually inspected. A registered source is not a claim of complete coverage.</p></section>
      <section class="wrap"><form class="toolbar" id="source-filters" role="search"><div class="search"><label for="source-search">Search the ledger</label><input id="source-search" type="search" name="q" value="${escape(sourceFilters.q)}" placeholder="Publisher, topic, URL…"></div><div class="filters"><label class="field">Kind<select name="kind">${options([...new Set(sources.map(s => s.kind))].sort(), sourceFilters.kind, 'All kinds')}</select></label><label class="field">Status<select name="status">${options([...new Set(sources.map(s => s.status))].sort(), sourceFilters.status, 'All statuses')}</select></label><label class="field">Role<select name="scope"><option value="">All records</option><option value="monitor" ${sourceFilters.scope === 'monitor' ? 'selected' : ''}>Recurring entrypoints</option><option value="evidence" ${sourceFilters.scope === 'evidence' ? 'selected' : ''}>Evidence pages</option></select></label></div></form><p id="source-count" class="filter-count" aria-live="polite"></p><div id="source-list" class="source-list"></div></section>`;
    $('#source-filters').addEventListener('submit', e => e.preventDefault());
    $('#source-filters').addEventListener('input', event => { if (Object.prototype.hasOwnProperty.call(sourceFilters, event.target.name)) { sourceFilters[event.target.name] = event.target.value; renderSourceList(); } });
    renderSourceList();
  }
  function renderSourceList() {
    const q = sourceFilters.q.toLowerCase().trim();
    const selected = sources.filter(source => (!q || [source.name, source.url, source.notes, ...(source.topics || [])].join(' ').toLowerCase().includes(q)) && (!sourceFilters.kind || source.kind === sourceFilters.kind) && (!sourceFilters.status || source.status === sourceFilters.status) && (!sourceFilters.scope || (sourceFilters.scope === 'monitor' ? source.monitor !== false : source.monitor === false))).sort((a,b) => a.name.localeCompare(b.name));
    $('#source-count').textContent = `${selected.length} of ${sources.length} source records`;
    $('#source-list').innerHTML = selected.length ? selected.map(source => `<article class="source-row"><div><div class="source-meta"><span class="tag">${escape(titleCase(source.kind))}</span><span class="tag status-${escape(source.status)}">${escape(titleCase(source.status))}</span><span>${source.monitor === false ? 'Evidence page' : 'Recurring entrypoint'}</span></div><h2>${external(source.url, source.name)}</h2><p class="source-url">${escape(source.url)}</p><p class="source-notes">${escape(source.notes)}</p><details><summary>Provenance & coverage</summary><dl><dt>Added</dt><dd>${date(source.discoveredAt)}</dd><dt>Discovered through</dt><dd>${escape(source.discoveredFrom || 'Not recorded')}</dd><dt>Last checked or surfaced</dt><dd>${source.lastCheckedAt ? date(source.lastCheckedAt, true) : 'Not yet visited'}</dd><dt>Last successful access</dt><dd>${source.lastSuccessAt ? date(source.lastSuccessAt, true) : 'Not established'}</dd><dt>Last completed scan window</dt><dd>${source.lastCoverageAt ? date(source.lastCoverageAt, true) : 'No complete window recorded'}</dd>${source.feedUrl ? `<dt>Feed</dt><dd>${external(source.feedUrl, 'RSS / Atom feed')}</dd>` : ''}</dl></details></div></article>`).join('') : empty('No sources match.', 'Try a different search or filter.');
  }
  function renderEditions() {
    const runs = [...(data.runs || [])].sort((a,b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    app.innerHTML = `<section class="page-header wrap"><p class="eyebrow">The research record</p><h1>What each scan saw.</h1><p>Coverage grows over time. These edition notes record the scope, discoveries and limitations of each scan.</p></section><section class="edition-list wrap">${runs.length ? runs.map((run, i) => `<article class="edition"><p class="eyebrow">${escape(run.status)} · ${escape(run.id)}</p><h2>${date(run.finishedAt || run.startedAt)}</h2><div class="stats"><span><strong>${escape(run.sourcesChecked ?? 0)}</strong> checked / surfaced</span><span><strong>${escape(run.candidatesFound ?? 0)}</strong> candidates</span><span><strong>${escape(run.publishedCount ?? 0)}</strong> published reports</span><span><strong>${escape(run.sourcesFailed ?? 0)}</strong> failed sources</span></div><p>${escape(run.coverageNote)}</p><p class="source-meta">Research window: ${date(run.windowStart)} – ${date(run.windowEnd)}. ${run.finishedAt ? `Completed ${date(run.finishedAt, true)}.` : 'Still in progress.'}</p>${run.limitations?.length ? `<details ${i === 0 ? 'open' : ''}><summary>Coverage limitations</summary><ul>${run.limitations.map(text => `<li>${escape(text)}</li>`).join('')}</ul></details>` : ''}</article>`).join('') : empty('The first edition is in progress.', 'Completed scan notes will appear here after research and review.')}</section>`;
  }
  function renderMethod() {
    app.innerHTML = `<section class="page-header wrap"><p class="eyebrow">Method · rubric ${escape(data.metadata.rubricVersion)}</p><h1>Two perspectives.<br>One inspectable record.</h1><p>A report earns its place through source-led research and two separate reviews. The result is a starting point for judgment, with its evidence and limits visible.</p></section><div class="method-body wrap"><section class="report-section"><h2>From discovery to publication</h2><ol><li><strong>Discover.</strong> Webcrawl explores official announcements, documentation, repositories, model hubs, research, specialist coverage and public communities. New sources enter the ledger.</li><li><strong>Verify.</strong> A researcher follows the primary evidence, separates release dates from retrieval dates, and distinguishes vendor claims from demonstrated facts. A baseline study does not imply a new launch.</li><li><strong>Explain.</strong> Reports connect what a tool does to educational and creative work, with practical workflows and access or licensing limits.</li><li><strong>Review twice.</strong> Two separate GPT-6 Astra agents, at high effort, review the same report, evidence and rubric without seeing each other’s ratings.</li><li><strong>Gate publication.</strong> Both reviews must approve the exact current content hashes. Missing, stale or rejected reviews block publication; a disagreement above two points on any dimension requires resolution.</li></ol></section><section class="report-section"><h2>Five dimensions, each from 1 to 10</h2><div class="score-grid">${Object.entries(dimensions).map(([, [label, description]]) => `<div class="score-item"><h3>${label}</h3><p>${description}</p></div>`).join('')}</div><p>1 means little demonstrated value on that dimension; 5 means moderate or task-specific value; 10 means exceptional evidence-backed value. Dimension scores average the two reviewers. The overall score is the unweighted mean of the five dimension scores, rounded to one decimal.</p><p>Read the individual dimensions: a useful tool can still be restrictive, immature or expensive to integrate. The overall score is not a performance benchmark, endorsement or guarantee.</p></section><section class="report-section"><h2>Depth follows potential impact</h2><p>Final mean impact below 5 receives a roughly 1,000-word report; 5 through 7 receives about 2,000 words; above 7 receives about 3,000 words. Each tier allows ten percent variation. Evidence determines the judgment; length is not a reason to inflate a rating.</p></section><section class="report-section"><h2>What this process cannot promise</h2><p>The internet has no complete, fixed boundary. Each scan is bounded by access, source availability and research capacity. The source ledger records unvisited and blocked sources, while the edition notes expose the scope of completed work.</p><p>Two independent runs of the same model share underlying limitations. They are a consistency and evidence-review check, not independent experimental validation. Unless a report explicitly says otherwise, products have been researched from sources rather than benchmarked or tested.</p><p>Reports, evidence and review history live in the ${external(`https://github.com/${data.metadata.repository}`, 'public repository')}. Reading data stays in your browser and is never sent to that repository.</p></section></div>`;
  }
  function renderSettings() {
    app.innerHTML = `<section class="page-header wrap"><p class="eyebrow">Your observatory</p><h1>Make room for reading.</h1><p>Adjust this reading room and manage the local scan schedule.</p></section><div class="settings-layout wrap"><section class="settings-panel"><h2>The scan schedule</h2><p class="schedule-value">${data.metadata.enabled === false ? 'Scanning paused' : `Every ${cadence()}`}</p><dl><dt>Last complete scan</dt><dd>${date(data.metadata.lastScanAt, true)}</dd><dt>Next eligible scan</dt><dd>${data.metadata.enabled === false ? 'Paused' : date(data.metadata.nextScanAt, true)}</dd></dl><p>A Codex heartbeat checks eligibility hourly. The Mac must be awake and Codex running. The interval is measured from the last completed scan; this public schedule reflects the latest published edition.</p><p>To change the interval or pause scanning, open <strong>Open Observatory Controls.command</strong> in the project folder on the Mac running the scanner. Then use the local controls:</p><p><a class="button" href="http://127.0.0.1:8893/" target="_blank" rel="noopener">Open local scan controls ↗</a></p><p class="source-meta">The controls work only on the scanner’s Mac while that launcher is running. Changes apply at the next eligibility check; this public page updates after publication.</p></section>
      <section class="settings-panel"><h2>The reading room</h2><form id="preferences"><label class="field">Appearance<select name="theme"><option value="plate">Plate · light</option><option value="darkroom">Darkroom · dark</option><option value="redlight">Redlight</option></select></label><label class="field">Reading text size<select name="text"><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option><option value="xl">Extra large</option></select></label><label class="field">Motion<select name="motion"><option value="allow">Follow device preference</option><option value="reduce">Reduce motion</option></select></label></form><p>Appearance and reading preferences stay in this browser.</p></section>
      <section class="settings-panel"><h2>Your reading data</h2><p>${entries.filter(e => record(e.id).read).length} reports marked read · ${entries.filter(e => record(e.id).queued).length} saved to your queue.</p><p>${storageAvailable ? 'Your queue, read marks and progress are saved locally. Export a copy to move them to another browser.' : 'Browser storage is unavailable. Export your reading data before closing this tab.'}</p><div class="reader-tools"><button type="button" class="button" data-action="export">Export reading data</button><label class="button button-secondary" for="reading-import">Import reading data</label><input id="reading-import" type="file" accept="application/json,.json" class="sr-only"></div><p>Imports merge matching report IDs; unknown reports are ignored. An import does not alter the research or ratings.</p><p id="settings-status" class="status-line" role="status"></p></section><section class="settings-panel"><h2>Follow the next edition</h2><p><a href="feed.xml" class="button button-secondary">RSS feed</a> ${external(`https://github.com/${data.metadata.repository}`, 'Project on GitHub', 'class="button button-secondary"')}</p><p>All source links and published reports remain available without an account.</p></section></div>`;
    const form = $('#preferences');
    for (const [key, fallback] of [['theme','plate'], ['text','m'], ['motion','allow']]) form.elements[key].value = prefs[key] || fallback;
    form.addEventListener('change', event => {
      if (!preferenceValues[event.target.name]?.includes(event.target.value)) return;
      prefs[event.target.name] = event.target.value; applyPrefs();
      try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch (_) { announce('Preference applies for this visit; browser storage is unavailable.'); }
    });
    $('#reading-import').addEventListener('change', importReading);
  }
  function applyPrefs() {
    for (const [key, fallback, values] of [['theme','plate',['plate','darkroom','redlight']], ['text','m',['s','m','l','xl']], ['motion','allow',['allow','reduce']]]) document.documentElement.setAttribute(`data-${key}`, values.includes(prefs[key]) ? prefs[key] : fallback);
  }
  function exportReading() {
    const value = {schemaVersion:1, exportedAt:new Date().toISOString(), records:reading, preferences:validPrefs(prefs)};
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `parallax-reading-${new Date().toISOString().slice(0,10)}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Reading data exported.');
  }
  async function importReading(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a reading-data file smaller than 1 MB.');
      const imported = JSON.parse(await file.text());
      const result = validateReading(imported);
      for (const id of Object.keys(result.records)) reading[id] = result.records[id];
      prefs = {...prefs, ...validPrefs(imported.preferences)}; applyPrefs();
      try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch (_) { storageAvailable = false; }
      saveReading(); updateReadingControls(); renderSettings(); announce(`Imported reading data for ${result.count} known report${result.count === 1 ? '' : 's'}.`);
    } catch (error) { announce(error instanceof SyntaxError ? 'This file is not valid JSON. Nothing was imported.' : error.message); }
    event.target.value = '';
  }
  function renderQueue() {
    const queued = entries.filter(entry => record(entry.id).queued);
    const body = $('#queue-body');
    if (!body) return;
    body.innerHTML = queued.length ? `<div class="queue-list">${queued.map(entry => `<article class="queue-item"><h3><a href="${reportURL(entry.id)}" data-close-dialog>${escape(entry.title)}</a></h3><p>${entry.readMinutes} min · ${record(entry.id).read ? 'Read' : `${record(entry.id).progress}% read`}</p><button type="button" class="button button-secondary" data-action="queue" data-id="${escape(entry.id)}" aria-pressed="true">In queue ✓</button></article>`).join('')}</div>` : empty('Your reading queue is empty.', 'Save a report from the index to return to it here.');
    const foot = $('#queue-foot');
    if (foot) foot.innerHTML = `<a class="button" href="#queue" data-close-dialog>Open reading queue</a><button type="button" class="button button-secondary" data-action="export">Export reading data</button>`;
  }
  function showDialog(dialog) {
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }
  function renderPalette() {
    const q = ($('#palette-input')?.value || '').trim().toLowerCase();
    const pages = [{title:'Index — all reports',url:'#index'}, {title:'Source ledger',url:'#sources'}, {title:'Editions & coverage',url:'#editions'}, {title:'Method & ratings',url:'#method'}, {title:'Settings',url:'#settings'}, {title:'Reading queue',url:'#queue'}];
    paletteItems = [...entries.filter(entry => !q || [entry.title, entry.entity, entry.summary, ...(entry.tags || [])].join(' ').toLowerCase().includes(q)).map(entry => ({title:entry.title,url:reportURL(entry.id),detail:`${entry.category} · ${score(entry.score)} / 10`})), ...pages.filter(page => !q || page.title.toLowerCase().includes(q))].slice(0,12);
    paletteIndex = 0; updatePalette();
  }
  function updatePalette() {
    const list = $('#palette-list'); if (!list) return;
    list.innerHTML = paletteItems.length ? paletteItems.map((item, index) => `<li id="palette-option-${index}" role="option" aria-selected="${index === paletteIndex}" data-palette-index="${index}"><a href="${item.url}" tabindex="-1" data-close-dialog>${escape(item.title)}${item.detail ? `<span>${escape(item.detail)}</span>` : ''}</a></li>`).join('') : '<li role="option" aria-disabled="true">No matching reports or pages.</li>';
    const input = $('#palette-input');
    if (paletteItems.length) input?.setAttribute('aria-activedescendant', `palette-option-${paletteIndex}`); else input?.removeAttribute('aria-activedescendant');
  }
  function openPalette() {
    showDialog($('#palette')); const input = $('#palette-input'); if (input) { input.value = ''; renderPalette(); input.focus(); }
  }
  function scrollToAnchor(anchor) {
    const target = document.getElementById(anchor);
    if (target && app.contains(target)) { target.scrollIntoView({block:'start',behavior:'instant'}); target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
  }
  function route() {
    if (!data) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    let name = parts[0] || 'index';
    if (name === 'discover') name = 'index';
    let id = '', anchor = '';
    try { id = decodeURIComponent(parts[1] || ''); anchor = decodeURIComponent(parts.slice(2).join('/')); } catch (_) { name = 'missing'; }
    if (name === 'report' && activeReport?.id === id) {
      if (anchor) scrollToAnchor(anchor);
      else { window.scrollTo({top:0,behavior:'instant'}); $('#main')?.focus({preventScroll:true}); }
      return;
    }
    if (document.body.dataset.route === 'index') listScroll = window.scrollY;
    activeReport = null;
    document.body.dataset.route = name;
    $$('a[data-nav]').forEach(link => { if (link.dataset.nav === name || (name === 'report' && link.dataset.nav === 'index')) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
    $$('dialog[open]').forEach(dialog => dialog.close());
    if (name === 'index' || name === 'queue') renderIndex(name === 'queue');
    else if (name === 'report') {
      const entry = entries.find(item => item.id === id);
      if (entry) renderReport(entry, anchor);
      else app.innerHTML = `<section class="wrap">${empty('This report is not in this edition.', 'It may have been withdrawn or the link may be incomplete.')}<a class="button" href="#index">Browse the current index</a></section>`;
    } else if (name === 'sources') renderSources();
    else if (name === 'editions') renderEditions();
    else if (name === 'method') renderMethod();
    else if (name === 'settings') renderSettings();
    else app.innerHTML = `<section class="wrap">${empty('This page could not be found.', 'Return to the current report index.')}<a class="button" href="#index">Open index</a></section>`;
    app.setAttribute('aria-busy','false');
    document.title = activeReport ? `${activeReport.entity} — Parallax` : `${name === 'index' ? 'Parallax' : titleCase(name) + ' — Parallax'} · AI Observatory`;
    const bar = $('#readbar'); if (bar) { bar.hidden = !activeReport; const span = $('span', bar); if (span) span.style.width = '0%'; }
    updateReadingControls();
    if (!anchor) window.scrollTo({top:name === 'index' ? listScroll : 0,behavior:'instant'});
    $('#main')?.focus({preventScroll:true});
  }
  function trackProgress() {
    if (!activeReport) return;
    const body = $('#report-body'); if (!body) return;
    const rect = body.getBoundingClientRect();
    const traversable = Math.max(1, body.offsetHeight - window.innerHeight * .6);
    const percentage = Math.max(0, Math.min(100, Math.round((-rect.top + window.innerHeight * .2) / traversable * 100)));
    const progress = Math.max(record(activeReport.id).progress, percentage);
    const control = $('#report-progress'); if (control) control.value = progress;
    const label = $('#progress-label'); if (label) label.textContent = `${progress}%`;
    const bar = $('#readbar span'); if (bar) bar.style.width = `${percentage}%`;
    if (progress > record(activeReport.id).progress) {
      reading[activeReport.id] = {...record(activeReport.id), progress};
      clearTimeout(progressTimer); progressTimer = setTimeout(saveReading, 350);
    }
  }
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close], [data-close-dialog]');
    if (close) close.closest('dialog')?.close();
    const action = event.target.closest('[data-action]');
    if (!action || !data) return;
    const id = action.dataset.id;
    if (action.dataset.action === 'queue') {
      const on = !record(id).queued; setRecord(id, {queued:on}); announce(on ? 'Report saved to the reading queue.' : 'Report removed from the reading queue.');
      if (document.body.dataset.route === 'queue') renderReportList(true);
      else if (document.body.dataset.route === 'index' && filters.reading === 'queued') renderReportList();
    } else if (action.dataset.action === 'read') {
      const on = !record(id).read; setRecord(id, {read:on, ...(on ? {progress:100} : {})}); announce(on ? 'Report marked as read.' : 'Report marked as unread.');
      const progress = $('#report-progress'); if (progress) progress.value = record(id).progress;
      const label = $('#progress-label'); if (label) label.textContent = `${record(id).progress}%`;
    } else if (action.dataset.action === 'export') exportReading();
    else if (action.dataset.action === 'reset-filters') { Object.assign(filters,{q:'',category:'',min:'',sort:'latest',reading:''}); renderIndex(document.body.dataset.route === 'queue'); $('#report-search')?.focus(); }
    else if (action.dataset.action === 'resume' && activeReport) {
      const body = $('#report-body'); const traversable = Math.max(1, body.offsetHeight - innerHeight * .6);
      window.scrollTo({top:body.getBoundingClientRect().top + scrollY + traversable * record(id).progress / 100 - innerHeight * .2,behavior:'instant'});
    }
  });
  document.addEventListener('keydown', event => {
    const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (data) openPalette(); }
    else if (event.key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      const search = $('#report-search') || $('#source-search');
      if (search) { search.focus(); search.select(); }
      else { location.hash = '#index'; requestAnimationFrame(() => { $('#report-search')?.focus(); }); }
    } else if (event.key === 'Escape' && editing && event.target.type === 'search') { event.target.value = ''; event.target.dispatchEvent(new Event('input',{bubbles:true})); }
  });
  const paletteField = $('.palette-field');
  if (paletteField && !$('#palette [data-close]')) {
    const close = document.createElement('button'); close.type = 'button'; close.className = 'icon-btn'; close.dataset.close = ''; close.setAttribute('aria-label', 'Close find dialog'); close.textContent = '×'; paletteField.append(close);
  }
  $('#open-palette')?.addEventListener('click', () => { if (data) openPalette(); });
  $('#open-queue')?.addEventListener('click', () => { if (data) { renderQueue(); showDialog($('#queue')); } });
  $('#palette-input')?.addEventListener('input', renderPalette);
  $('#palette-input')?.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp'].includes(event.key) && paletteItems.length) { event.preventDefault(); paletteIndex = (paletteIndex + (event.key === 'ArrowDown' ? 1 : -1) + paletteItems.length) % paletteItems.length; updatePalette(); $(`#palette-option-${paletteIndex}`)?.scrollIntoView({block:'nearest'}); }
    else if (event.key === 'Enter' && paletteItems[paletteIndex]) { event.preventDefault(); $('#palette')?.close(); location.hash = paletteItems[paletteIndex].url; }
  });
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
  $('[data-skip]')?.addEventListener('click', event => { event.preventDefault(); $('#main')?.focus(); $('#main')?.scrollIntoView(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(() => { trackProgress(); scrollTick = false; }); } }, {passive:true});
  window.addEventListener('pagehide', () => { if (data) saveReading(); });
  window.addEventListener('storage', event => { if (event.key === readingKey && data) { try { reading = validateReading(JSON.parse(event.newValue)).records; updateReadingControls(); } catch (_) {} } });
  async function start() {
    try {
      const response = await fetch('./data.json', {cache:'no-cache'});
      if (!response.ok) throw new Error(`Edition request returned ${response.status}.`);
      data = await response.json();
      if (!data || !data.metadata || !Array.isArray(data.entries) || !Array.isArray(data.sources)) throw new Error('The edition data has an unexpected format.');
      entries = data.entries; sources = data.sources;
      try { reading = validateReading(readStorage(readingKey, {schemaVersion:1,records:{}})).records; } catch (_) { reading = Object.create(null); }
      prefs = validPrefs(readStorage(prefsKey, {})); applyPrefs();
      $$('[data-source-count]').forEach(el => { el.textContent = sources.length; });
      $$('[data-report-count]').forEach(el => { el.textContent = entries.length; });
      $$('[data-last-scan]').forEach(el => { el.textContent = date(data.metadata.lastScanAt); });
      $$('[data-next-scan]').forEach(el => { el.textContent = date(data.metadata.nextScanAt,true); });
      $$('[data-interval]').forEach(el => { el.textContent = cadence(); });
      const repo = $('#colophon-repo'); if (repo && data.metadata.repository) repo.innerHTML = `${external(`https://github.com/${data.metadata.repository}`, 'Source & research archive')} · <a href="feed.xml">RSS</a> · Edition generated ${date(data.metadata.generatedAt)}.`;
      if (!navigator.platform?.toLowerCase().includes('mac')) $$('[data-kbd]').forEach(el => { el.textContent = 'Ctrl K'; });
      route();
    } catch (error) {
      app.setAttribute('aria-busy','false');
      app.innerHTML = `<section class="state empty-state wrap"><p class="eyebrow">Edition unavailable</p><h1>The reading room could not load.</h1><p>The published edition may still be deploying, or the connection may have failed. Refresh to try again.</p><button type="button" class="button" id="retry-load">Try again</button><details><summary>Technical detail</summary><p>${escape(error.message)}</p></details></section>`;
      $('#retry-load').addEventListener('click', start);
    }
  }
  if (app) start();
})();
