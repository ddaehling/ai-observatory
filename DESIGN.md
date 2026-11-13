# Parallax · AI Observatory — the design

This describes the front end as it is built: `src/index.html`, `src/styles.css`,
`src/app.js` and `src/assets/`. Everything here is a statement about code that exists.
Where something in the build specification was not built, or was built differently, it
is listed in §15 rather than implied away.

No framework, no build step, no dependencies, no network except the site's own JSON.
The whole interface is three files plus one authored SVG.

---

## 1. What the design has to do

The product is 53 long-form, source-linked research reports (thousands later). Each is
rated on five dimensions by **two runs of the same reviewer model**, and the public
score is their mean. The hard problems are therefore:

1. **Say what a rating is without overselling it.** Two runs of one model is a
   consistency check. The design has to make that legible everywhere, not once in a
   footnote.
2. **Make 53 near-identical scores distinguishable.** Overall scores span 4.0–7.8, and
   45 of 53 share a score with another report. A single number cannot carry the page.
3. **Be readable.** The reports are 1,000–3,000 words and the reader is a teacher who
   wants to decide in ten seconds and read in ten minutes.
4. **Stay honest about provenance.** 3,009 source records, 2,282 of which were never
   opened. The pages that prove rigour must not pretend to more than they hold.
5. **Scale.** Nothing may render thousands of rows, and nothing may wait on a 1.76 MB
   file before it is useful.

## 2. Art direction: Quiet Observatory

*One object, measured twice.* Reports sit on calm opaque surfaces and are read in a
serif voice. Chrome floats as glass only where content scrolls beneath it. The only
chroma inside a data mark is the distance between the two reviewer runs.

Three laws run through the whole stylesheet.

**The ink law.** Data marks are drawn in `--mark` (ink). Colour inside a mark means
exactly one thing: *the two runs disagreed on that value*. Chroma is spent in two
places only — `--accent` for interactive affordances (links, focus, selected chip,
primary button) and `--gap` for disagreement. There is no category colour; a category
is a glyph plus its name. There is no "destructive red": the clear-everything control
is an outlined button behind a disclosure that explains what it does.

**The shape law.** Run A and run B stay distinguishable by shape and position with
chroma switched off. A is a caret **above** the rail, B a caret **below** it; where
they agree the two carets fuse into a closed hourglass. In a list row the pair becomes
one bar per dimension: the bar reaches the higher run, the ink reaches the lower, and
the tinted cap between them is the disagreement. Tested under `forced-colors: active`,
in night vision and in print, where the tint degrades to a 45° hatch.

**The honesty law.** Three sentences are generated from data and never cut:
`Runs agree on all 5` / `Runs differ on 2 of 5` on every row, tile and card; the
arithmetic line `Mean of five dimensions: (…) ÷ 5 = 6.8` under every overall score; and,
verbatim, in every ratings card and on Method:
**"Two runs of the same reviewer model: a consistency check, not independent validation."**
No surface describes A and B as experts, opinions, independent reviews or validation.
The words are "run A" and "run B" (`HONESTY`, `agreementLine`, `agreementSentence`,
`arithmetic` in `app.js` §6).

## 3. The shape of the stylesheet

`styles.css` is 1,907 lines in one cascade-layer order, declared once at the top:

```css
@layer reset, tokens, base, components, views, themes;
```

| Layer | Holds | Rule |
|---|---|---|
| `reset` | normalisation | — |
| `tokens` | every custom property | no selectors but `:root` |
| `base` | elements, type classes, focus, skip-margins | `:where()` where possible |
| `components` | primitives shared by views | no view may depend on a view |
| `views` | one block per route | may re-open `components` for a new shared primitive |
| `themes` | **custom properties only** | a theme may never restyle a component |

Sections re-open layers rather than inventing new ones: §4 and §5 are `components`,
§6 the library, §6b the shared table wrapper, §6c the reading view, §6d the ledger, the
log, Method and Settings. The only unlayered rules are the tail — reduced motion,
`forced-colors: active` and `print` — which must win over everything.

That structure is the fix for the single worst bug in the old build: one theme rule
(`[data-theme="redlight"] .button { color: #0a0404 }`) out-specified every button state
and blanked 62 labels. In a layered sheet a theme block cannot reach a component rule,
because `themes` only ever sets variables.

**The one hard colour rule:** `--ink-3` is never placed on `--surface-3`. It measures
4.13:1 in the dark theme. Pressed fills and tracks carry `--ink-2` or better.

## 4. Tokens

### 4.1 Colour

Default is **Automatic**: no `data-theme` attribute, `light-dark()` driving both halves
from the operating system, with a duplicated dark block under
`@supports not (color: light-dark(#000,#fff))`. `data-theme="plate"` is light,
`"darkroom"` dark, `"redlight"` night vision.

| Token | Daylight | Night sky | Night vision |
|---|---|---|---|
| `--bg` | `#F4F5F7` | `#14181F` | `#000000` |
| `--surface` | `#FFFFFF` | `#1C212B` | `#110202` |
| `--surface-2` | `#EBEDF1` | `#272D39` | `#1B0403` |
| `--surface-3` | `#E1E4EA` | `#333A48` | `#260605` |
| `--ink` | `#111318` | `#F2F4F8` | `#FF4A3B` |
| `--ink-prose` | `#16181D` | `#E2E6ED` | `#FF4A3B` |
| `--ink-2` | `#474D57` | `#B6BDC9` | `#F2271A` |
| `--ink-3` | `#5F6672` | `#949CAA` | `#F2271A` |
| `--hairline` / `-2` | `rgb(17 19 24 / .11 / .18)` | `rgb(255 255 255 / .12 / .20)` | `rgb(255 60 40 / .22 / .36)` |
| `--rule-strong` | `#767D89` | `#767D89` | `#F2271A` |
| `--accent` / `--focus` | `#0A5FCC` / `#0A5FCC` | `#7FBAFF` / `#9CCBFF` | `#FF4A3B` |
| `--mark` | `#2B3240` | `#DDE3ED` | `#FF4A3B` |
| `--gap` | `#B0520B` | `#FFB65C` | `#FF4A3B` + hatch |
| `--sky-top` / `--sky-bottom` | `#060B1C` / `#10204A` | `#060B1C` / `#081026` | `#000000` / `#0D0100` |
| `--glass-tint` chrome | `rgb(250 251 253 / .98)` | `rgb(26 31 40 / .98)` | `rgb(10 1 1 / .98)` |
| `--overlay-bg` / `--overlay-border` | `#FFFFFF` / `rgb(17 19 24 / .14)` | `#2B3240` / `rgb(255 255 255 / .22)` | `#1B0403` / `rgb(255 60 40 / .36)` |
| `--scrim` | `rgb(17 19 24 / .42)` | `rgb(0 0 0 / .66)` | `rgb(0 0 0 / .80)` |

