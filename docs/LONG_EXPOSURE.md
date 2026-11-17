# Parallax — Long Exposure

**The design specification. Single author. Authoritative for every visual decision.**

## 1. The idea

An observatory's camera keeps its shutter open, and everything that has been in the sky leaves a
trail of light. Parallax opened its shutter on the day of its first scan. Every report it has
studied is a trail: it begins on the day the report was found and ends tonight, at the meridian.
Its distance from the pole is its rating. Where the two reviewer runs disagreed, the trail is
doubled — run A cool, run B warm.

The same grammar runs through every mark on the site:

> **Where the two runs agree, a mark is one stroke of ink. Where they disagree, it splits into run A
> (cool) and run B (warm).** Colour inside a data mark means only that. There are no category
> colours, no decorative gradients, no accent tints on data.

The library opens on the plate (a full-viewport canvas, already built). Every report also carries
its **spectrum**: five lines, one per dimension; run A rises from an axis to its score and run B
falls from it to its score; agreement is one unbroken line, disagreement shifts the halves apart
sideways. The **mini-dial** places a report — or an edition's reports — on the plate in miniature.

## 2. What is already built — use it, do not rebuild it

| Part | File | You call |
|---|---|---|
| Tokens, faces, themes | `parts/css/00-tokens.css` | the custom properties only |
| Engine | `parts/js/00-core.js` | its API (see the engine's apiDoc) |
| Marks | `parts/js/10-marks.js` | `spectrum(entry, {size:'row'|'lead'|'hero'})`, `spectrumLabel(entry)`, `miniDial(entry, {size, highlight:Set})`, `plateFrame({asOf, newIds, size, label})`, `numberWords(n)`, `capitalise(s)`, `plateEpoch`, `plateTies`, `plateRadius`, `plateAngle`, `PLATE` |
| The plate | `parts/js/20-plate.js` | `plateHeroHTML()`, `plateLoupeHTML(caption)`, `mountPlate(rootEl, {onOpen, onHover, mode:'hero'|'loupe'})` → `{highlight(id), filter(Set), refresh(), destroy()}`, `plateTableHTML()`, `plateNewest(entries)`, `plateName(entry)` |
| Mark + plate styles | `parts/css/20-plate.css` | classes `.spec`, `.dial`, `.frame`, `.night-print`, `.agreement` (+ `.is-split`), `.plate-*` |

Never restyle `.plate-*` from another file. Never introduce a colour that is not a token.

## 3. Typography — one serif family, used with conviction

- **Source Serif 4** (`--font-display` / `--font-text`) carries everything you read. Its optical-size
  axis follows `font-size` automatically: do not set `font-variation-settings` for `opsz`.
- **Display** (page titles, report titles, the hero, big numbers): weight **300**, `--track-display`,
  `line-height` .94–1.02, `text-wrap: balance`. Italic for the second half of a title is the house
  gesture: `Fifty-seven reports, <em>one long exposure.</em>` — use it sparingly and only where a
  title genuinely has two halves.
- **Reading**: `--t-read`, `--lh-read`, weight 400, `font-variant-numeric: oldstyle-nums proportional-nums`,
  `hanging-punctuation: first`, `text-wrap: pretty`, measure `--measure`.
- **Numbers that are data** (scores, counts): lining tabular figures (`'lnum' 1, 'tnum' 1`), display
  weight 300 at large sizes.
- **IBM Plex Mono** (`--font-mono`) is for *instrument annotation only*: eyebrows, dates in lists,
  the agreement line, axis labels, keys, hashes. Always `--t-micro`, weight 500, uppercase,
  `--track-micro`. Never for a sentence a person reads for meaning.
- Nine sizes exist (`--t-mega` … `--t-micro`). Use no others.

## 4. Composition per view

### 4.1 Library (`#index`, `#queue`) — `30-library.js` / `30-library.css`
1. **The plate.** Insert `plateHeroHTML()` at the top of `#app`, then `mountPlate(root, { onOpen: id => location.hash = reportURL(id), onHover: id => highlightRow(id) })`. Destroy it when leaving the route. While the plate is under the masthead, set `document.body.dataset.overPlate = 'true'` (IntersectionObserver), and remove it once the plate scrolls away; the masthead reads that attribute (style it from your CSS in `@layer views`: transparent background, `--sky-ink` text over the plate).
2. **This edition** — the reports first found on the most recent discovery date, as large editorial entries in a two-column grid (one column below 56em): mono meta line (category · change type · read time), title at `--t-3` display, the **judgment** in italic at 1.1875rem, and a readout on the right: the score in display numerals, `spectrum(e, {size:'lead'})`, the agreement sentence. Section title: `This edition, <em>{n in words} new trails.</em>` with a mono eyebrow `Edition {k} · {date}`.
3. **The library** (`id="library"` on the section). A controls strip, then the list.
   - Controls: `#report-filters` form; `#report-search` (`name=q`); category as a row of chips with live counts (radio group `name=category`, "All" first); min rating, reading state and sort as compact selects or chips (`name=min|reading|sort`); `[data-action="reset-filters"]`. Offer only options that can match: min-rating choices derived from the data (whole numbers ≤ the highest score). The strip becomes sticky under the masthead on wide screens.
   - `#report-count` states "N of TOTAL reports".
   - `#report-list` rows, grouped by discovery date with a quiet date header. Each row (`[data-report-id]`): left column mono date + category; centre the title (`--t-4`, display weight 400, a stretched link `.row-link` to the report) and a one-line summary; right the `spectrum(e)` then the score and the agreement line; and a queue toggle `[data-action="queue"]`. Row hover/focus calls `plate.highlight(id)`; plate hover highlights the row. Filtering calls `plate.filter(new Set(matchingIds))`.
   - Progressive rendering: first 60 rows, then a `[data-action="more"]` button and an IntersectionObserver sentinel.
   - Empty state with a way out ("Clear the search", "Show all categories").
4. `#queue` renders the same list restricted to the queue in save order, without the plate, with its own empty state.

### 4.2 Report (`#report/<id>[/<anchor>]`) — `40-report.js` / `40-report.css`
Paint the header instantly from the catalog entry; fetch `loadReport(id)` for the body; stale-load guard; skeletons while loading; `renderMissing('report')` on failure.
1. **Header** on `--bg`: back link to the library; mono eyebrow (category · change type · entity); the title at `--t-1` display 300, max 18ch; the standfirst (summary) in italic at `--t-3`; a mono meta line (read time · words · sources · found date · published date); actions: queue, read, official source. On the right on wide screens, `miniDial(entry, {size: 168})` with a caption "Where it sits on the plate".
2. **The verdict** ("At a glance"), immediately below, before any prose: a two-column band ruled top and bottom. Left: mono label "The verdict" and the judgment at 1.5rem display 400. Right: the score at 6rem display 300 with "/ 10", the `arithmetic(entry)` line in mono, `spectrum(entry, {size:'hero'})`, the agreement sentence, and `HONESTY`. Below, two columns: "Try it for" (useCases) and "Know the limits" (limitations).
3. **The prose**: sanitised section HTML (the engine's sanitiser), each section `id="section-<id>"` with a numbered heading (mono numeral `01` beside a display `--t-2` heading). First paragraph of the first section gets an initial letter (3 lines) where `initial-letter` is supported. Tables in scrollable, focusable, labelled wrappers. A margin column on wide screens: "Cited here" listing the sources linked in that section.
4. **The ratings** (`id="ratings"`): one row per dimension: label and its rubric text; run A and run B scores; a horizontal 1–10 track with A as a cool caret above and B as a warm caret below (fused into one ink mark where equal); both runs' rationales side by side, collapsed when the runs agree and open where they differ. Then each run's verdict, confidence, model and reviewed date, and the content-verification hashes in a disclosure. `HONESTY` closes the section.
5. **Sources** (`id="sources"`): the bibliography, numbered, each with what it supports, locator, accessed and published dates.
6. **Reading progress**: the engine's `observeProgress`; `#report-progress` lives in a sticky side rail with the contents (current section marked) and a resume control; `#readbar` at the top. End the report with "Next on the plate": the two nearest trails by date.

### 4.3 Pages — `50-pages.js` / `50-pages.css`
- **Sources** (`#sources`, `#sources/<id>`): "The catalogue". Header with a display title and the counts from `state.sourceStats` rendered immediately (kind and status as quiet horizontal bars with numbers), then `loadSources()` in the background. Default view: recurring entrypoints first, grouped by kind; evidence pages behind a filter. Rows in an astronomical-catalogue style: a mono running number, the name (serif), the host in mono, kind and status as text plus a shape glyph (●  active, ○ unverified, ✕ blocked). Paginated at 50. `#source-search`, `#source-count`, `#source-list`, filters `q kind status scope`. Never lead with unverified crawl leads.
- **Accounts** (`#accounts`, `#accounts/<id>`): "The people and teams we watch". Same catalogue language; platform, role, status, topics, why we watch them, evidence on expand; filters `q platform status` (status defaults to assessed); `#account-count`; deep links open the entry without adding history.
- **Editions** (`#editions`): "The logbook". One entry per scan, newest first: the date in display numerals, mono counts (checked, failed, candidates, new reports), the coverage note, limitations collapsed, and `miniDial(null, {size: 120, highlight: new Set(ids of reports first found that day)})` showing what that night added. Label the cumulative library size as such.
- **Method** (`#method`): "How the instrument works": the plate explained with a live `miniDial`, the spectrum explained with one real annotated `spectrum(…, {size:'hero'})`, the five dimensions with their rubric text, the two runs and `HONESTY`, the depth rule (1,000 / 2,000 / 3,000 words by impact), and what the process cannot promise.
- **Settings** (`#settings`): "Observing conditions". Theme as four cards (Automatic, Night, Day, Night vision) each with a tiny preview swatch of the plate and a spectrum in that theme's tokens — radio group `name=theme` with values `auto darkroom plate redlight`; text size as an "Aa" ladder (`name=text`, s/m/l/xl); motion (`name=motion`, allow/reduce); reading data export/import (`#reading-import`, `#settings-status`); the public scan schedule; feed and repository links.
- Palette and queue sheet are the engine's; style them in `50-pages.css` in the catalogue language.
- Not found, empty, error and loading states everywhere: a display line, one sentence, one way out.

### 4.4 The shell — styled in `50-pages.css` (masthead, colophon, dialogs)
- **Masthead** (`header.masthead`), height `--mast-h`, full width, content aligned to `--gutter`:
  left the brand (the inline mark at 22px, then "Parallax" in display serif 1.25rem weight 400,
  then "An observatory for AI" in mono micro, hidden below 64em); centre the nav in text serif
  `--t-small`, the current link marked by a 4px dot beneath it (not an underline, not a pill);
  right the tools as quiet mono micro buttons: "Search ⌘K", "Queue" with its count, the theme
  toggle (a 16px half-filled disc that flips), "Settings". On `--bg` it gains a hairline bottom
  border once the page has scrolled. Over the plate (`body[data-over-plate]`, set by the library)
  it is transparent with `--sky-ink` text — style that variant in `30-library.css`. The brand
  mark's paths `.brand-a` and `.brand-b` take `stroke: var(--cool)` / `var(--warm)`.
- **Phone** (< 56em): brand, Search, Queue and a "Menu" button; `#menu` is a full-screen dialog on
  `--bg` with the nav as a stack of display-serif links at `--t-2`, the current one in italic.
- **Colophon**: a quiet closing band on `--bg-2`: a display line at `--t-2` — "The shutter is still
  open." — then one sentence with the next eligible scan date; then three columns of links (Read:
  library, editions, method; Your reading: queue, settings, export; Follow: RSS feed, the source
  and research archive `#colophon-repo`); then the honesty sentence and "This site sets no cookies
  and loads nothing from anyone else." in `--ink-3`.
- **Command palette** (`#palette`): a centred sheet 40rem wide on `--surface` with `--shadow`, the
  input in display serif 1.5rem with no box, only a hairline beneath; results grouped under mono
  headings; each result a title in serif with its spectrum (`size:'row'`) and score on the right;
  the selected option marked with a 2px `--accent` bar on the left, not a fill. Esc hint in mono.
- **Queue sheet** (`#queue`): slides from the right on wide screens, from the bottom on phones; the
  queued reports in save order, each with its progress as a thin trail-like arc beside it (a 24px
  SVG ring segment filled to the reading progress), title, minutes left, remove button.
- **Shared element transition**: the library row title (`.row-title`) and the report `h1` share a
  `view-transition-name` through the engine's `setTransitionNames`; the report's spectrum fades in
  after. Under reduced motion there is no transition.

## 5. Shape, space, motion

- Rules are hairlines (`--line`), dividers between groups `--line-2`. Radii are small (`--r-1`/`--r-2`); this is an instrument, not an app. No drop shadows except on dialogs (`--shadow`). No glassmorphism except the plate tooltip and dialogs over the plate.
- Space from the `--s-*` scale only. Generous vertical rhythm between sections (`--s-9`).
- Motion explains change only: rows fading in on filter (≤ 180 ms), the plate's exposure, View Transitions between library and report (the row title → report title shared element via `setTransitionNames`). Everything off under reduced motion.

## 6. Non-negotiable

Every item in `docs/DESIGN_AUDIT.md` §7. WCAG 2.2 AA in all three themes (the tokens are already
measured — do not introduce new colours). Visible focus everywhere. 24 px minimum targets (44 px on
touch). No horizontal scroll at 320 px or with XL text. The integration contract (ids, hooks, control
names, routes) exactly. Both suites green: `regress.mjs` and `quality.mjs`.

## 7. The standard

Ask of every surface: is this the most beautiful and the most honest way to show this particular
thing? If a surface could belong to any other website, it is not finished.

## 8. Decisions after review

Two rounds of independent review (a technical verifier and a design critic) shaped these rules.
They are as binding as the rest of this document.

- **Every picture of the plate is a night photograph, in every theme.** The hero, the loupe, the
  glance, the frames of the contact sheet, the mini-dial and Method's annotated dial are all drawn
  on the sky. On a light page they are prints mounted on paper, edged with the page's hairline
  (`--print-edge`). `.night-print` re-points the page tokens to the sky's for any container that
  depicts the plate; `.dial` and `.frame` carry their own sky. Diagrams that are not pictures of
  the plate (the spectrum, the rating scales) stay ink on paper.
- **The first screen names reports, and the names are links.** The dateline above the title reads
  "Edition 11 · 14 Nov 2026 · Newest: …" with the newest report as a link. The canvas calls out
  both ends of the grammar, HIGHEST RATED (one stroke of ink) and RUNS DIFFER MOST (doubled), and
  each callout carries a real link laid over the painted words. Pointing at it lights the trail
  and underlines the name. This settles the audit's must-fix 9 without an exception. The brand
  line lives in the masthead only. A callout that would collide moves below what it meets, with
  an elbowed leader, so both appear from 1024 × 768 up. Every picture that names what is under
  the pointer (the plate, the loupe, the catalogue's spectrum, the drift scan) opens, on a mouse
  click, only what it has named; touch taps name first.
- **The dial keeps clear of the words.** On wide screens the hero measures the line boxes of its
  copy and moves the pole right, shrinking the dial only if it must, until no trail, tick or rim
  label runs under a word. The title is bounded by the viewport's height as well as its width, and
  the hero budgets the gallery label's measured height (`--lib-label-h`), so title, lede, figures
  and the label under the plate share the first screen, in every theme, from 1024 × 768 and the
  real browser viewports of 13-inch laptops (1280 × 690, 1366 × 657) to 1920 × 1080. On phones
  the moving date of the exposure sweeps inside the rim, never over the copy.
- **Blue means run A, nothing else; warm means run B, nothing else.** The focus ring (`--focus`)
  and every chosen or pressed piece of chrome (`--accent`: chips, pressed buttons, meters, the
  reading bar, the skip link) are ink in every theme. The agreement sentence says "Runs differ"
  in words, in quiet ink; the warm half of the mark beside it is the only colour.
- **Frames keep the grammar in miniature.** A night's new reports are stars on the hand: one of ink
  where the runs agree, a cool and a warm star side by side where they differ, fanned along the
  hand so they never touch, the cool and warm pair set across the hand, and the whole fan fitted
  inside the dial: a crowded night shrinks its stars rather than spill them past the outer ring.
  Below 240 px a frame draws its accumulated trails once, in ink, since a doubled trail cannot be
  resolved there and its last-drawn colour would tint the frame. Frames quantise their arcs, so
  their size does not grow with the library.
- **Below 72em the plate stays in sight.** A glance plate (under 180 px, no text, no pointer
  handling) docks in the library's sticky bar and lights the trail of the row crossing the
  reading line as the list scrolls.
- **The plate paints its own veils.** The scrim behind the copy and the top edge that melts into
  the masthead are drawn on the canvas over the film grain and end in the exact sky colour, so the
  plate meets the page and the masthead without a seam or bands.
- **A plate hidden under the masthead is out of view.** It draws nothing; a filter repaints only the
  trails it keeps, over a dimmed copy of the plate made once.
