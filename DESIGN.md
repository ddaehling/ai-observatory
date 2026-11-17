# Parallax · AI Observatory — the design: Long Exposure

This describes the front end as it is built: `src/index.html`, `src/styles.css`, `src/app.js`
and `src/assets/`. Every statement here is about code that exists. What is not built is
listed in §12, not implied away.

No framework, no build step, no dependencies, no third-party requests. The site is three
files, four self-hosted font files and one SVG mark. The JavaScript and the stylesheet are
commented and meant to be read and edited in place.

---

## 1. The idea

An observatory's camera keeps its shutter open, and everything that has been in the sky
leaves a trail of light. Parallax opened its shutter on the day of its first scan. Every
report it has studied is a trail: it begins on the day the report was found and ends
tonight, at the meridian, twelve o'clock. Its distance from the pole is its rating. Its
weight is the length of the read. Where the two reviewer runs disagreed, the trail is
doubled: run A cool, run B warm, set apart by how many of the five dimensions they disagreed
on.

The library opens on that photograph, the **plate**. It is the catalogue, not an illustration
of it: every trail is a report, and every report is a trail.

One law runs through every mark on the site:

> **Where the two runs agree, a mark is one stroke of ink. Where they disagree, it splits into
> run A (cool) and run B (warm).** Colour inside a data mark means only that. There are no
> category colours, no decorative gradients, no accent tints on data, and blue never marks
> anything but run A: the focus ring and all chosen or pressed chrome are ink.

Two runs of the same reviewer model are a consistency check, not independent validation. The
design shows that everywhere a rating appears, in words and in the marks, never once in a
footnote.

## 2. The marks

All marks are drawn by `app.js` from the data; none is an image.

| Mark | Where | What it shows |
|---|---|---|
| **The plate** | the library's first screen; the loupe beside the list; the glance in the filter bar; the end of every report | every report as a trail (§4) |
| **The spectrum** | every row, every lead, every report's verdict, Method | five lines, one per dimension in rubric order. Run A rises from the axis to its score, run B falls from it. Agreement is one unbroken stroke of ink; disagreement shifts the halves apart sideways, in the run colours |
| **The mini-dial** | a report's header ("Where it sits on the plate"), Method, the queue | the plate in miniature: every trail faint, the chosen ones lit, doubled where their runs differ |
| **The frame** | the logbook's contact sheet, its entries, the library's day heads | the plate as it stood after one night's scan: the hand at that night, the trails so far (in ink below 240 px), that night's new reports as stars on the hand, a cool and a warm star side by side across the hand where their runs differ, fanned so they never touch and fitted inside the dial |
| **The agreement sentence** | beside every spectrum | "Runs agree on all 5", "Runs differ on 2 of 5", or "One recorded run", in quiet ink: the words say it, and the warm half of the mark beside it is the only colour |

Every mark has a text equivalent: the plate has a full table (*View the plate as a table*),
spectra and dials carry `role="img"` with a spoken description, and the agreement sentence is
always text.

## 3. Themes, colour and type

**Themes** set custom properties and nothing else (`html[data-theme]`, absent = follow the OS):

| Theme | Setting label | Ground | Notes |
|---|---|---|---|
| `darkroom` | Night | `#05070d` | the default when the OS is dark |
| `plate` | Day | `#f2efe8` paper | the default when the OS is light |
| `redlight` | Night vision | `#000` | red light only, for reading at the eyepiece: nothing white, nothing blue. Runs A and B differ by lightness, shape and position |

**Every picture of the plate is a night photograph, in every theme.** On a light page it is
a print mounted on paper, edged with the page's hairline (`--print-edge`). `.night-print`
re-points the page tokens to the sky's for any container that depicts the plate; `.dial` and
`.frame` carry their own sky. Diagrams that are not pictures of the plate (the spectrum, the
rating scales) stay ink on paper.

Measured contrast (WCAG 2.x, night / day / night vision): ink 17.9 / 15.9 / 6.8, quiet ink
6.4 / 5.1 / 5.0, links and run A 11.5 / 7.1 / 6.8, control boundaries 3.6 / 3.3 / 3.1. Under
`prefers-contrast: more` the quiet inks and hairlines strengthen. Under forced colours the
canvases give way to their tables and every mark draws in system colours, run B dashed.