**The sky panel is the one token that differs between the two automatic halves.** In
Daylight it is the night, deliberately: the only dark object on the page, and the
signature. In Night sky the whole panel sits *below* the canvas — top L\* 3.27,
bottom L\* 5.08, against a canvas at L\* 8.14 — so it reads as a hole punched in the
page rather than a lit slab on top of it. The specification's table gives one pair of
values for both halves; its own prose (§2.1) asks for the hole, and the hole is what is
built.

**Measured contrast** (WCAG 2.x relative luminance; recomputed against these exact
values, not copied):

| Pair | Daylight | Night sky | Night vision |
|---|---|---|---|
| ink on bg / on surface | 17.03 / 18.58 | 16.16 / 14.65 | 6.29 / 6.09 |
| ink-prose on surface | 17.76 | 12.89 | 6.09 |
| ink-2 on bg / surface / surface-3 | 7.80 / 8.51 / 6.68 | 9.42 / 8.54 / 6.04 | 5.08 / 4.92 / 4.57 |
| ink-3 on bg / surface / surface-2 | 5.30 / 5.78 / 4.94 | 6.44 / 5.83 / 4.99 | 5.08 / 4.92 / 4.77 |
| *ink-3 on surface-3 (forbidden)* | *4.54* | *4.13 ✗* | *4.57* |
| accent on bg / surface | 5.47 / 5.96 | 8.79 / 7.97 | 6.29 / 6.09 |
| on-accent on accent | 5.96 | 9.08 | 6.29 |
| selected chip fg on its fill | 5.96 | 9.08 | 5.67 |
| `--mark` on surface / bg (graphic ≥3:1) | 12.86 / 11.79 | 12.51 / 13.80 | 6.09 / 6.29 |
| `--gap` on surface / surface-2 (≥3:1) | 5.18 / 4.42 | 9.29 / 7.96 | 6.09 / 5.91 |
| `--rule-strong` on surface / bg (≥3:1) | 4.15 / 3.80 | 3.89 / 4.29 | 4.92 / 5.08 |

Night vision deliberately lives in a 4.5–6.3:1 band. Hierarchy there comes from weight,
size and fills, never luminance; there is no white, no blue and no large lit field. Its
primary button becomes an outline, its selected chip a bordered `--surface-3`, and the
gap becomes a hatch instead of a second hue.

Every control state is a token — `--control-fg/-bg/-border/-hover-bg/-active-bg`,
`--primary-*`, `--quiet-*`, `--chip-*`, `--chip-on-*`, `--off-*` (the "disabled" set,
still ≥4.5:1), `--field-*`. Outside the token block there is one raw hex in the whole
sheet: `--rule-strong`, and the fixed `--pv-*` set in §6d, which are *pictures of the
three themes* for the appearance previews and must not follow the live theme.

### 4.2 Material and elevation

| Level | What | Treatment |
|---|---|---|
| 0 canvas | the page | `--bg` plus one soft `--zenith` glow (none in night vision) |
| 1 content | rows, tiles, cards, tables | opaque `--surface`, 1px `--hairline`, `--sh-1`; hover lifts 2px with `--sh-lift` |
| 2 floating chrome | the masthead **band**, the library toolbar, the phone tab bar | `--glass-tint` (98%) + `backdrop-filter: blur(26px) saturate(1.7)` |
| 3 overlay | palette, queue sheet, the glance popover | opaque `--overlay-bg` over `--scrim`, `--sh-overlay` |

**The masthead is a band, not three islands.** The capsules carry no surface of their
own; the band behind them does, and it appears only once the page has scrolled
(`body.stuck`), because at rest there is nothing passing underneath it to hide. The
earlier build left two fully transparent 165px gaps between three floating capsules, and
article prose ran through those gaps and smeared behind the capsules at every scroll
position. The selected tab stays the one opaque lens on the band.

Translucency exists only where content actually scrolls beneath it, and it is never
load-bearing: at 98% the chrome is legible with the blur switched off entirely, which is
the honest floor, because `backdrop-filter` is unsupported in some rendering paths (the
headless Chromium this project verifies in among them) and a 90%-ish tint there leaves a
readable ghost of the prose behind the band. The blur is depth on hardware that has it,
not the thing keeping the labels readable.

At most two blurred surfaces are on screen at once. On a phone the masthead drops its
blur entirely: `backdrop-filter` makes its element the containing block for fixed
descendants, and the phone tab bar lives inside that band — with the filter on, a
scrolled page dragged the tab bar up under the masthead.

`@media (prefers-reduced-transparency: reduce)`, the reader's own
**Transparency → Reduce** preference (`:root[data-transparency="reduce"]`) and
`@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`
all collapse `--glass-tint` to `--surface` and deepen `--scrim`.

### 4.3 Motion

Four curves, sampled from a damped oscillator as CSS `linear()`, with a
`cubic-bezier` fallback under `@supports not (transition-timing-function: linear(0,1))`:
`--spring-smooth` (progress, scroll-linked), `--spring-snappy` (gauge carets, tiles,
view transitions), `--spring-bouncy` (button press), `--ease-out` (fades). Durations:
`--t-micro 120ms`, `--t-small 240ms`, `--t-medium 420ms`, `--t-large 560ms`.

What moves: the clicked title morphing into the report H1, the gauge carets converging
once per ratings card, chips and rows on hover, sheets rising. What never moves:
backgrounds, list entrances, anything on a timer, anything beside prose.

`@media (prefers-reduced-motion: reduce)` and `:root[data-motion="reduce"]` both set
`transition: none` and collapse animations to 1 ms — `transition: none`, never
`transition-duration`, because a duration on `*` leaves the transition running with a
zero delay and still fires transition events.

## 5. Type

System faces only; nothing is downloaded.

