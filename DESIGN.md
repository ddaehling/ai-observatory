# Parallax: visual design

This file covers visual design only. Files: `styles.css`, `assets/graticule.svg` (new),
`assets/mark.svg` (unchanged), and small edits to `index.html`. The design does not
rely on `app.js` behaviour beyond the class names and attributes listed below.

## Art direction: the measuring plate

Parallax measures distance by looking at one star from the two ends of a baseline.
The site uses that idea in three ways:

1. **The page is a plate.** It uses warm photographic-plate paper (`#f2eee4`) and
   navy ink (`#13172a`), the colours from the mark. Hero and page headers have a
   faint plate grid behind them. A measuring graticule (`assets/graticule.svg`)
   sits behind the hero, the report header, page headers, the empty state and the
   colophon. The graticule shows rings, tick marks, the A–B baseline, sight lines,
   the near star and its two apparent positions.
2. **Two reviewers are the two ends of the baseline.** Reviewer **A** is a
   *filled vermilion point*. Reviewer **B** is an *open blue ring*. This matches
   the mark's two circles. Shape tells them apart as well as colour, so they stay
   distinct in redlight and for colour-blind readers. Reviewer panels have a solid
   top band for A and a dashed one for B. Mixed or average values use a half-and-half dot.
3. **The chromatic split.** On hover, buttons, tools and pagination split into a
   vermilion edge and a blue edge (`--split`), like a stereo pair slightly out of
   register. The hero title and the colophon wordmark carry a faint version of the
   same split. Gradients always run A to B, for example the read bar, progress bars,
   the catalogue rule on hovered rows and the underline under each section heading.

### Typography (system fonts only, no network)

- **Serif (reading and display):** Iowan Old Style (Apple) / Palatino Linotype
  (Windows) / Palladio / Charter / Georgia. Display sizes are large, light, tightly
  tracked. Italic serif for standfirsts and h3.
- **Sans (UI):** the system UI stack.
- **Mono (instrument labels):** `ui-monospace` / SF Mono / Cascadia. Used in small
  uppercase for metadata, eyebrows, section numbers and tags, like the labels in a logbook.
- Optional official font: none is needed. If one is ever wanted, a **self-hosted**
  Source Serif 4 (SIL OFL) would match the reading voice. Never load it from a CDN.

### Discovery (index)

Index entries are **catalogue rows**, not cards. Rows have a ruled top and no box.
In containers at least `52em` wide, each row has three columns: a mono meta column
on the left (kind, date…), the entry in the middle (serif title, serif summary,
tags), and the readings on the right (`.score`s, then `.row-actions`). The whole row
can be clicked through a stretched link on `.report-title a`. Tags, scores, labels
and buttons sit above that link. On hover or focus the A→B baseline lights up on the
left edge and the title gets a gradient underline. In wide containers the toolbar
sticks under the masthead.

### Reading (report)

`.report-header` holds a large serif title, an italic standfirst (`.report-summary`)
and a mono meta line, with the plate artwork behind on the right. `.reading-layout`
uses two columns (prose plus a sticky `.report-sidebar`) once the container reaches
`62em`. The prose measure is `36em`, or `32em` at XL text. Body text is 19px serif,
line-height 1.68, with old-style figures and a 3-line initial letter where
`initial-letter` is supported. Each `h2` is numbered automatically (01, 02…) in mono
vermilion with a short A→B rule, and the `.toc` uses matching numbers.
Blockquotes have a vermilion rule with a blue segment. Lists use small vermilion
diamond markers. Tables scroll horizontally inside `.table-wrap`, with
scroll-shadow hints. A bare `<table>` directly in `.report-body` also scrolls.

### Themes (root `data-theme`)

| value | intent |
|---|---|
| `plate` (default; also used when no attribute is set and the OS is light) | paper and ink |
| `darkroom` (also used when no attribute is set and the OS is dark) | deep navy night sky, warm paper-coloured text |
| `redlight` | astronomer's red torch: only long wavelengths on near-black. Reviewer B becomes amber, still drawn as a ring. Images are tinted red. |

All colours come from CSS custom properties in section 1 of `styles.css`.

### Text size (root `data-text`)

`s` 90% · `m` 100% · `l` 112.5% · `xl` 125% of root size. Layout breakpoints
inside the app are **em-based container queries**, so larger text moves the layout
to fewer columns sooner. At XL the report drops to one column earlier rather than
cramming the sidebar. The XL setting also narrows the prose measure.

### Motion (root `data-motion`)

`reduce` turns off every animation and transition. `allow` keeps them even when
the OS asks for reduced motion. With no attribute, the OS setting applies. The
motion is small and never covers text:

- The brand mark's sight line marches and its star twinkles on hover.
- The loading state breathes.
- Dialogs rise or slide in.
- The hero and report-header plates **drift slowly on scroll**: a literal
  parallax, using CSS scroll-driven animation where supported. It is purely
  decorative and sits behind the text.

### Other states

- Keyboard focus is a 2px outline in `--focus`. Stretched-link rows outline the whole row.
- Forced-colours mode is handled.
- The print stylesheet hides chrome and prints link URLs for sources and bibliography.

## Integration assumptions for `app.js`

**HTML changes made:**

- `#view` was renamed to **`#app`**. It keeps `class="view"`. `#app` is a size
  container (`container: app / inline-size`). Note: this makes `#app` the containing
  block for any `position: fixed` element rendered *inside* it, so put toasts and
  overlays outside `#app`.
- Added a dark `theme-color` meta.

All functional ids are unchanged.

**Hooks the CSS reads if present.** All are optional. Without them the design still works.

- `body[data-route]` with values `index` / `report` / `sources` / `editions` / `method` /
  `settings` highlights the matching nav link. `a[aria-current]` or `.is-active` also works.
- `#readbar > span`: set its `width` inline (e.g. `"42%"`) or set `--progress`.
- `.progress > span` and `.score-item .bar > *`: the same width / `--progress`
  convention applies. Native `<progress>` and `<meter>` are styled.
- Reviewer identity: `data-reviewer="a|b"` (or `.score-a` / `.score-b`, `.review-a` /
  `.review-b`) on `.score` and `.review`. Without these, `.review` siblings
  alternate A/B by position. A `.review-head` element (or the h3/h4 inside `.review`)
  gets the reviewer dot.
- `.score` layout: `.score-label`, then `.score-value` (a `<small>` inside for "/ 5" etc.).
- `.score-item` layout: `.dimension-label` (or `dt`), then `.score-value` (or `dd`),
  then an optional `meter` / bar / `<p>`.
- Sources: in `.source-meta`, an element with `data-status="ok|active|verified|live|checked"`
  gets a filled blue dot. `stale|unverified|pending|warning` gets a vermilion ring.
  `broken|error|dead|removed` gets a filled vermilion dot.
- `.toc a[aria-current]` marks the current section.
- `.pagination` (with `a`/`button`, `[aria-current]` for the current page).
- `.edition > time` (or `.edition-date`) goes into the left date column.
- Settings: radio inputs with `value="plate|darkroom|redlight"` render as theme
  swatches. Radios whose `name` contains `text` and whose value is `s|m|l|xl`
  render at their own size. Wrap each choice in a `<label>`.
- Palette options: `li[role=option][aria-selected]`. Put the first child as the
  title (serif) and later children as a mono kind label. Use `li[role=presentation]`
  for group headings.
- Queue: `#queue-body > ol|ul > li` with a link, optional `small`/`.report-meta`,
  and a remove button.