**Type.** One serif family and one mono, self-hosted (`src/assets/fonts/`, SIL OFL 1.1; see
`src/assets/fonts/README.md`):

- **Parallax Serif** (from Source Serif 4): display and reading. Its optical-size axis
  follows the font size, so a 110 px headline gets the sharp display cut and 19 px prose the
  sturdy text cut. Display sizes are light (300) and tightly tracked.
- **Parallax Mono** (from IBM Plex Mono): instrument annotation only (eyebrows, dates in
  lists, counts, the agreement sentence), always in small capitals with open tracking.
- Italic is reserved for the hero title's second half, standfirsts and judgments.
- Nine steps (`--t-mega` … `--t-micro`), all in `rem`, so the reader's text size (Settings:
  S, M, L, XL) rescales the whole system, the canvases' labels included.

## 4. The plate

`mountPlate(root, {onOpen, onHover, mode})` draws it on a canvas, from the catalogue.

- **Geometry.** Tonight is at twelve o'clock; the observatory's whole life fills 0.86 of a
  turn, so the empty wedge before the opening day holds the rating numerals 4 to 8. Ratings
  map from 3.6 at the pole to 8.2 at the rim. Equal ratings are fanned into bundles of
  parallel trails, oldest first.
- **Trails** fade along their length with a conic gradient, from a faint start to a bright
  head at the meridian. Light adds up (`lighter`); under night vision it combines by
  per-channel maximum, so stacked red trails can never bloom white.
- **On wide screens** the pole sits right of centre and low. The hero measures the line boxes
  of its own words and moves the pole right, shrinking the dial only if it must, until no
  trail, tick or rim label runs under a word. The title is bounded by the viewport's height
  as well as its width, and the hero budgets the gallery label's measured height, so the
  title, lede, figures and the label share the first screen in every theme, from 1024 × 768
  and a 13-inch laptop's real browser viewport (1280 × 690) to 1920 × 1080. **On phones** the
  plate comes first and the title rests on its dark foot.
- **The exposure.** Once per session, once most of the plate is in view, the shutter replays:
  the hand sweeps from the opening day to tonight in 3.6 s and the trails are drawn behind it,
  the hand labelled with the date it has reached (inside the rim on phones, so it never
  prints over the copy). A click or any key finishes it; scrolling away finishes it at once;
  reduced motion skips it.
- **Reading it.** Pointing at a trail dims the rest, lights the trail and names it in a
  tooltip; a click opens the report the tooltip names. On touch, a tap shows the tooltip with
  an *Open the report* link; a mouse click opens only what the tooltip names. The plate calls
  out both ends of the grammar, the highest-rated report (one stroke of ink) and the one whose
  runs differ most (doubled); a callout that would collide moves below what it meets, with an
  elbowed leader. Each callout carries a real link laid over the painted words: pointing at it
  lights its trail and underlines the name. The dateline above the title names
  the newest report as a link, so the first screen always offers a report to open.
- **The loupe** (`mode: 'loupe'`, from 72em) is the same plate, square and small, sticky
  beside the library list: hovering or focusing a row lights its trail; pointing at a trail
  lights its row. **The glance** (a loupe under 180 px: no text, no pointer handling) docks in
  the filter bar below 72em and lights the trail of the row crossing the reading line as the
  list scrolls.
- **Cost.** There is no animation loop. Frames are drawn on demand, only while the plate is
  visible below the sticky masthead. Tonight's trails are cached in one layer; a filter
  strokes only the trails it keeps, over a dimmed copy of that layer made by a single image
  draw, and clearing the filter costs nothing. Idle, every plate makes zero animation frames.
- **Edges.** The scrim behind the copy and the top edge that melts into the masthead are
  painted on the canvas over its film grain and end in the exact sky colour, so the plate
  meets the page without a seam or bands.
- **Printed**, the plate redraws as a negative: ink on paper.

## 5. The views

- **Library** (`#index`): the plate; its gallery label (*Plate · exposed 18 Oct – 16 Nov 2026
  · 57 trails · a heavier trail is a longer read · doubled where the runs differ: run A, run
  B*, the last two with their colour key); the filter bar (search, categories, minimum rating,
  reading state, sort); and the list, grouped by the night each report was found. Each day
  head carries that night's frame as a small night print beside one line: *Found 22 Oct 2026
  · Edition 3 · 7 reports*. Unfiltered and newest first, the newest night opens as **This
  edition**: one lead with its hero spectrum and judgment, the others as briefs, and the
  night's frame as its picture. From 72em the loupe stands beside the list; below 72em the
  glance rides at the end of the sticky search line, and the row at the reading line is
  marked with a small ink dot as its trail lights.