| Role | Stack |
|---|---|
| `--font-ui` | `system-ui, -apple-system, "SF Pro Text", "Segoe UI Variable", …` |
| `--font-serif` | `ui-serif, "New York", "Iowan Old Style", Charter, "Sitka Text", Cambria, Georgia` |
| `--font-num` | `ui-rounded, "SF Pro Rounded", system-ui` with tabular lining figures |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas` — hashes and record ids only |

**The voice rule: the publication speaks in serif, the instrument speaks in SF.**
Serif: the library display line, the report H1, all report prose, the editorial
judgment, coverage notes, Method's prose, the text-size sample. SF: everything that
labels, navigates, filters or measures — including reviewer rationale, which is the
instrument talking *about* the report. Section headings inside a report are SF semibold
(`.title-2`), which gives a three-level rhythm: serif H1 → SF H2 → serif prose, and
makes the contents list and the headings match.

Sizes are tokens (`--fs-display`, `-h1`, `-title-1`, `-title-2`, `-lead`, `-row`,
`-tile`, `-lede`, `-body`, `-prose`, `-judgment`, `-callout`, `-label`, `-kbd`), all in
`rem` or `clamp()`. `--fs-lede` is a flat `1.25rem` rather than a viewport clamp: the
clamp used to land on arbitrary values (20.16px at 1440px) that belonged to no step in
the scale. No uppercase anywhere, no letter-spaced eyebrows. Prose gets
`hanging-punctuation: first last`, `text-wrap: pretty` and old-style proportional
figures; everything else uses tabular lining figures. The reading measure is
`--measure: 43.125rem` with prose capped at 70ch, tuned against Iowan Old Style rather
than New York because Iowan is the wider common case.

The text-size preference rescales the root (`93.75% / 100% / 112.5% / 125%`), and
because every length including the data marks is in `rem` or `%`, the entire design —
bars, carets, gauges, charts — scales with it. Breakpoints are in `em`, so changing the
text size recomposes the layout the way Dynamic Type does.

## 6. Space, grid, radii

4-pt scale `--s-1 … --s-13` (0.25rem … 8rem). Page gutter `clamp(1rem, 4.2vw, 3rem)`,
reading measure `43.125rem`, margin column `13.75rem`.

**One frame.** `--container` is `calc(78.5rem + 2 × --gutter)` and *everything* resolves
to it: the masthead row, the colophon row, the library, a report and all four folio
pages. The brand in the masthead, the rail of a report, the heading of the ledger and
the first word of the colophon stand on one vertical (x = 92 at 1440px), and the right
edges match too. The capsules are pulled out by their own padding so their *content*,
not their hit area, lands on that line. Before this the chrome sat on a 75rem frame
while the report sat on a 78.5rem one, so the rails of Settings, Editions and Method
floated in the gutter aligned to nothing. A folio page without a rail keeps its narrower
measure by capping its content, never by re-centring the frame.
Radii are concentric: `--r-1 .375rem` (kbd) … `--r-6/-7 1.75rem` (cards), `--r-pill`.

Two grids carry the site and they share a right edge:

- **Report** (`.report`, ≥74em): `[rail] minmax(10.5rem,14.25rem) [col] minmax(0, measure + note-gap + note-w)`, areas `". head" ". glance" "rail body" "rail rate" "rail cite" "rail end"`.
- **Every other page** (`.folio:has(> .folio-rail)`, ≥74em): the same rail width, the
  same column gap, the same column maximum, areas `". head" "rail body"`.

So moving from a report to Method does not move the page under the reader. A page
without a rail (`.folio` alone — the ledger, not-found, boot failure) is a single
centred column capped at `68rem + 2 gutters`.

## 7. The marks

### 7.1 The five-bar profile — list rows, ~2,000 instances
`.profile` is one `<span role="img">` plus five `<i>`: six DOM nodes, no SVG, no
measurement. Each bar's height is the higher of the two runs (`--h`, true zero origin,
`v × 10%`), and a `linear-gradient(var(--mark), var(--mark))` masked to `--k` draws ink
up to the lower run; `--gap-paint` sits behind it, so the uncovered cap is the
disagreement. Ink first in the background list, paint behind — the first layer is on
top. Sizes `.sm` (phone), default, `.lg` (lead tile). The accessible name lists all five
values and the agreement sentence. The persistent key lives in the library status line.

### 7.2 The caret gauge — reports and Method
`.g-scale` is a 1–10 rail with 10 ticks, `.g-a` (▼ above) and `.g-b` (▲ below) placed at
`--p: (v − 1) / 9 × 100%`, `.g-m` the mean as a short upright, and `.g-span` the tinted
band from the lower to the higher run. The band is
`linear-gradient(var(--gap-fill), var(--gap-fill)), var(--gap-paint)`: the flat tint
covers the hatch in the two everyday themes, and wherever `--gap-fill` is transparent —
night vision, `prefers-contrast: more`, forced colours, print — the hatch underneath
becomes the coding. The ratings card is `role="table"` with a labelled cell per
dimension, so the whole structure is speakable.

**Why the bar starts at 0 and the gauge starts at 1** (stated on Method): the bar is a
*length* encoding and must start at zero or it exaggerates differences; the gauge is a
*position* encoding on the rubric's own 1–10 scale and may not be truncated.

### 7.3 The sky — the library hero
An absolutely positioned scatter: x = the date a report was first found, y = its overall
rating on a labelled 4–8 window of the 1–10 scale (the caption says so), radius = read
time, a hollow dot = you have read it, and a **detached outer ring** = the two runs
differed on at least one dimension. The ring is drawn as `outline` + `outline-offset`,
so the gap between the dot and the ring is geometry: it survives night vision and
forced colours, where the tinted halo it replaces did not (in night vision `--sky-gap`
and `--sky-ink` are the same red, and 53 identical dots sat under a caption promising a
tint). The caption counts the rings — *31 of 53* — so a reader is told up front that
disagreement is common rather than exceptional.

**Both axes live outside the plot.** The rating numerals sit in a left gutter and the
dates in a bottom gutter below the lowest gridline, so no gridline runs through a
numeral and no star is plotted underneath a date label. The first and last date are
anchored to the ends of the axis rather than centred on them, which is what used to
shear the last label off the panel's rounded corner.

**One star is named**, atlas-style: the highest rated in the library, with its score.
Nothing else is labelled.

Collisions resolve through a deterministic one-pass bucket beeswarm keyed by
`(dayIndex, round(score × 10))` — no O(n²), no jitter between renders; the offset is
drawn with `translate`, in `rem`. It is one tab stop with roving arrow keys and
`aria-activedescendant`, and **`View as table` is a real control** that swaps the plot
for a sortable table of the same data.

### 7.4 The three codings of the gap
| Context | Coding |
|---|---|
| Daylight, Night sky | `--gap` tint + 1px `--gap` inset on the band; tinted cap on the bar |
| Night vision, `forced-colors`, `prefers-contrast: more`, print | transparent fill, 45° hatch at 3px pitch, solid 1px outline |
| Everywhere, always | the words: `Runs differ on 2 of 5` |

## 8. Component inventory

Primitives (`@layer components`): `.skip`, `.readbar`, `.masthead/.capsule/.brand/.tabs/.tools`,
`.colophon`, `.button` (+`-primary`, `-quiet`, `-danger`), `.icon-btn`, `.textlink`,
`.field`, `.select-wrap` + `select.input`, `.chip`/`.chiprow`/`.chip-n`/`.chip-clear`,
`dialog` dressings (`.palette*`, `.sheet*`, `.queue-*`, `.glance-pop*`), `.bar`,
`.pane`, `.card`, `.state`, `.skeleton-line`, `.skeleton-row`, `.profile`, `.score`,
`.agree`, `.actions`, `.segmented`/`.seg`, `.why` (a disclosure styled as page
furniture), `.g-scale` and its parts, `.folio`/`.folio-head`/`.folio-col`/`.folio-rail`,
`.token`, `.pill`, `.panel`/`.panel-h`/`.panel-say`, `.netline`.

Views add: the library (`.hero`, `.figures`, `.resume-card`, `.sky*` incl. `.sky-label`,
`.toolbar`/`.toolbar-h`, `.statusline`, `.group`/`.group-head`, `.row*`, `.tile*`,
`.tile-score`, `.profile-stack`, `.empty-state`, `.suggest`), the queue page
(`.qpage`, `.qrow*`, `.qempty*`), the report (`.report-hero`, `.glance*` incl.
`.mini-ends`/`.mini-legend`, `.rail`/`.rail-acts`/`.toc*`, `.rsec*`, `.ratings*`,
`.grow` and `.grow.g-agree`, `.spread`, `.page*` for the facing pages, `.bibliography`,
`.report-end`, `.sk*`), and §6d (the ledger `.ledger-open`, `.statbar`, `.statkey`,
`.kinds`/`.kind-share`, `.srcs`/`.src*` incl. `.src-col*`; the log `.chart*` incl.
`.chart-line`/`.chart-axis`/`.chart-legend`, `.editions`, `.edition`, `.ed-*`,
`.lim-list`; Method `.msec`, `.steps`, `.dims`, `.example`, `.keylist`, `.mlimits`;
Settings `.tiles`, `.ptile`, `.pv*`, `.aa*`, `.data-figs`, `.file-field` +
`.button-file`, `.danger-body`, `.settings-status`, `.scan-meta`).

Every interactive target is ≥24px (WCAG 2.2 SC 2.5.8) and primary targets are 44px
(2.75rem buttons, 2.75rem fields, 3.5rem ledger rows, 2.25rem chips, segments and queue
move controls, with 2.5px focus rings at 3px offset). A radio that fills its label sits
at `opacity: 0` over it, so the focus ring is drawn by the base rule on the element that
actually takes focus.

**One ring, never two.** A focused control draws exactly one indicator. Search fields
used to draw two concentric frames — the field's own border turned accent-coloured and
the input's outline sat outside it with a gap — so the input now fills the field (its
icon is absolutely positioned) and its single outline *is* the field's ring.

**One selection idiom.** Everything chosen — an appearance tile, a text-size detent, a
segment of Motion, Transparency, Shortcuts or the vantage control — is drawn the same
way: a lifted `--surface` with a 1px accent ring. Settings used to run bordered preview
tiles and blue-filled pills side by side on one page. Filter chips keep the filled
`--chip-on-*` treatment because a filter is a different kind of statement from a
preference, and the two never appear together.

## 9. The views

### 9.1 Library — `#index`
Hero (eyebrow, serif display *Every report, seen twice.*, lede, four figures, and a
**Continue reading** card that only exists when something is in progress) beside the sky
panel at ≥74em; below 56em the sky drops under the first reports into a remembered
`<details>`. The sky is given a **fixed height** in that band rather than an aspect
ratio, because an aspect ratio let the panel set the band's height and left a 288px hole
under the figures on a first visit, when there is correctly no Continue-reading card to
fill it. The band is as tall as its left column.

Then the sticky toolbar. **The section's name lives in the toolbar**, beside the search
field, rather than on a line of its own above it: that line plus the toolbar plus two
chip rows used to push the first report to y = 1,141 on a 900px screen. It is now 837,
so a report is on the first screen without the reader scrolling.

The toolbar carries search, rating, sort and reset; under it, category chips and
reading-lens chips with live counts; then a status line with the result count, the
profile key and the keyboard hints. *All* and *Any state* — the two chips that mean "no
filter" — are drawn as quiet pills, not as filled accent ones, because two near-
synonymous blue chips at rest read as two active filters.

**A filter change rewrites the list, never the view.** Changing a chip or a menu calls
`renderReportList()` + `refreshChipCounts()`, both of which leave the toolbar's DOM
alone, so focus stays on the control the reader is standing on. Replacing the whole view
used to remove the focused chip with it: the first arrow key checked the next radio and
threw focus to `<body>`, and the second scrolled the page.

The list: the newest date group as a lead tile plus compact tiles, every other group as
rows under a sticky group header. Groups are date-of-first-finding — a recorded fact,
never inferred edition membership. A search marks the matched substring in each title
with `<mark>`.

**The lead band.** The lead tile is sized by its own content (`align-self: start`); it
used to be stretched to the height of the three tiles beside it and collected the
surplus as a 144px hole between the meta line and the score. The arithmetic line sits
directly under the numeral it explains, and the five-bar profile carries its dimension
key beneath it. The side tiles are a smaller version of the same card — same kicker,
same title treatment, same foot of score + profile + agreement — not a different one.

Rows are a stretched-link pattern (one tab stop for the row, one for the bookmark),
**136px at desktop and 156px on a phone**, with `contain-intrinsic-size` computed from
those heights plus the group header, never guessed. An 8rem-per-row guess against a
9.25rem row grew the index 23% as the reader scrolled it and shrank the scrollbar thumb
with it; the document now varies by under 3%. `content-visibility: auto` is on every
group. 60 rows render at a time; an `IntersectionObserver` sentinel appends the next 60.

A row's kicker says which date it is showing, and says it in a different weight from the
date itself (**Released** 18 Jun 2026 / **Found** 11 Nov 2026): a column of both in
identical type reads as dates out of order.