- **Queue** (`#queue`): the reader's saved reports in their order, beside a mini-dial of
  tonight's plate with every queued trail lit; pointing at a row lights its trail alone and
  names it.
- **Report** (`#report/<id>[/<anchor>]`): the header (eyebrow, title, standfirst in italic)
  and, as a night print with a gallery label, the mini-dial "Where it sits on the plate",
  whose trail draws itself from the night the report was found to tonight when it first comes
  into view. The verdict band: the judgment, what both runs decided (*Both runs approved ·
  high confidence*, or split into run A and run B where they differ), the score with its
  arithmetic, and the hero spectrum. **The verdict acts out the site's name:** each dimension
  the runs split on arrives as one stroke of ink and parts into run A above and run B below as
  the band comes into view; the rating carets part the same way. A split is never left fused
  while it is on screen; under reduced motion it is parted from the start. Then the long read
  with a sticky rail (sections, progress, resume), the ratings, the bibliography, and *Next on
  the plate*: the loupe with this report's trail lit, beside the two reports that follow.
- **Sources** (`#sources[/<id>]`): opens on an emission spectrum of the watched entrypoints:
  one line each, dispersed by kind, placed across its kind's band by the night it joined the
  watch (the plate's own axis, from the first scan to tonight) and as bright as the evidence it
  has led to. An entrypoint that was silent on the last scan is a gap marked ✕. Pointing at a
  line names its source and lights its row; a click opens its record. On narrow screens the
  spectrum folds into one order per kind, like an échelle spectrograph. Then the catalogue,
  grouped by kind, one entry per line in the astronomical-catalogue manner (running number,
  name, host; a two-column index from 80em, where an open record spans both columns), with
  notes and evidence on expand. Pages break only between kinds.
- **Accounts** (`#accounts[/<id>]`): opens on a drift scan of the directory. Every account is a
  faint trail from its first post on record to its last, with each post a point of light on
  it, ordered by its latest post, so the trail heads sweep down from tonight into the past;
  posts from before the shutter opened sit to its left on a compressed axis. The three
  accounts introduced below it (a lab, a researcher, a builder) are lit and named. Pointing at
  any trail names the account and lights its row. Each row carries a time strip on the same
  axis, and each platform's head (*On X · 220 accounts*) carries all of that platform's posts.
- **Editions** (`#editions[/<id>]`): the logbook. A contact sheet of one frame per scan,
  oldest first, on a film strip: read across, it is the exposure, night by night, with a blank
  frame for the next scan. Then the entries, newest first: the frame enlarged, the date, the
  reports the night added, the counts in one mono line, the coverage note, and the operator's
  note folded under its first sentence.
- **Method** (`#method[/<section>]`): how the instrument works: the plate as an annotated
  night print, the spectrum explained on a real report, the rubric's five dimensions with this
  library's ranges, and the limits.
- **Settings** (`#settings[/<section>]`): theme, text size, motion, transparency, keyboard
  shortcuts, and the reader's own data (export, import, clear).
- **Dialogs**: the palette (⌘K or Ctrl+K: reports, pages and actions; `/` focuses the search
  field instead) and the reading-queue sheet.

## 6. Shape, space, motion

Rules are hairlines (`--line`), dividers between groups `--line-2`; radii are small
(2–8 px): this is an instrument, not an app. Space comes from the `--s-*` scale only.

Motion explains change and nothing else: the exposure, the verdict parting, rows easing in
after a filter, and View Transitions between a library row and its report title. All of
it stops under reduced motion (the OS setting or Settings → Motion → Reduce).

## 7. Responsive behaviour

The plate composes per shape, not per breakpoint: beside the copy on wide screens (aspect
over 23:20), first and square above the title on narrow ones. The loupe appears from 72em;
below it the glance keeps the plate in sight. Nothing scrolls sideways at 320 px or with XL
text; tables scroll inside their own labelled containers. The masthead compacts in steps
when its content does not fit: tool labels, then the brand's subtitle, then the nav (the menu
button takes over).

## 8. Accessibility contract