### 9.1b The reading queue — `#queue`
The queue is a page of its own, not the library with every other report filtered out.
Header, the totals (*3 reports · about 19 minutes left*), Export and a link to the
reading-data panel, then the list: title, a progress bar, score, agreement, minutes
left, **Move up / Move down** and the bookmark. No search field, no rating menu, no
twelve chips every one of them reading 0. The empty state is the star, the sentence and
one real button.

Order is a `order` integer on the stored record, assigned when a report is saved and
rewritten by the move controls. Records that predate it sort last by title; nothing is
migrated and no record is ever rewritten just by looking at it.

### 9.2 Report — `#report/<id>`, `#report/<id>/<anchor>`
Header (kicker, serif H1, standfirst, meta, actions) → **At a glance** (the judgment in
serif, the overall numeral, the arithmetic line, then five mini gauges *with the same
ticks, the same 1 and 10 end labels and the same legend as the full gauge below*, the
agreement line and the honesty sentence **verbatim**, then *Try it for* / *Know the
limits* as ink discs and ink rings) → prose with a *Cited here* margin column listing
only the sources that section actually links to → the ratings spread → the bibliography
with research note → an ending that offers the next report instead of blank scroll.

The glance card used to abbreviate Law 3's sentence to *Two runs of one model* — which
is precisely the inference the rule exists to prevent — on the one surface most readers
actually see, with the full sentence 11,000px further down. It now carries the sentence
in full.

The mini gauge is the same mark taught the same way: ticks, end labels and the legend
row (`▼ run A · ▲ run B · | their mean · ▭ the distance between them`). And the two
carets now meet **on** the rail, so where the runs agree they close into an hourglass;
the mean bar is drawn only where the runs differ, because at agreement it sits at the
same value and split the closed shape into an I-beam.

The verdict is on the first screen; the long form is the evidence behind it. The old
build put the judgment 69% of the way down the page.

The sticky rail **starts beside the header**, not on scroll, so the first screen is a
three-column page rather than one column floating in a three-column footprint. It holds
*Your place* (progress bar, percentage, minutes left, a Resume button that appears only
between 5% and 97%), an **At a glance** button, and the numbered contents, whose entries
and headings use the same words. In-report links are `#report/<id>/<anchor>` and the
global click handler turns them into `history.replaceState` + `scrollToAnchor`, so one
Back press always lands on the library.

In the ratings card, a dimension where the two runs **agree** collapses to one line —
name, mark, number, disclosure — and the tall treatment is reserved for a contested one.
A line under the H2 says why the order differs from the glance card's: widest split
first here, rubric order there.

### 9.3 Sources — `#sources`, `#sources/<record id>`
Opens on **what the ledger holds**: three figures (3,009 records, 200 entrypoints
watched, 725 reached at least once), a stacked access bar whose three states differ by
fill *and* by shape *and* by word, the sentence that stops the page overselling itself —
*a record is a place this project knows about, not a claim that it was read* — and a
by-kind breakdown of nine kinds as **name, count and share**, each row a filter. The
counts run from 1,626 to 75, so a bar scaled to the maximum drew eight of the nine as
indistinguishable stubs and hid the distribution it existed to show; a right-aligned
tabular count with its percentage shows it exactly.

The list defaults to the 200 watched entrypoints, grouped by kind with sticky headers
and true group totals, 50 records per page. A search covers the whole ledger and the
scope control switches itself to *Every record* to say so. Each row is a disclosure. At ≥60em it is a real table of columns — name and host, kind,
when it was last reached (relative, with the recorded timestamp in `title`), and the
**topics** the record carries — so a 1,440px row uses its width instead of packing
everything into the left 450px and pinning a chevron 900px away. Below 60em those
columns fold back into the one meta line under the name, which the row carries anyway. Opening one fills in its detail on
demand — address, access and what that means, rota membership, first seen, last checked,
last success, last full window, feed, where it was found (a button that pins that
record), topics, record id, and the scanner's own notes verbatim — and writes
`#sources/<id>` into the address bar with `replaceState`, so a record can be linked to
without a re-render and without filling the Back stack.

The old ledger built 72,371 elements and froze a mid-range phone for 12–20 s. This one
renders 905 nodes.

### 9.4 Editions — `#editions`
**One chart at the full content width**, not three 155×70px panels each propped up by a
three-line caption. Bars for entrypoints reached (solid) against failed or unvisited
(outlined), a step line over them for the library's size after each scan, and the value
and date of every edition labelled beneath. Both encodings are scaled to their own
maximum and the caption says which is which; the SVG line is `preserveAspectRatio="none"`
with a non-scaling stroke, and every value it draws is also printed as a number. Then
one card per edition, newest
first, with a rail of dates on the left: the date, the window it looked at, four figures
with **correct labels** — *reports in the library* with the change since the previous
edition beside it, not "published reports" — the coverage note in serif, a flag when an
edition has more failed accesses than any other (11 Nov: 64, against 0–6 everywhere
else), and the recorded coverage limitations behind a disclosure that fetches
`editions.json` and renders its list only when opened — **open by default on the latest
edition**, per the specification, collapsed on the rest.

It closes with *What this log does not say*: edition membership is only recorded for the
most recent scans, so the page never claims it; a failed access is not a judgment about
a publisher.

### 9.5 Method — `#method`
The page every other surface links to. Eight sections, rail-navigable: how a report
earns its place (six steps, with the current numbers), the five dimensions and the
rubric anchors, *two runs, one model* with the honesty sentence set as a quotation and a
**worked example taken from the live library** — a real dimension where the two runs
split, drawn with the same gauge component the reports use — how to read both marks and
why their scales differ, the depth rule, how sources are used, what the method does not
establish, and the keyboard map.

### 9.6 Settings — `#settings`
Grouped inset panels: **Appearance** as four preview tiles that are miniatures of the
page (sky band, card, two lines of ink) drawn in fixed `--pv-*` colours so a preview of
Night vision looks like Night vision whatever theme is live, and Automatic is drawn as
both halves of the same page; **Text size** as four detents with an "Aa" at its own size
and a live serif sample; **Motion**; **Single-key shortcuts** (On/Off, WCAG 2.1.4);
**Transparency** (Follow the device / Reduce), which switches the chrome's
translucency independently of the system setting; **Your reading data** with four
figures, export, import and a clear control behind a disclosure that states what it
destroys; **The scan schedule**, read-only public information with no localhost
controls; and **Feeds and source**.

`#reading-import` stays in the DOM and stays focusable, but it is visually hidden and
driven by a styled label that mirrors *Export as a file*. A raw
`Choose File | No file chosen` was the only unstyled control on the site, its appearance
changed per browser, and its intrinsic 291px min-content was what scrolled the whole
Settings page sideways at 320px. The focus ring is drawn on the label from
`input:focus-visible + .button-file`, so the keyboard path is unchanged.

### 9.7 Dialogs and states
The **palette** (`⌘K`/`Ctrl+K`) is an ARIA combobox: options carry `role="option"` and
`aria-selected`, the input carries `aria-activedescendant`, arrows move, Enter opens,
`⌘↵` saves the selected report to the queue without leaving the keyboard, Escape closes
and focus returns to the invoker. With no query it offers *Continue reading and queue*,
*Pages*, *Latest reports* and *Actions*; with a query, *Top hit*, *Reports*, *Pages*,
*Actions*, and when nothing matches every word, the closest titles rather than a dead
end. The field is outside the scroll container, so it is always in view.

The **queue sheet** is one ordered list in the reader's own order, with **Move up /
Move down** on every item (SC 2.5.7 — the keyboard path is not optional), a progress bar,
and minutes left in the same unit as the footer total. It keeps focus inside the list
when an item is removed, with an Undo that lasts until the sheet closes. Items used to
show the whole length of a report while the footer counted minutes remaining.

The **glance popover** re-opens the At a glance card from anywhere in a report
(specification §6.3). It does not copy the card: the card itself is moved into the
dialog and moved back on close, so there is one judgment, one set of ids and nothing
that can fall out of step. Focus is trapped by `showModal()`, Escape closes, and the
card returns to exactly where it was with the page's scroll position untouched.

Overlays are opaque. The palette panel used to be translucent enough that a 64px serif
hero and the navy sky panel read through the result rows, and in dark its tint sat
barely above the page; it now sits on `--overlay-bg` (L\* 21 against a canvas at
L\* 8) over a deeper scrim.

Empty, loading, failed and not-found states exist for every surface: library filters
(with the three highest-rated reports in the nearest category), empty queue, ledger
skeleton → ledger empty → ledger failure with Retry, the editions limitation fetch,
report skeletons that match the final layout, an unknown report, an unknown route, a
boot failure with Retry and the feed as an alternative, and an offline line above the
view that never blocks anything.

## 10. Signature moments, and how each is built

| Moment | Implementation |
|---|---|
| **The library, plotted** | One template string of absolutely positioned spans; deterministic bucket beeswarm; one tab stop with roving arrows; a working table equivalent. |
| **From row to report** | `document.startViewTransition()`, feature-detected. `view-transition-name: report-title` is assigned to the clicked link immediately before the render and to the new H1 immediately after, then cleared — the name is never duplicated. Reduced motion skips it. |
| **The gap, made visible** | On the first paint of a finished ratings card the carets travel in from opposite ends, 40 ms apart per row, with the band growing behind them (`caret-settle-a/-b`, `band-settle`, `--spring-snappy`, `backwards` fill so the vantage switch keeps opacity and scale). Skipped entirely under reduced motion. |
| **Close one eye** | The vantage control is three radios; `#ratings:has(#vantage-a:checked)` drops run B's carets to `opacity:.16; scale:.7`, swaps every value through `.v-both/.v-a/.v-b`, and narrows the rationale to one voice. No JavaScript re-render; the overall score is `aria-live="polite"`. |
| **Your place** | An `IntersectionObserver` over `#report-body`'s `p, li, h3, table, blockquote, pre`; a block counts once it has actually been in view. Progress is `max(stored, measured)` and writes debounced; anchors and contents links cannot inflate it. |
| **At a glance, from anywhere** | The rail's *At a glance* button moves the real card into a modal dialog and moves it back on close (a comment node holds its place). One card, one set of ids, focus trapped by `showModal()`, scroll position untouched. |
| **The ledger opening on meaning** | Statistics come from `catalog.json`, which is already loaded, so the page is useful before `sources.json` (1.76 MB) arrives. |

## 11. Responsive behaviour

Breakpoints in `em`: **74em** full report and folio grids, two-column hero;
**60em** margin notes fold, icon-only tools; **56em** phone chrome; **48em** tiles and
kinds go two-up; **24em** tighter numerals and stacked definition lists.

Below 56em the masthead collapses to brand + tools (and drops its blur, §4.2) and the
tabs become a fixed glass tab bar at thumb height; the library figures become a 2×2 grid; rows drop their status
column and put the score line under the title; chips scroll horizontally with an edge
mask; the report's contents become a disclosure, the margin column folds to the end of
each section, and dialogs become bottom sheets. Between 56em and 74em the report becomes
one centred page capped at `measure + 2 × --s-6`, and the folio rail becomes a card above
the content.

Verified by the gate at 320px, at 390px with XL text and at 1440px with XL text, and by
a sweep of every route at 320/360/390/430px × small/medium/large/XL text in both mobile
and desktop emulation, comparing `scrollWidth` against `documentElement.clientWidth`
rather than `innerWidth` (under mobile emulation `innerWidth` expands to the overflow
and hides it): no horizontal scrolling and no clipped element anywhere.

Two reflow failures are fixed at the root rather than patched. `.folio-col` and
`.panels` had an implicit `auto` (max-content) column, so the widest control in a panel
set the page's width — Settings scrolled sideways at 320px at every text size and at
390px with XL text. Both are now `grid-template-columns: minmax(0, 1fr)` with
`min-width: 0` on their children. And `.toolbar .field` used `flex: 1 1 100%` inside an
indefinite grid column, which resolved to 3,940px — twelve times the viewport — on the
ledger at XL text; it is `flex: 1 1 14rem; min-width: 0` and the ledger column is
explicitly `minmax(0, 1fr)`.

## 12. Accessibility contract

- **Contrast**: §4.1, including the `--ink-3`/`--surface-3` exclusion. Measured by the
  gate on six routes in all three themes, resolving alpha against real ancestors.
- **Colour independence**: run A and run B differ by shape and position; categories are
  glyph + word; ledger access is dot shape + word; read state is a check glyph plus a
  label; agreement is a sentence. The `forced-colors: active` degradation is written for
  every mark (§7.4), including `forced-color-adjust: none` on `.profile i` — without it
  Chromium strips both background layers of the five-bar profile and the only graphic
  that encodes run A against run B on 53 index rows goes blank. The automated gate
  measures contrast, focus, targets and reflow but does not emulate forced colours, so
  that one is held by the stylesheet, by a dedicated probe and by review.