WCAG 2.2 AA in all three themes. Every canvas is `aria-hidden` and has a text equivalent: the
plate's table, the list, and real links for every report the plate names. Visible focus
everywhere, in ink. Targets at least 24 px, 44 px on touch. One polite live region
(`#announcer`). After every navigation focus moves to the view's `h1` and the masthead never
covers a focused element. Reduced motion is honoured from the OS and from Settings; forced
colours, increased contrast, print and night vision are designed states, not fallbacks.

## 9. Performance

Measured on the assembled site with 57 reports: `app.js` 396 KB (119 KB gzip), `styles.css`
223 KB (45 KB gzip), fonts 232 KB (WOFF2, preloaded: the upright serif and the medium mono).
The catalogue (`catalog.json`) loads first; report bodies, sources, editions and accounts load
on demand, with `data.json` as a fallback. Idle, the page makes no animation frames; the plate
draws only when something changes and only while it is visible.

## 10. Integration contract

`app.js`, `styles.css` and `index.html` agree on this surface; the test suites assert it.

- **Routes**: `#index` (aliases `#discover`, `#library`), `#queue`, `#report/<id>`,
  `#report/<id>/<anchor>`, `#sources[/<id>]`, `#accounts[/<id>]`, `#editions[/<id>]`,
  `#method[/<section>]`, `#settings[/<section>]`. Unknown routes and report ids render a clear
  message with a way back; an unknown `#sources`, `#accounts` or `#editions` id shows and
  announces a notice.
- **Ids and hooks**: `#app` (with `aria-busy` while a view loads), `#main`, `#announcer`,
  `#report-search`, `#report-filters` (controls `q`, `category`, `min`, `reading`, `sort`),
  `#report-count`, `#report-list` with `[data-report-id]` on every row (each catalogue report
  exactly once), `#palette`, `#queue`, `#report-body`, `#report-progress`, `#ratings`,
  `section-<id>`, `#preferences` (controls `theme`, `text`, `motion`, `transparency`,
  `keys`), `[data-action]` buttons with `data-id`, `a[data-nav]` with `aria-current="page"`.
- **Storage**: `parallax.v1.reading` (`{schemaVersion: 1, records: {<id>: {queued, read,
  progress, order?, …}}}`; unknown fields and records for reports not in this edition are kept
  untouched) and `parallax.v1.prefs`. Preferences are applied before first paint by the inline
  script in `index.html` and nowhere else at load time, so a dark device never sees a light
  flash. The exposure's once-per-session flag is `parallax.v1.exposed` in `sessionStorage`.
- **Data**: relative `./` paths with `{cache: 'no-cache'}`: `catalog.json` first,
  `data.json` as the fallback, then `reports/<id>.json`, `sources.json`, `editions.json` and
  `accounts.json` on demand. Report HTML is untrusted and sanitised to a short allow-list;
  links open in a new tab with `rel="noopener noreferrer"`; tables are wrapped in labelled,
  focusable scroll containers.

**Rules for anyone editing the stylesheet**
1. Themes set custom properties and nothing else; no raw colours outside the token block.
2. Any container that depicts the plate is a night print (`.night-print`), in every theme.
3. Colour inside a data mark means run A or run B, nothing else. The focus ring is ink.
4. Reduced motion uses `transition: none` and `animation: none`, never a shorter duration.
5. A focused control draws exactly one ring.
6. Nothing that is not a report may live inside `#report-list`.

## 11. How the code is organised

`app.js` is one IIFE written in fragments, in this order: the engine (routing, data, reading
state, preferences, dialogs), the marks, the plate, the library, the report, the pages, and
the boot. `styles.css` follows the same order inside cascade layers: `reset, tokens, base,
components, views, themes, print`. Each fragment opens with a header that lists what it owns
and what it may call. Every top-level name is unique across the file.

## 12. What is not built, and why

- **Minification.** The repository ships its source as it is written: the site is buildless,
  and its comments are its documentation. Stripping the whole-line comments would take
  `app.js` from about 119 KB to about 89 KB gzip and `styles.css` from about 45 KB to about
  31 KB.
- **Windowing.** The library renders its list in batches behind a *more* button and the
  catalogues paginate; neither windows its rows. Past about 1,500 rendered rows that will be
  needed.
- **Shards.** `catalog.json` is loaded whole; at a thousand reports or more it should be
  split.