- **Focus**: `outline: 2.5px solid var(--focus); outline-offset: 3px`, never removed,
  and never doubled (§8);
  cards outline through `:has(:focus-visible)` and also on the element that takes focus,
  because that is what `getComputedStyle(activeElement).outlineWidth` reports.
  `scroll-margin-top` on every focusable equals the measured sticky stack plus 12px
  (SC 2.4.11) — `measureChrome()` writes `--chrome-h`, `--toolbar-h` and `--stack-h`
  after every render that changes the stack.
- **Keyboard**: `⌘K`/`Ctrl+K`, `/`, `↑↓`, `↵`, `⌘↵`, `Esc`; the sky has roving arrows;
  every dialog returns focus to its invoker; `/` has an off switch (SC 2.1.4),
  implemented as a capture-phase listener that stops the handler that owns it.
- **Semantics**: one `<h1>` per view, no skipped heading levels, landmarks, a skip link,
  `aria-live="polite"` on result counts and the overall score, `aria-setsize` and
  `aria-posinset` on every list item so windowing later cannot change the semantics,
  `aria-current="page"` on the active tab and `aria-current="location"` on the current
  section in a rail.
- **Targets**: ≥24px everywhere, 44px for primary controls, measured on a 390px phone.
- **Dragging (SC 2.5.7)**: the queue is reordered with Move up / Move down buttons, in
  the sheet and on the page. There is no drag-only path to anything.
- **Preferences**: `prefers-color-scheme`, `prefers-reduced-motion`,
  `prefers-reduced-transparency`, `prefers-contrast: more` (hairlines go solid, the gap
  band becomes a hatch), `forced-colors: active`, text size 93.75–125%, 200% zoom — plus
  the reader's own Appearance, Text size, Motion, **Transparency** and Shortcuts
  switches, all of which the inline script in `index.html` applies before first paint.
- **Print**: chrome, toolbars, chips, rails, segmented controls and reading controls are
  hidden; every `<details>` is forced open (with `details::details-content` in its own
  rule so an unsupported pseudo cannot invalidate the rest); gauges print with carets,
  hatched bands and the legend; prose links print their addresses.

## 13. Performance, measured

Payload (gzip -9, as GitHub Pages serves it):

| File | Raw | Gzip | When |
|---|---|---|---|
| `index.html` | 8.6 KB | 2.8 KB | always |
| `styles.css` | 129 KB | 28.5 KB | always |
| `app.js` | 176 KB | 50.6 KB | always |
| `catalog.json` | 123 KB | 29.6 KB | always |
| `reports/<id>.json` | — | 6.1–12.7 KB | one report |
| `sources.json` | 1.76 MB | 210 KB | `#sources` only |
| `editions.json` | 325 KB | 65 KB | only when a limitation list is opened |

First load is **≈112 KB gzipped** against the specification's 150 KB budget. The shell
alone (HTML + CSS + JS) is **82 KB gzipped** against a 45 KB budget, and it is over by a
factor of 1.8. The reason is that the source ships unminified and heavily commented
because the project has no build step: stripping comments and collapsing whitespace
takes it to **62 KB gzipped** (CSS 17 KB, JS 42.5 KB), and a real minifier with
identifier mangling would take the JS a good deal further. That is a publishing
decision, not a design one — nothing in §2–§12 depends on the extra bytes — and it is
recorded here rather than quietly absorbed. Measured runtime is well inside the time
budget: 394 ms to a painted index on a 1.6 Mbps / 150 ms / 4× CPU profile, 215 ms for
the ledger.

DOM and time to useful, measured by the gate on a throttled mid-range phone profile
(1.6 Mbps, 150 ms RTT, 4× CPU):

| Route | Nodes | Notes |
|---|---|---|
| `#index` | 1,917 | 393–394 ms, 60 rows plus the sky |
| `#report/<id>` | 754 | painted from the catalogue entry, then filled |
| `#sources` | 1,096 | 208–215 ms, useful before `sources.json` lands; the desktop row carries real columns |
| `#editions` | 700 | one chart; the latest edition's limitations open, the rest on demand |
| `#method` | 281 | |
| `#settings` | 332 | |
| `#queue` | 144 | the queue page, not the library |
| not found | 152 | |

How it stays there: search runs over a lowercase haystack built once per entry at load
and debounced 120 ms; the library never re-sorts on a keystroke; `content-visibility:
auto` with a `contain-intrinsic-size` computed from the fixed row height for the current
density on every group; no SVG in list rows (six nodes per profile); no `mix-blend-mode`
anywhere; no synchronous measurement in any render path — the intrinsic sizes come from
constants, not from reading layout; the ledger pages at 50 and fills record details on demand; the editions log
fetches `editions.json` only when a disclosure opens.

## 14. Integration contract

`app.js` and `styles.css` agree on this surface. An automated suite asserts it; changing
any of it is a breaking change.

**Ids**: `#app`, `#main`, `#report-search`, `#report-filters`, `#report-count`,
`#report-list`, `#open-palette`, `#palette`, `#palette-input`, `#palette-list`,
`#open-queue`, `#queue`, `#queue-count`, `#queue-body`, `#queue-foot`, `#announcer`,
`#readbar`, `#report-body`, `#report-progress`, `#progress-label`, `#ratings`,
`#sources` (the bibliography inside a report — it shares its name with the ledger
route, harmlessly), `section-<sectionId>`, `#source-search`, `#source-count`,
`#source-list`, `#source-filters`, `#preferences`, `#reading-import`,
`#settings-status`, `#colophon-repo`.

**Hooks**: `[data-action="queue"|"read"|"export"|"reset-filters"|"resume"|"glance"|"queue-up"|"queue-down"|"more"|"more-sources"|"clear-reading"|"sky-table"|"sky-sort"]`,
each with `data-id` where it acts on a report; `[data-report-id]` on every library row
and tile; `[data-source-id]` on every ledger row; `[data-reading-label="<id>"]` and
`[data-reading-glyph="<id>"]`; `a[data-nav="index|sources|editions|method|settings"]`
with `aria-current="page"` on the active one; `[data-close]` / `[data-close-dialog]`
inside dialogs; `[data-skip]`; `[data-kbd]` (and `data-kbd="mod"` for a bare modifier);
`[data-jump]` for in-page rail links; `[data-ledger]` for the ledger's own actions;
`[data-queue="undo"]`.

**Form controls**: `#report-filters` has `q`, `category`, `min`, `reading`, `sort`;
`#source-filters` has `q`, `kind`, `status`, `scope`; `#preferences` has `theme`,
`text`, `motion`, `transparency`, `keys`. `#report-filters` exists on `#index` only:
the queue is its own page and has no library chrome to filter. Selects and radio groups are interchangeable: the handlers
react to `input` and `change` and read `.value`.

**Routes**: `#index` (alias `#discover`, `#library`), `#queue`, `#report/<id>`,
`#report/<id>/<anchor>`, `#sources`, `#sources/<record id>`, `#editions`,
`#editions/<section>`, `#method`, `#method/<section>`, `#settings`,
`#settings/<section>`. Unknown routes and unknown report ids render a clear message and
a link to `#index`.

**Storage**: `parallax.v1.reading` = `{ schemaVersion: 1, records: { <id>: { queued,
read, progress, order?, … } } }` and `parallax.v1.prefs` = `{ theme, text, motion,
transparency, keys, plot }`. `order` is written only when a report is queued or moved;
nothing is migrated and no record is rewritten merely by being read. Import validates
`queued`, `read` and `progress` and carries any other key through untouched.
Records whose report is not in the current edition **are kept untouched** — a withdrawn
report, or one in a shard this visit never loaded, must not lose the reader's place.
Preferences are applied before first paint by the inline script in `index.html` and
nowhere else at load time, so a dark device never sees a light flash.

**Data**: `./catalog.json` first, with `./data.json` as a fallback if a split file 404s;
`./reports/<id>.json`, `./sources.json`, `./editions.json` on demand. All fetches use
`{ cache: 'no-cache' }` and relative `./` paths, because the site lives on a subpath.
Report HTML is untrusted: `sanitise()` allows only `p h3 ul ol li strong em a code pre
blockquote table thead tbody tr th td br`, strips every attribute, rebuilds links with
`target="_blank" rel="noopener noreferrer"`, and wraps every table in a labelled,
keyboard-focusable scroll container.

**Rules for anyone editing the stylesheet**
1. Themes set custom properties and nothing else.
2. No raw hex outside the token block.
3. Never put `color-mix()` or a bare gradient behind text: Chrome serialises
   `color-mix` as `color(srgb …)` and contrast tools read those 0–1 numbers as
   near-black. Use an `rgb()` token, or set `background-color` beside `background-image`.
4. In a multi-layer `background`, the first layer is on top. Ink first, `--gap-paint`
   behind.
5. Reduced motion uses `transition: none`, never `transition-duration`.
6. `position: sticky` only sticks inside its parent's box — `#report-filters` is
   `display: contents` for exactly that reason.
7. The focus ring must be declared on the element that actually takes focus.
8. If a route adds a sticky bar it must be `#report-filters .toolbar`, or
   `measureChrome()` will not account for it and focus will end up under the chrome.
9. Nothing that is not a result may live inside `#report-list`; the library's empty
   state renders into `#list-empty`.
10. `fmtInt` groups only from five digits up (`useGrouping: 'min2'`), so `#report-count`
    and `#source-count` contain the raw digits the suite looks for.
11. `backdrop-filter` makes its element the containing block for `position: fixed`
    descendants. The masthead holds the phone tab bar, so its blur is declared only at
    ≥56em. Never add one to an element that contains fixed chrome.
12. A focused control draws exactly one ring. If a wrapper recolours its border on
    focus, the inner control must not also draw an outline, and vice versa.
13. A filter change calls `renderReportList()` + `refreshChipCounts()`. Never
    `renderLibrary()`: it replaces the focused control and drops focus to `<body>`.
14. `contain-intrinsic-size` comes from `DENSITY` in `app.js`, never from reading
    layout. If a row's height changes, change the constant with it.

## 15. What is not built, and why

These are gaps, not plans disguised as features.

- **The reading capsule.** The specification's centre chrome capsule morphing into a
  reading capsule on scroll (§6.3) is not built. Its *content* is: the progress ring,
  the percentage and the section the reader is in all live in the sticky rail, and the
  **At a glance** popover it was supposed to carry is built and reachable from that
  rail. What is missing is the morph itself, which is decoration over information that
  already has a home.
- **Searchable coverage limitations.** The latest edition's list opens expanded, as
  specified, but the lists are not searchable. 196 lines is near the point where that
  starts to matter.
- **Edition identity in the date-group headers.** A group header says *Found 11 Nov
  2026 · 4 reports first found*, and does not say which edition that was. It could only
  be inferred by matching a group's date against a scan's finish date, and edition
  membership is not recorded for older scans, so the page does not claim it. The
  Editions log is one click away and says what each scan did.
- **An import summary sheet.** Importing reading data announces what happened — *12
  records, 9 of them in this edition* — in the live region and on the Settings page, but
  not as a sheet that has to be dismissed.
- **Thousands separators below five figures.** Counts are formatted once, by one
  function, with `useGrouping: 'min2'`: four-figure numbers are written without a
  separator (*3009 records*), five figures and up are grouped. That is a real
  convention, it is applied everywhere without exception, and the ledger's own
  integration test pins it — `#source-count` must state the total as `3009`. The
  specification's prose writes *3,009*; the test is the harder contract, and a site that
  is internally consistent is better than one that is half-grouped.
- **A ledger record does not list the reports that cite it.** That needs a citation
  index the catalogue does not carry; building it in the browser would mean fetching all
  53 report files.
- **The ledger inspector is a disclosure in the row, not a side panel.** In-place
  expansion keeps one scroll position, needs no focus trap, and works identically at
  320px and 1440px.
- **Windowing.** The library and the ledger page and use `content-visibility`; neither
  windows its rows. Past ~1,500 rendered rows that will be needed, and the semantics it
  requires (`aria-setsize`, `aria-posinset`, stable focus) are already in place.
- **Shard splitting.** `catalog.json` is loaded whole (30 KB gzipped at 53 reports). The
  specification's 400-report shards become necessary somewhere above a thousand reports.
- **A self-hosted serif.** The reading voice still depends on the platform face.
- **The shell exceeds the gzip budget** by 1.8× (§13), because the source ships
  unminified and commented. Stripping comments alone would take it from 82 KB to 62 KB.
- **Two row densities.** Rows are 136px at desktop against the specification's 124px
  comfortable, and there is no compact density to switch to. The fixed heights and the
  `contain-intrinsic-size` that make one cheap to add are in place.
