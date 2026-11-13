# Parallax · AI Observatory — BUILD SPECIFICATION
## Direction: **Quiet Observatory**

Status: authoritative. This replaces all four concept documents. Where a concept folder and
this document disagree, this document wins. Engineers do not need the mocks; everything
required to build is below. Mock paths are cited only as reference implementations to lift
code from.

---

## 0. Decision record

**Base direction: `glass` (Glass Observatory), re-grounded.**

I am overruling one judge. The jury ranked `constellations` first; the reader ranked `glass`
first; the engineer ranked `instrument` first. Three reasons to take Glass as the chassis:

1. **Glass is the only direction no judge placed below second.** Borda across the three
   ballots: glass 10, constellations 9, instrument 7, reading-room 4. The jury's own scores
   had glass and constellations tied at 60 points; the tie was broken on distinctiveness
   alone.
2. **The jury's prescription dissolves its own winner.** Its first and loudest graft is to
   replace the pentagon with Glass's five-bar profile at row and phone size, keeping the
   pentagon only at ≥108 px — i.e. remove the signature mark from the 53 places it actually
   appears. The reader independently demands the two-axis scatter be demoted out of the hero.
   Apply both and Constellations retains exactly two transferable things: the rule that colour
   means disagreement, and the plain-text agreement label. Both are portable; neither needs
   its chassis. Meanwhile four of the jury's ten grafts *into* Constellations are Glass
   components (At a glance, five-bar profile, Cited here, edition-lead). The jury voted
   against Glass's chrome while voting for Glass's component inventory.
3. **Verification favours Glass on the things that are expensive to fix later.** I checked the
   code rather than the prose:
   - `constellations/mock/assets/parallax.css:339-342` — `.fig-a .pt {fill: var(--a)}` and
     `.fig-b .pt {fill: var(--b)}` are the *same filled circle*. The ring exists only in chart
     mode; the dashed B only under `[data-theme="red"]` (css:344). Its stated
     colour-independence is false at row size in both primary themes.
   - `constellations/mock/index.html:78` — `View as table` and `Reset` are bare
     `<button class="linkish">` with no handler anywhere in `parallax.js`. The stated text
     equivalent for the sky does not exist.
   - Forced-colors blocks: glass 0, constellations 0, reading-room 1, instrument 1.
     `content-visibility`: **0 in all four**.
   - `glass/mock/styles.css:150-155` is the only `@supports not (backdrop-filter)` +
     `prefers-reduced-transparency` pair in the set, and `styles.css:465-467` is real shape
     coding (`background` for A, `inset box-shadow` for B), not asserted shape coding.

But Glass does not ship as drawn. Its hero is apple.com, its rows carry no agreement signal,
its dark-mode signature element is nearly invisible, its data marks are hard-coded px, and it
has no forced-colors story at all. What follows is Glass's structure carrying Constellations'
rule, Instrument's discipline and Reading Room's voice.

**What this is not:** not a wall of covers, not a three-pane mail app, not a page of grey
pentagons, and not a heavy-SF-Display hero.

---

## 1. Name, thesis, and the three laws

**Name:** Quiet Observatory.

**Thesis:** *One object, measured twice.* Reports sit on calm, opaque surfaces and are read in
a serif voice. The library is plotted as a real night sky. Every rating shows both readings
and the distance between them — and that distance is the only thing on the page allowed to
carry colour.

**Hero line:** "Every report, seen twice." (Constellations wrote it; it is the best line in the
exercise. Set in the serif, not in SF Display.)

### Law 1 — The ink law
Data marks are drawn in ink. Chroma inside a data mark means exactly one thing: **the two
reviewer runs disagreed on that value.** A reader learns this once and can read it everywhere.
Chroma is spent in exactly two places site-wide:
  - `--accent` — one hue, interactive affordances only (links, focus ring, selected chip,
    primary button). Never inside a data mark.
  - `--gap` — one hue, the parallax tint. Only ever the distance between reviewer A and
    reviewer B.
Category colour does not exist. Categories are a glyph plus their name. (This is the direct
rejection of Reading Room's five-pigment system, which produces ~760 blue rectangles at 2,000
reports.)

### Law 2 — The shape law
A and B must remain distinguishable **by shape and position alone**, in every theme, at every
size, with chroma switched off entirely. A is a **▼ caret above the line**; B is a **▲ caret
below the line**. When they agree the two carets fuse into a closed hourglass. This is a hard
contract tested under `forced-colors: active`, `@supports not (color: color-mix(...))`,
greyscale print and the night-vision theme. Colour may reinforce; it may never carry.

### Law 3 — The honesty law
Three sentences are generated from data, never hand-written, and may not be cut for space:
  - On every library row and tile: `Runs agree on all 5` / `Runs differ on {n} of 5`.
  - Under every overall score: `Mean of five dimensions: (8.0 + 6.5 + 7.0 + 5.0 + 6.0) ÷ 5 = 6.5`.
  - In every ratings card and on Method, verbatim:
    **"Two runs of the same reviewer model: a consistency check, not independent validation."**
No surface anywhere may describe A and B as two experts, two opinions, independent reviews, or
validation. The words are "run A" and "run B".

---

## 2. Tokens

### 2.1 Colour

Three themes. Default follows `prefers-color-scheme`; `data-theme="light|dark|night"`
overrides. Authored with `light-dark()` for the first two, with a duplicated block under
`@media (prefers-color-scheme: dark)` inside
`@supports not (color: light-dark(#000,#fff))`. Night vision is an explicit override block.
Legacy preference migration: `plate→light`, `darkroom→dark`, `redlight→night`.

| Token | Light (Daylight) | Dark (Night sky) | Night vision |
|---|---|---|---|
| `--bg` canvas | `#F4F5F7` | `#14181F` | `#000000` |
| `--surface` cards, rows | `#FFFFFF` | `#1C212B` | `#110202` |
| `--surface-2` fills, chips | `#EBEDF1` | `#272D39` | `#1B0403` |
| `--surface-3` pressed, tracks | `#E1E4EA` | `#333A48` | `#260605` |
| `--ink` primary text | `#111318` | `#F2F4F8` | `#FF4A3B` |
| `--ink-prose` long-form | `#16181D` | `#E2E6ED` | `#FF4A3B` |
| `--ink-2` secondary | `#474D57` | `#B6BDC9` | `#F2271A` |
| `--ink-3` tertiary / meta | `#5F6672` | `#949CAA` | `#F2271A` |
| `--hairline` | `rgb(17 19 24 / .11)` | `rgb(255 255 255 / .12)` | `rgb(255 60 40 / .22)` |
| `--hairline-2` stronger | `rgb(17 19 24 / .18)` | `rgb(255 255 255 / .20)` | `rgb(255 60 40 / .36)` |
| `--accent` | `#0A5FCC` | `#7FBAFF` | `#FF4A3B` |
| `--on-accent` | `#FFFFFF` | `#06142B` | `#000000` |
| `--mark` data-mark ink | `#2B3240` | `#DDE3ED` | `#FF4A3B` |
| `--gap` parallax tint | `#B0520B` | `#FFB65C` | `#FF4A3B` + hatch |
| `--gap-fill` spread band | `color-mix(in srgb, var(--gap) 16%, var(--surface))` | same, 18% | `transparent` + hatch |
| `--focus` | `#0A5FCC` | `#9CCBFF` | `#FF4A3B` |
| `--sky-top` / `--sky-bottom` | `#060B1C` / `#10204A` | same | `#000000` / `#0D0100` |
| `--sky-ink` / `--sky-ink-2` | `#F4F6FB` / `#B7C0D4` | same | `#FF4A3B` / `#F2271A` |
| `--glass-tint` | `rgb(250 251 253 / .76)` | `rgb(28 33 43 / .78)` | `rgb(14 1 1 / .80)` |

**Measured contrast** (WCAG 2.x relative luminance, computed in
`decision/work/contrast.py`; reproduce with `python3 -I`):

| Pair | Light | Dark | Night |
|---|---|---|---|
| ink on bg / surface | 17.03 / 18.58 | 16.16 / 14.65 | 6.29 / 6.09 |
| ink-prose on surface | 17.76 | 12.89 | 6.09 |
| ink-2 on bg / surface | 7.80 / 8.51 | 9.42 / 8.54 | 5.08 / 4.92 |
| ink-3 on bg / surface-2 | 5.30 / 4.94 | 6.44 / 4.99 | 5.08 / 4.77 |
| ink-3 on surface-3 (worst text) | 4.54 | 4.13 ✗ | 4.57 |
| accent on bg / surface | 5.47 / 5.96 | 8.79 / 7.97 | 6.29 / 6.09 |
| on-accent on accent | 5.96 | 9.08 | 6.29 |
| `--mark` on surface (graphic ≥3:1) | 12.86 | 12.51 | 6.09 |
| `--gap` on surface / surface-2 (graphic ≥3:1) | 5.18 / 4.42 | 9.29 / 7.96 | 6.09 / 5.91 |
| ink on `--gap-fill` band | 14.82 | 9.79 | 5.12 |
| sky-ink / sky-ink-2 on sky-bottom | 14.63 / 8.67 | same | 6.29 / 5.08 |
| `--gap` on sky-bottom | 9.11 | same | n/a (hatch) |
| **Glass floor:** ink on chrome over worst-case content | 10.09 | 6.69 | 4.75 |

**One failure to fix in build:** `--ink-3` on `--surface-3` in dark measures **4.13**, under
4.5. Rule: `--ink-3` is never used on `--surface-3` in any theme. Pressed/track fills carry
`--ink-2` or better. Add this to the lint pass in §8.4.

**The dark-mode elevation inversion (the one real craft fix to Glass).** The jury's charge that
Glass's sky panel "almost disappears" in dark is measurable and correct. Glass's dark canvas is
`#05070D` (L\* 1.93) and its sky-panel top is `#060B1C` (L\* 3.27): **ΔL\* = 1.34**, below the
just-noticeable step for a large field, with a 1.03:1 ratio. The fix is not a lighter panel; it
is a lighter *page*. Dark canvas becomes `#14181F` (L\* 8.14), cards lift to `#1C212B`
(L\* 12.67), and the sky panel stays near-black — so it reads as a hole punched in the page
showing the actual night. Measured: canvas→sky-top **ΔL\* 4.87**, canvas→sky-bottom
**ΔL\* 5.32**, canvas→card **ΔL\* 4.53**.

> **Surface law (enforceable):** any two adjacent large-field surfaces must differ by
> **≥ 3.0 L\*** or be separated by a hairline meeting **3:1**. Check with
> `decision/work/lstar.py`.

Night vision deliberately lives in a 4.5–6.3:1 band; hierarchy there comes from weight, size
and fills, never from luminance. No white, no blue, no image is permitted in that theme, the
sky chart included.

### 2.2 Typography

System fonts only. Nothing is downloaded; Apple faces are referenced by name and never shipped.
One self-hosted OFL file is permitted only if a future need arises, and then subset and
`font-display: swap`.

| Role | Stack |
|---|---|
| UI / instrument | `system-ui, -apple-system, "SF Pro Text", "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Publication / reading | `ui-serif, "New York", "Iowan Old Style", Charter, "Sitka Text", Cambria, Georgia, serif` |
| Numerals | `ui-rounded, "SF Pro Rounded", system-ui` with `font-variant-numeric: tabular-nums` |
| Mono | `ui-monospace, "SF Mono", Menlo, Consolas` — hashes and IDs only |

**Voice rule (grafted from Glass, extended by Reading Room):**
*The publication speaks in serif; the instrument speaks in SF.*
Serif: the library display line, the report H1, all prose, the editorial judgment, the
coverage note. SF: everything that labels, navigates, filters or measures — including reviewer
rationale, which is the instrument talking about the report. The reader can tell editorial
prose from rating rationale with no label.

Section headings inside a report are **SF Semibold**, not serif: they are structure and they
must match the TOC. This is deliberate and gives a three-level rhythm (serif H1 → SF H2 →
serif prose).

| Style | Size / line-height | Weight | Tracking |
|---|---|---|---|
| **Display (library hero), serif** | `clamp(2.625rem, 5.2vw, 4rem)` / 1.06 | 400 | −0.012em, `text-wrap: balance` |
| **Report H1, serif** | `clamp(2rem, 4vw, 3.25rem)` / 1.10 | 400 | −0.010em, max 21ch |
| Title 1 (library section) | `clamp(1.75rem, 2.6vw, 2.25rem)` / 1.12 | 700 | −0.028em |
| Title 2 (report H2, SF) | `clamp(1.375rem, 1.9vw, 1.625rem)` / 1.22 | 600 | −0.022em |
| Lead-tile title | `1.5rem` / 1.24 | 600 | −0.018em |
| Row title | `1.3125rem` / 1.28 | 600 | −0.020em, balanced, 2-line clamp |
| Tile title | `1.125rem` / 1.30 | 600 | −0.016em |
| Body (UI) | `1.0625rem` / 1.47 | 400 | −0.020em |
| Lede / dek | `clamp(1.125rem, 1.4vw, 1.3125rem)` / 1.45 | 400 | −0.018em, max 48ch |
| **Prose (serif)** | `1.25rem` / 1.62 (phone `1.1875rem`/1.58) | 400 | −0.003em, measure 66–70ch (690 px) |
| **Judgment (serif)** | `1.4375rem` / 1.43 | 400 | −0.008em |
| Callout / summary | `0.9375rem` / 1.45 | 400 | −0.012em |
| Label | `0.8125rem` / 1.3 | 500 | −0.004em |
| Footnote / status | `0.75rem` / 1.33 | 400–600 | 0 |
| Score numerals | 4.5 / 4 / 2.75 / 1.75 / 1.3125 / 1.125 rem | 600 rounded | −0.03em |

No uppercase anywhere. No letter-spaced eyebrows. Prose gets
`hanging-punctuation: first last` and `text-wrap: pretty` progressively; old-style figures in
prose via `font-variant-numeric: oldstyle-nums proportional-nums`, lining tabular everywhere
else.

Text size preference scales the root: `s 93.75%` · `m 100%` · `l 112.5%` · `xl 125%`.
**Everything, data marks included, is sized in rem or em.** No data mark may be specified in
px. (This is the engineer's rejection of `instrument/mock/app.css:407-409`, and it applies
equally to Glass's own `.mark { width: 12px }` and `.mini-dims .mark { width: 9px }` at
`glass/mock/styles.css:464-471`.)

### 2.3 Space, grid, radii

- **Spacing scale (4-pt), as rem:** `--s-1:.25 --s-2:.5 --s-3:.75 --s-4:1 --s-5:1.25
  --s-6:1.5 --s-7:2 --s-8:2.5 --s-9:3 --s-10:4 --s-11:5 --s-12:6 --s-13:8`.
- Page gutter `clamp(1rem, 4.2vw, 3rem)`. Container `75rem` (1200 px). Report container
  `79.5rem`.
- **Report grid:** `14.25rem` TOC · `3.5rem` gap · `43.125rem` reading column · `3.5rem` gap ·
  `13.75rem` margin column. Kicker, H1, dek, actions, glance card, headings and prose all hang
  from one vertical axis: the reading column's left edge.
- **Library grid:** `14.5rem` edition rail · `2.5rem` gap · content. Lead layout `1.42fr 1fr`.
- **Radii, concentric (inner = outer − padding):** `--r-1:.375rem` (kbd) `--r-2:.625rem`
  (brand squircle) `--r-3:.75rem/.5625rem` (segmented outer/inner at 3 px padding)
  `--r-4:.875rem` `--r-5:1.375rem` (phone cards) `--r-6:1.75rem` (tiles, glance)
  `--r-7:1.75rem` (sky panel, ratings card) `--r-pill:999px`.
- **Optical alignment:** floating chrome capsules sit 8 px outside the container so their
  *content* aligns with the grid below. Numbers are tabular. Star positions are pixel-snapped.

### 2.4 Elevation and material

| Level | What | Treatment |
|---|---|---|
| 0 Canvas | page | `--bg`. One soft zenith glow in light only. Nothing else decorates. |
| 1 Content | rows, tiles, glance, ratings, tables | **Opaque** `--surface`, 1 px `--hairline` ring, no blur. Hover: translate −2 px + `0 8px 40px -12px rgb(0 0 0 / .18)`. |
| 2 Floating chrome | nav capsules, stuck toolbar, phone tab bar, read bar, sky lens | Glass: `--glass-tint`, `backdrop-filter: blur(26px) saturate(1.7)`, 0.5 px inner rim, two-layer shadow. |
| 3 Overlay | palette, queue sheet, menus, glance popover | Dense glass (88 %) over scrim `rgb(17 19 24 / .28)` light / `rgb(0 0 0 / .55)` dark. |

**Glass rules (hard):**
1. Translucent material is permitted **only where content actually scrolls beneath it**.
   Decorative blur is banned. (Instrument's rule, adopted; this is why the edition rail is
   opaque — `glass/mock/styles.css:666` gave each sticky `.rail` its own
   `backdrop-filter: blur(16px)` on phone, so blur layers scaled with edition count.)
2. **At most two blurred surfaces may be on screen simultaneously.** Enforce in review.
3. `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` →
   opaque `--glass-tint-strong`. `@media (prefers-reduced-transparency: reduce)` → opaque
   `--surface`. Both ship day one. (Lift from `glass/mock/styles.css:150-155`.)
4. Text on glass is always `--ink`. Tinted glyphs on glass need ≥3:1 and are measured.

### 2.5 Motion

CSS `linear()` springs sampled from a damped oscillator; no JS physics. `cubic-bezier(.2,.8,.2,1)`
fallback under `@supports not (transition-timing-function: linear(0,1))`.

| Token | Curve | Use |
|---|---|---|
| `--spring-smooth` | ζ = 1.0, no overshoot | progress, reading capsule, scroll-linked |
| `--spring-snappy` | ζ = 0.8, 1.5 % overshoot | segmented thumb, gauge marks, tiles, view transitions |
| `--spring-bouncy` | ζ = 0.6, 9 % overshoot | queue press, star hover — nothing else |
| `--ease-out` | `cubic-bezier(.22,.61,.36,1)` | fades |

Durations: `--t-micro 120ms` (press, hover) · `--t-small 240ms` (chips, tooltips, toggles) ·
`--t-medium 420ms` (segmented thumb, gauge marks, sheets) · `--t-large 560ms` (view
transitions).

**What moves:** chrome morphing into the reading capsule; gauge carets sliding when vantage
changes; the selected star scaling; the clicked title morphing into the report H1; sheets
rising from their invoker.
**What never moves:** backgrounds, scroll-linked parallax, list entrances, ambient loops,
anything adjacent to prose, anything on a timer.

`prefers-reduced-motion: reduce` or `data-motion="reduce"`: all transitions → 1 ms; view
transitions → 160 ms crossfade; the convergence animation on the gauge is skipped and the
carets render in final position.

---

## 3. The parallax mark — one grammar, three sizes

This is the product's core graphic and the single largest merge of the four directions. **One
grammar, learned once, in three sizes.** A = ▼ / solid / above. B = ▲ / outline / below.
Ink = agreement. Tint = the gap.

### 3.1 Row profile — 26 px, used ~2,000 times (replaces Constellations' pentagon)

Five bars, one per dimension, left to right: usefulness, impact, novelty, maturity, openness.

```css
.profile { display:inline-grid; grid-auto-flow:column; grid-auto-columns:.375rem;
           gap:.1875rem; align-items:end; height:1.625rem; }
.profile i { position:relative; display:block; border-radius:2px; min-height:2px;
             height:calc(var(--hi) * 10%);          /* higher of the two runs */
             background:linear-gradient(var(--gap),var(--gap)) top/100% 100% no-repeat,
                        linear-gradient(var(--mark),var(--mark)) bottom/100% calc(var(--lo)/var(--hi)*100%) no-repeat; }
```

- Full bar height = **the higher of the two runs**; the ink portion = **the lower**; the
  tinted cap = **the disagreement**. When A = B the cap has zero height and the bar is pure
  ink.
- **True zero origin** — `v/10`, no truncation. 2.6 px of height per rating point at default
  text size; across the real 4.0–7.8 range that is ~10 px of silhouette difference, which is
  why fifty rows stop looking identical. (Measured against the jury's finding that the
  pentagon yields only a 3.4 px fringe for the maximum real disagreement at R = 34.)
- 6 DOM nodes per profile: one `<span role="img">` + five `<i>`. **No SVG in list rows, ever.**
- `aria-label`: `"Usefulness 8.0, impact 6.5, novelty 7.0, maturity 5.0, openness 6.0. Runs
  differ on impact."`
- Sizes: `sm` (phone row, `grid-auto-columns:.3125rem; height:1.25rem`), default (desktop row),
  `lg` (lead tile, `.5625rem` / `2.125rem`, with the dimension key rendered beneath).
- **It is never unlabelled.** The persistent key lives in the status bar (§4.4): *"Bars:
  usefulness · impact · novelty · maturity · openness. Tinted cap = the runs differ."*

### 3.2 Report gauge — per dimension (grafted whole from Instrument, re-sized to rem)

Per dimension: a 1–10 track with 10 ticks, A as a ▼ caret above the rail, B as a ▲ caret
below, the mean as a 2 px vertical bar, and an explicit tinted **spread band** spanning A..B
whenever they differ. When they agree the two carets meet at the same x and read as a closed
hourglass. A legend row sits directly beneath the five rows:
`▼ Run A · ▲ Run B · | Mean · ▭ Spread`.

```css
.g-scale { position:relative; height:1.5rem; }
.g-a,.g-b { position:absolute; left:var(--p); width:.5625rem; height:.4375rem;
            margin-left:-.28125rem; background:var(--mark); }
.g-a { top:calc(50% - .625rem); clip-path:polygon(0 0,100% 0,50% 100%); }
.g-b { top:calc(50% + .1875rem); clip-path:polygon(50% 0,100% 100%,0 100%); }
.g-m { position:absolute; left:var(--pm); top:50%; translate:0 -50%;
       width:.125rem; height:.5625rem; background:var(--mark); }
.g-span { position:absolute; top:50%; translate:0 -50%; height:.6875rem;
          left:var(--plo); width:var(--pspan); border-radius:3px;
          background:var(--gap-fill); box-shadow:inset 0 0 0 1px var(--gap); }
```
with `--p: calc((var(--v) - 1) / 9 * 100%)` set inline from data.

**Why the gauge starts at 1 and the bar starts at 0, deliberately:** the gauge is a *position*
encoding, so it must show the rubric's real endpoints (1 and 10) and may not truncate the
scale; the bar is a *length* encoding, so it must start at zero or it exaggerates differences.
Both are correct for their channel. Put this sentence on Method.

Markup is `role="table"` with one row per dimension and a cell label
`"Usefulness: run A 8, run B 8, mean 8.0, runs agree"`. Zero drawing cost, no SVG, no
measurement.

### 3.3 Sky star — hero chart (kept from Glass)

Each report is one star: x = date first found, y = overall rating on a labelled 4–8 grid
captioned as part of a 1–10 scale, radius = read time (5 / 9–10 / 13 min → 2.5 / 3.5 / 4.8
units), and a ring = already read by you. A star whose two runs differ on ≥1 dimension gets a
`--gap` halo at 55 % — the ink law, applied in the sky. Only the single brightest star is
labelled, atlas-style.

### 3.4 Three codings of the gap

| Context | Coding |
|---|---|
| Light, dark | `--gap` tint fill + 1 px `--gap` inset border on the band; tinted cap on the bar |
| **Night vision, `forced-colors: active`, `prefers-contrast: more`, print** | Band becomes `background: transparent` with a 1 px solid `CanvasText`/`--ink` border and a 45° `repeating-linear-gradient` hatch at 3 px pitch; the bar cap becomes a hatched segment with a 1 px rule at the ink/gap boundary |
| Everywhere, always | The words: `Runs differ on 2 of 5` |

Texture, not hue, is the fallback — so the rule degrades identically in all four hostile
environments.

---

## 4. Component inventory

Every component lists states. Unlisted states do not exist. All interactive targets ≥ 24 px
(WCAG 2.2 SC 2.5.8); primary targets 44 px.

### 4.1 Masthead
- **Desktop:** three floating glass capsules, 14 px from top — brand (mark · "Parallax" ·
  "AI Observatory"), centred tabs (Library · Sources · Editions · Method) with the selected tab
  as an opaque lens, tools (Search ⌘K · Queue + count badge · Settings).
- **Phone:** a top bar with brand + settings that scrolls away, plus a fixed glass **tab bar**
  (Library · Queue · Editions · Sources). **No separate floating search orb** — search lives
  in the sticky toolbar, which is always reachable. (Drops the most-cited piece of Glass's
  iOS-cosplay.)
- States: rest · hover (lens brightens) · focus-visible (2.5 px ring, 3 px offset) · selected
  (`aria-current="page"`) · stuck (shadow appears after 8 px of scroll) · reading mode (centre
  capsule morphs — §6.3) · reduced transparency (opaque).

### 4.2 Library row
Grid: `[status 1rem] [content 1fr] [score 7.5rem]`. Content = kicker line (category glyph +
name · change type · published date) / title (2-line clamp) / summary (2-line clamp) / meta
(read time + up to 3 tags). Score column = overall numeral, five-bar profile,
**`Runs differ on 2 of 5`**, and an icon queue button.
- Fixed height per density so windowing is possible later: **comfortable 7.75rem**,
  **compact 4.625rem**, **phone 6.5rem**. Set `contain-intrinsic-size` from these.
- Node budget: **≤ 24 elements**. Stretched-link pattern (`<a>` covering the row,
  `:has(:focus-visible)` outlines the whole row) so there is one tab stop per row plus the
  queue button.
- States: rest · hover (surface lifts, title underlines) · focus-visible · **read** (a check
  glyph in the status column + title at `--ink-2`; never colour-only) · **in progress** (an arc
  glyph + `34 %` in the meta line) · **queued** (filled bookmark) · **filtered-out** (removed
  from DOM, not hidden) · **search hit** (`<mark>` on the matched substring in the title).

### 4.3 Score display
Three sizes per §3, plus the **overall numeral**: rounded tabular, with `out of 10` as a
separate smaller span, and immediately beneath, Reading Room's arithmetic line wherever there
is room for it (glance card, ratings card, lead tile). Never a badge, never boxed, never a
colour chip.

### 4.4 Filter bar and status bar
- Row 1 (sticky, glass): search field (`/` focuses) · Rating · Reading · Sort menus.
- Row 2: category chips with live counts (`All 53 · Models 20 · Tools 12 · Open source 8 ·
  Creative workflows 7 · Research 6`), then **smart-list chips** computed from data:
  `Unread 50` · `Quick reads, 5 min 7` · `Rated 6.5 or higher 14`. Chips are
  `aria-pressed` toggles; counts update live; a chip whose count is 0 is disabled, not hidden.
- **Status bar** (grafted from Instrument; desktop: pinned to the bottom of the library
  viewport; phone: a line under the chips): live result count · the profile key (§3.1) · the
  four most useful keys `J K move · ↵ open · S save · ⌘K`.
- States: rest · hover · focus-visible · pressed/selected · disabled (count 0) · stuck ·
  overflowing (chips scroll horizontally with an edge mask on phone).

### 4.5 Report header
Kicker (category · change type · entity) / serif H1 / dek / meta line (`9 min read · 1,953
words · 10 sources · Published 27 Oct 2026 · Added 28 Oct 2026`) / actions:
**Add to Queue** (filled) · **Mark as Read** (tinted) · **Release article ↗** (text + external
glyph).
States for the two toggles: off · on (label changes to "In queue" / "Read", icon fills,
`aria-pressed="true"`) · focus-visible · pressed (scale .96).

### 4.6 At a glance card (grafted whole from Glass — the best triage surface built)
One elevated card, above the first section, no scrolling required to use it:
- the editorial judgment in **serif 23 px**;
- on the right: the overall numeral, five mini gauges (same grammar, §3.2 at `sm`), the
  arithmetic line, the generated agreement line, and `Two runs of one model →` linking to
  Method;
- across the bottom, two columns: **Try it for** (real use cases) and **Know the limits** (real
  limitations). Bullets are ink discs and ink rings respectively — not colour.
- States: rest · a `Glance` affordance in the reading capsule re-opens this card as a popover
  anywhere in the report (§6.3), so it is reachable the whole way down.

### 4.7 Section prose + "Cited here" (grafted from Glass)
Serif prose in a 690 px measure. Links `--accent` with a 45 %-opacity underline that goes solid
on hover. A right margin column lists the sources **that section actually links to**, each with
its access or publication date pulled from the source record. Tables render as quiet cards,
SF text, right-aligned rounded numerals, horizontally scrollable with
`role="region" tabindex="0"` and an accessible name.
States: rest · current section (TOC lens tracks it) · margin column folded to the end of the
section below 74em · empty (section cites nothing → no column, no placeholder).

### 4.8 Ratings spread
Order, top to bottom:
1. Eyebrow `Ratings` + the **vantage segmented control** `Both · Run A · Run B`
   (grafted from Glass; `aria-pressed`, `aria-live="polite"` on the overall score).
2. Serif H2 `Two readings, five dimensions.`
3. Summary row: 72 px overall · **the arithmetic line** · the generated agreement sentence ·
   **the mandated honesty sentence, verbatim**.
4. Five gauge rows (§3.2) + the legend row, the widest split ordered first.
5. **Progressive rationale (grafted from Constellations):** where A = B, the rationale
   collapses behind a `Why this rating` disclosure and the row reads `Both runs 8`. Where they
   differ, it is expanded by default and reads `A 7 · B 6 · 1 pt apart`. This cuts the card to
   roughly a third of Glass's height and puts the eye on the contested dimension.
6. **The facing-pages spread (grafted from Reading Room):** at the end of the card, A and B as
   two pages with a gutter hairline, each carrying the dimension score, the rationale in serif,
   the review qualifications, the verdict and confidence, the model and effort, and the
   truncated report SHA-256 + rubric version.
- States: Both (default) · Run A · Run B (the other run's carets drop to 16 % opacity and 70 %
  scale; values switch from means to that run's scores; the overall switches 6.5 → 6.6 / 6.4;
  the rationale column narrows to one voice) · reduced motion (no slide) · print (always
  expanded, spread stacks).

### 4.9 Source row and inspector
Virtualized table: name + domain · kind · status (glyph **and** word) · last checked (relative,
absolute on hover/focus) · topics. Toolbar: search, kind filter with counts, status filter,
`Monitored only` toggle. Summary strip: 3,009 records · 200 recurring entrypoints · a stacked
status bar with a text key.
Selecting a row opens an inspector — 360 px right panel on desktop, bottom sheet on phone —
with notes, "discovered from", feed URL, last success, last coverage. Deep link
`#sources/<id>`.
States: rest · hover · selected (key vs non-key: accent fill when the pane has focus, neutral
fill when it does not) · blocked/unverified (glyph + word) · loading page · empty result.

### 4.10 Edition card
Header chart: library size after each edition as a step line (6 → 11 → 17 → 24 → 31 → 38 → 43
→ 46 → 49 → 53) with bars for sources checked and failed. Each edition is a row: date and span,
checked, failed, candidates, library size, and the coverage note in serif. **Coverage
limitations** is a collapsed searchable disclosure; the latest edition opens expanded. Every
edition deep-links to a filtered library view.
States: collapsed · expanded · latest (pill) · in-progress scan (next scan date shown).

### 4.11 Settings
iOS grouped inset list:
- **Appearance** — four preview tiles (Automatic · Daylight · Night sky · Night vision), each a
  miniature of the sky panel.
- **Text size** — four detents with a live serif preview paragraph.
- **Motion** — System · Reduce · Full.
- **Transparency** — System · Reduce.
- **Single-key shortcuts** — On · Off (required by WCAG 2.1.4; `j k q m /` are single-character
  shortcuts and must be switchable off).
- **Reading data** — Export (JSON) · Import (validated, with a summary sheet: "12 read marks,
  3 queued, 5 in progress") · Clear (destructive, confirm sheet).
- A storage note: "stays in this browser".

### 4.12 Command palette
⌘K / Ctrl+K, or the search affordance. Dense-glass panel, 640 px, 18 vh from top, over a scrim;
56 px field in 22 px type.
**Default group before any typing: `Continue reading and queue`** — in-progress reports with
their percentage, then queued items. (Graft from the reader; gives resume a keyboard-speed
front door.) Then **Top hit** (score + profile + category), **Reports**, **Pages**, **Actions**
(switch theme, text size, open queue, export reading data, show only unread).
Footer: `↑↓ move · ↵ open · ⌘↵ add to queue · Esc`.
Phone: full-height sheet with the field **at the bottom**, above the keyboard.
ARIA combobox/listbox with `aria-activedescendant`; result counts announced; focus returns to
the invoker on close.
States: empty (default group) · typing (debounced 120 ms) · results · no results (`No match
for "xyz"` + the three nearest titles) · loading a shard (inline spinner on the group header).

### 4.13 Queue sheet and Continue reading card
- **Continue reading card** (grafted from Reading Room) — in the library hero, left column,
  directly under the figures: title, a progress bar, `34 % · 9 min left`, and a score chip.
  Hidden entirely when nothing is in progress (no empty placeholder in the hero).
- **Queue sheet** — right sheet 420 px on desktop, bottom sheet with medium/large detents on
  phone. Items: title, progress bar, minutes left (`readMinutes × (1 − progress)`). Reorder by
  drag handle **and** by "Move up / Move down" buttons (SC 2.5.7 — the keyboard path is not
  optional). Header totals `3 reports · 27 min`. Footer: Export / Import. Deep link `#queue`.
- States: empty (one outlined star, "Your queue is empty. Add a report with the bookmark.") ·
  items · reordering · item removed (undo toast, 6 s, keyboard-reachable).

### 4.14 Empty, error, skeleton
| State | Treatment |
|---|---|
| No filter matches | `No reports match these filters.` + **Clear filters** button + the three highest-rated reports in the nearest category |
| Empty search | `No match for "xyz".` + nearest three titles by substring distance |
| Empty queue | §4.13 |
| Index shard failed | `Couldn't load part of the library.` + **Retry** + a note that the reports already loaded are still usable |
| Report shard 404 | `This report isn't available. It may have been renamed.` + **Back to library** |
| Offline | A quiet line in the status bar: `Offline — showing what's already loaded.` No modal. |
| Skeleton | Row-shaped blocks at the exact fixed row height (so there is zero layout shift), 8 maximum, revealed only after 200 ms, `aria-busy="true"` on the list, animation suppressed under reduced motion |

---

## 5. Screens and breakpoints

**Breakpoints are in `em`, so the text-size preference and browser zoom recompose the layout
the way Dynamic Type does** (graft from Instrument; a one-line change that makes the text-size
feature structural rather than cosmetic).

| Token | Value | Layout |
|---|---|---|
| `--bp-wide` | `74em` (1184 px) | full report grid; two-column hero; lead layout 1.42fr/1fr; 14.5rem edition rail |
| `--bp-desk` | `60em` (960 px) | margin column folds to end of section; glance stacks; 11.25rem rail; brand subtitle hides |
| `--bp-tab` | `56em` (896 px) | lead layout becomes one column; TOC moves into the contents menu |
| below `56em` | — | phone chrome |
| `--bp-tiny` | `24em` (384 px) | tighter numerals, 9 px tab labels, icon-only `Filter`, chips scroll |

### 5.1 Library — desktop (≥ 74em)
1. Floating chrome.
2. **Hero band, two columns `1fr 1.1fr`, 56 px gap.** Left: eyebrow, serif display
   `Every report, seen twice.`, two-line lede, the four figures (53 reports · 3,009 source
   records · 200 monitored entrypoints · 10 editions), **Continue reading card**. Right: the
   sky panel, 420 px tall, radius 28.
   *This is the call that resolves the hero disagreement (§9.1): the sky stays the hero but
   sits beside the headline instead of below it, which brings the first report from ~1,400 px
   to ~760 px.*
3. `Reports` Title 1 + sticky glass toolbar (§4.4) + chips + smart lists.
4. **Latest edition lead layout** (graft from Glass): the highest-rated report of the newest
   edition as a lead tile with judgment and score; the remainder as compact tiles beside it.
5. **Date-grouped rows with sticky group headers** (graft from Instrument): a sticky strip per
   edition with date, `Edition 9 · 3 reports first found · 181 sources checked`, and a count.
   `content-visibility: auto` per group.
6. `Show 60 more` (incremental). Footer in four columns: about · ratings disclosure · your-data
   note · edition status.

### 5.2 Library — tablet (56–74em)
Hero stacks: display + lede + figures + Continue reading, then the sky full-width at 320 px.
Lead tile goes full width with three compact tiles in a row beneath. Rail narrows to 11.25rem.
Status bar moves from pinned to inline under the chips.

### 5.3 Library — phone (< 56em)
Order, top to bottom: top bar → serif display at 34–42 px → lede → figures in a 2×2 grid →
**Continue reading card** → sticky toolbar (search + `Filter & sort` sheet) → chips (scrolling,
edge mask) → status line → **latest edition lead + rows** → `Plot the library` disclosure
containing the sky at 300 px, collapsed by default, state remembered → remaining edition groups
→ footer. Fixed glass tab bar at thumb height.
*The sky is below the first reports on phone. The returning visitor sees what changed before
they see a chart.*

### 5.4 Report — desktop
Chrome: `‹ Library` capsule left; brand orb centre that morphs into the reading capsule; `Aa ·
Search · Queue` right. Grid per §2.3: sticky TOC with progress ring and numbered sections, the
serif H1 and reading column, the `Cited here` margin column. Order: header → At a glance →
sections → ratings spread → `Sources and research notes` (researchNote + full source list).

### 5.5 Report — tablet / phone
Tablet: TOC collapses into an `Aa`/contents menu; margin notes fold to the end of each section.
Phone: a bottom **read bar** replaces the tab bar — back · a progress ring with `Section 1 of 8`
(or `Ratings`) · Glance · bookmark. The vantage control goes full width; gauge rows put the
track under the dimension name; rationales stack; the facing-pages spread becomes two stacked
pages with the gutter rule becoming a horizontal rule.

---

## 6. Signature moments, and exactly how each is built

### 6.1 "The library, plotted"
An SVG scatter, 1200 × 420 (desktop) / full-bleed × 300 (phone), rendered from `index.json`
into a single template string and injected once. Faint dashed meridians mark the 10 editions;
date ticks are edition dates; a soft beam marks the latest edition.

**Beeswarm, rebuilt O(n).** Glass's implementation is O(n²) (53 × 40 × 53 today; ~1e9 ops at
5,000). Replace with bucketing: key each star by `(dayIndex, round(rating*10))` into a `Map`;
within a bucket, offset member *i* by `((i+1)>>1) * (i%2 ? -1 : 1) * (2r+1)` px on x. Past 6
members a bucket renders as one cluster disc labelled with its count. Deterministic, so
positions never jitter between renders; one pass; no measurement.

Interaction: hovering or focusing raises a glass lens (entity, category, score, read time, and
the agreement line). **The chart is one tab stop**; arrow keys move through time (←/→) and
rating (↑/↓); Enter opens. Filtering dims non-matching stars to 18 % rather than removing them,
so the filter's effect is visible.

Honesty: the caption states the encoding and that ratings are editorial judgments, not
benchmarks. Axis labels always render. **`View as table` is a real control** that swaps the
chart for a sortable `<table>` of the same data — implemented, tested, and never shipped as a
label. (Constellations shipped it dead; that is worse than not offering it.)

### 6.2 "Close one eye" — the vantage switch
A segmented control `Both · Run A · Run B`. The thumb slides on `--spring-snappy`; the
non-selected run's carets transition to `opacity:.16; scale:.7`; values swap from means to that
run's scores; the overall score node is `aria-live="polite"` so the change is announced; the
rationale column narrows to one voice. Reference implementation: `glass/mock/app.js:245,266-286`
— port the wiring, re-render the marks per §3.2.

### 6.3 "The capsule that reads with you"
After ~280 px of scroll the centre chrome capsule morphs (blur + scale + opacity on
`--spring-snappy`) into a reading capsule holding a progress ring, the **current section
title**, a percentage, and a **`Glance`** button that re-opens the At a glance card as a
popover over the reading column (`popover` attribute with a JS fallback; focus trapped; Esc
closes; focus returns). One `IntersectionObserver` over the section headings drives both the
capsule and the TOC lens. Progress writes to `localStorage`, which feeds the queue, Continue
reading, the palette's default group, and the read rings in the sky. Phone: the same
information in the bottom read bar.

### 6.4 "From star to page"
`document.startViewTransition()` around the hash render, feature-detected. Only the clicked
title receives `view-transition-name: report-title`, assigned immediately before and cleared
immediately after, so the morph is unambiguous and the name is never duplicated. The rest of
the page rises 14 px and fades on `--spring-smooth`. Back reverses the morph and restores list
scroll position (store `scrollY` per hash in `sessionStorage`). Without support, render
instantly. Reduced motion → 160 ms crossfade.

### 6.5 The gap, made visible
The one moment that is purely the product's own: on first view of a ratings card, the carets
travel in from opposite ends of each track and settle on their values, 40 ms apart per row,
with the spread band growing in behind them (`--t-large`, `--spring-snappy`). You watch two
readings converge, and where they do not converge a tinted band is left behind. Runs once per
report per session; skipped entirely under reduced motion, where the marks render in place.
Reference: `instrument/mock/app.css:425-433`.

---

## 7. Accessibility contract (WCAG 2.2 AA)

**Contrast.** §2.1, with the `--ink-3` on `--surface-3` exclusion. Graphics and UI components
≥ 3:1 in all three themes. The glass floor is measured, not assumed, and text on glass is
always `--ink`.

**Colour independence.** Law 2 is the contract: A and B differ by shape and position with
chroma off. Categories are glyph + word. Status is glyph + word. Read is a check glyph.
Agreement is a sentence. **Test procedure:** load each page with
`filter: grayscale(1)` forced on `<html>`, and again under `forced-colors: active`; every
A/B reading must still be answerable. This is a release gate.

**Focus.** `outline: 2.5px solid var(--focus); outline-offset: 3px`, never removed. Cards use a
stretched link with `:has(:focus-visible)` outlining the whole card. SC 2.4.11: every focusable
row carries `scroll-margin-top` equal to the sticky toolbar height plus 8 px, so focus is never
obscured by the stuck chrome. Focus returns to the invoker after every sheet, popover and
palette close.

**Keyboard.** `⌘K`/`Ctrl+K` palette · `/` search · `j`/`k` next/previous · `q` queue ·
`m` mark read · `[`/`]` previous/next section · `Esc` close. Single-character shortcuts have an
off switch in Settings (SC 2.1.4) and are listed in the status bar and on Method. The sky is one
tab stop with roving arrow keys; every list has a visible skip-to-content path.

**Text equivalents.** Every data mark is `role="img"` with a complete label, or `role="table"`
with per-cell labels (§3). The sky has a working `View as table`. Lists expose
`aria-setsize`/`aria-posinset` — required from day one so that adding windowing later does not
change the semantics.

**Dragging.** Queue reorder has explicit Move up / Move down buttons (SC 2.5.7).

**Preferences.** `prefers-reduced-motion`, `prefers-reduced-transparency`,
`prefers-color-scheme`, `prefers-contrast: more` (hairlines go solid, rings go 3 px, the gap
band switches to hatch), `forced-colors: active` (the degradation pattern in §3.4, applied to
*every* data mark; pattern lifted from `reading-room/mock/assets/parallax.css:681-689`), text
size 93.75–125 %, and 200 % browser zoom reflowing to the phone layout.

**Print.** Chrome, toolbars, chips, tab bar and controls hidden. The sky prints as ink on white
with axis labels. Gauges print with carets, hatched spread bands and the legend. The glance
card prints. Ratings print fully expanded. Link URLs are appended in prose.
`break-inside: avoid` on cards; `break-after: avoid` on headings.

**Language and structure.** One `<h1>` per page, correct heading order, landmarks, a skip link,
`aria-live="polite"` on result counts and the overall score.

---

## 8. Performance budget, and how 2,000 reports fit inside it

### 8.1 Payload
Measured on today's 53 entries: a lean index entry is ~820 B raw / ~205 B gzipped; a full entry
with judgment is ~1.6 KB.

| Budget | Limit |
|---|---|
| HTML + CSS + JS, gzipped | **≤ 45 KB** (CSS ≤ 11 KB gz / ≤ 42 KB raw; JS ≤ 12 KB gz / ≤ 38 KB raw) |
| First index shard | **≤ 85 KB gz** (newest 400 reports) |
| First load total, gzipped | **≤ 150 KB** |
| Per-report shard | ≤ 12 KB gz, fetched on demand |
| Source ledger | pages of 500 records, fetched on demand |

At 2,000 reports the full index is ~1.6 MB raw / ~410 KB gz, so it is **never loaded whole**.
Split `data.json` into `index/<shard>.json` (newest first, 400 per shard) plus
`reports/<id>.json`. Search beyond the loaded shards triggers a shard fetch with the palette's
inline loading state. Past ~10,000, shard by year.

### 8.2 Rendering
- **`content-visibility: auto` + `contain-intrinsic-size` on every date group, day one.** All
  four concepts specified this and none implemented it (verified: 0 occurrences in all four
  stylesheets). It is the single highest-value line in this spec and it is a release gate.
- Fixed row heights per density (§4.2) make the intrinsic sizes exact, which is also the
  precondition for windowing later.
- Incremental append of 60 rows per `IntersectionObserver` hit.
- **Windowing only past 1,500 rendered rows**, and only once scroll restoration, focus
  retention across re-render, and `aria-setsize`/`aria-posinset` are built. Known cost, to be
  written into the release note: Cmd+F cannot find rows that are not in the DOM. Until then,
  document scroll + `content-visibility` is the answer. **The library uses document scroll, not
  an `overflow:hidden` app shell** — find-in-page, Space paging and back-navigation scroll
  restoration must behave like a normal page.
- **No SVG in list rows.** Six DOM nodes per profile, no `mix-blend-mode` anywhere in a list
  (Constellations' ~106 composited blend layers per index screen is the thing to avoid), no
  `ResizeObserver` re-rendering per-row graphics, no synchronous measurement in any render path
  (Reading Room's `fitCovers()` at `parallax.js:93-105` is the anti-pattern: up to 23 forced
  layouts per cover, re-run on every filter change).
- Search over a precomputed lowercase haystack built once per shard; debounced 120 ms;
  **filtering must not read layout**. Target: re-filter 2,000 rows in ≤ 16 ms.
- Sky: SVG up to ~600 stars. Beyond that, a canvas layer with focusable proxies for the current
  filter only, plus a time-window control (`Last 12 editions · All`). Clusters merge with a
  labelled count.

### 8.3 Composition
At most two blurred surfaces on screen at once (§2.4). Sticky rails are opaque. Blur layer count
must not scale with the number of edition groups, rows, or anything else that grows.

### 8.4 Release gates (a `tools/check.mjs` run in CI)
1. No horizontal overflow at **320 px**, 390 px, 768 px, 1024 px, 1440 px — with a screenshot
   committed at 320 px. (Two of the four concepts shipped this proof; the winner must.)
2. Contrast sweep over the token matrix, including the `ink-3`/`surface-3` exclusion.
3. Zero `px` values inside any selector matching the data-mark classes.
4. `content-visibility` present on every list group.
5. `forced-colors` and `prefers-reduced-transparency` blocks present and non-empty.
6. Every control in the DOM has a handler (no dead `View as table`).
7. CSS and JS size budgets.

---

## 9. The calls I made where judges disagreed

**9.1 Hero: sky or reports first?** Jury and engineer want the plotted library as the hero; the
reader measured that it costs ~1,400 px before the first report. **Call: both, by geometry.**
Desktop puts the headline and the sky side by side in one band; phone puts reports first and
the sky in a remembered disclosure below them. Nobody loses the chart; the returning visitor
stops paying for it.

**9.2 What does colour encode — A/B identity (Glass) or disagreement (Constellations)?**
**Call: disagreement.** Glass's cyan-A / amber-B is a permanent hue code that spends the page's
entire colour budget on something shape already says, and it collapses to two near-identical
reds in night vision anyway. Constellations' rule is the better idea, but its implementation
leans on `mix-blend-mode` and fails exactly where it is used most. Taking the rule and dropping
the mechanism gives a page that is ink everywhere except where the two runs actually split —
which is both the most memorable thing in the exercise and the most honest.

**9.3 Which A/B mark?** Glass's disc/ring, Instrument's carets, or Constellations' overlap?
**Call: Instrument's carets, everywhere, as the single grammar.** Position (above/below the
line) plus shape, zero drawing cost, and its night-vision screenshot proves it survives red
light intact. Glass's disc/ring is real shape coding but both marks are `background` /
`box-shadow`, so they vanish under forced colors; the caret degrades to `CanvasText` cleanly.

**9.4 Row mark?** Pentagon, five-bar profile, or Instrument's 3 px fingerprint? **Call: the
five-bar profile at 26 px**, with the tinted disagreement cap. The pentagon is inert at row size
(3.4 px of fringe for the maximum real disagreement); the fingerprint is 3 px wide at .62 opacity
and near-decorative on a phone. The profile gives 2.6 px of height per rating point and a real
silhouette — and the cap makes it carry the ink law too, which neither original did.

**9.5 Rationales: print all ten (Glass) or collapse (Constellations)?** **Call: collapse on
agreement, expand on split, and give the full comparison a proper home** — Reading Room's
facing-pages spread at the end of the card, not Instrument's 352 px inspector that clamps both
rationales to four lines.

**9.6 Margin cards for use cases and limits (reader's request).** **Declined as specified.**
The At a glance card already carries that exact generated content; repeating it in the margin
puts the same text on the page twice and takes the margin column from `Cited here`, which
nobody else built and which is the strongest available evidence that these reports are
source-linked. Instead the reading capsule carries a `Glance` button that re-opens the card as a
popover from anywhere in the report (§6.3). The need is real; the duplication was the wrong fix.

**9.7 Serif or SF for the display?** **Call: serif.** Three of the four directions opened with
the same tight-tracked heavy SF Display headline. Reading Room's serif is the one opening that
does not look like every other 2026 AI site, and the chassis already owns a serif for prose.

**9.8 Virtualization.** **Call: `content-visibility` day one, windowing only past 1,500 rows,
and never an `overflow:hidden` app shell on a public reading site.** The engineer ranked
Instrument first partly on a scale story that is entirely unbuilt; the honest version is the
interim step that Instrument's own concept names.

---

## 10. Graft ledger — what each graft replaces

| # | From | What | Replaces |
|---|---|---|---|
| 1 | constellations | The ink law: chroma only where the runs differ (§1 Law 1) | Glass's permanent cyan-A / amber-B hue coding and its category-tinted chips |
| 2 | constellations | `Runs differ on 2 of 5` on every row and tile | Glass's silent score column — verified in `glass/mock/app.js:221` that the agreement sentence exists only in the report |
| 3 | constellations | Progressive rationale disclosure | Glass's ten always-expanded rationale paragraphs |
| 4 | constellations + instrument | "Two runs of the same reviewer model: a consistency check, not independent validation", verbatim | Glass's provenance line, which shows both runs are `gpt-6-astra` and leaves the reader to infer it |
| 5 | instrument | The caret gauge + explicit spread band + inline legend (§3.2) | Glass's disc/ring track and gradient span |
| 6 | instrument | Shape-only contract as a release gate (§7) | Glass's zero forced-colors handling (grep: 0) |
| 7 | instrument | Smart lists (`Unread 50`, `Quick reads, 5 min 7`, `Rated 6.5 or higher 14`) + sticky date-group headers + the always-visible status bar | Glass's missing unread/resume affordances and its unlabelled profile glyph |
| 8 | instrument | `em` breakpoints | Glass's px media queries |
| 9 | instrument | Convergence motion on the gauge (§6.5) | Glass's generic mark fade |
| 10 | reading-room | The arithmetic line under every overall score | Glass's bare `6.5 out of 10` |
| 11 | reading-room | The serif voice for the display line and report H1 | Glass's 80 px SF Display 700 at −0.038em — the single clearest piece of unearned Apple imitation in the set |
| 12 | reading-room | The facing-pages A/B spread with qualifications and SHA-256 | Glass's two stacked vantage blurbs |
| 13 | reading-room | `forced-colors` + `prefers-contrast: more` degradation pattern, generalised to every data mark | Nothing in Glass — this is new surface |
| 14 | reading-room | The Continue reading card in the hero | Glass's resume, which is buried inside the Queue sheet |
| 15 | glass (kept) | At a glance card, Cited here margin column, edition-lead layout, five-bar profile, vantage switch, two-voice type, reading capsule, palette, sky, transparency fallbacks | The baseline's 53 identical catalogue rows and its buried ratings |

---

## 11. Dropped, with the reason

1. **Reading Room's covers, in every form** — as encoding (reviewer B renders at 0.94 px against
   A's 5.87 px on a 176 px cover), as navigation (Models is 38 % of the library → ~760 blue
   rectangles at 2,000 reports), and as a shelf (no summary, no agreement, truncated titles).
   Also `fitCovers()` and its forced synchronous layouts, the five-pigment category system, the
   13 px disc-plus-ring "pair" glyph, the interleaved edition tiles, and the 500 ms
   long-press-to-peek.
2. **Constellations' pentagon at row and phone size**, the `How to read a constellation` legend
   box (if the hero graphic needs a key beside it, it is the wrong hero graphic), the
   configurable two-axis scatter as a hero element (it becomes a `Compare` view behind a link),
   `mix-blend-mode` as an encoding channel anywhere, and any control shipped as a label without
   a handler.
3. **Instrument's `100dvh` three-pane app shell as the public page** — 2,000-word prose in a
   ~505 px sans column between two chrome panes, with document scroll, find-in-page and scroll
   restoration broken. Also its fixed-px gauge geometry.
4. **Glass's hero headline treatment**, its separate floating search orb, decorative
   backdrop-blur anywhere content does not scroll beneath, the per-edition sticky rail's own
   `backdrop-filter`, and the unlabelled profile glyph.
5. **Any framing of A and B as independent experts, opinions or validation**, anywhere.
6. **Shipping without `content-visibility`** on list groups.

---

## 12. Build order and open risks

**Order.** (1) Tokens, themes, the contrast and L\* gates. (2) The parallax mark in all three
sizes plus its forced-colors/night/print degradations — this is the spine; nothing else is worth
building until a 1-point disagreement is legible in every theme at 26 px. (3) Library row, date
groups, `content-visibility`, toolbar, smart lists, status bar. (4) Report: header, At a glance,
prose, Cited here, ratings spread. (5) Sky. (6) Palette, queue, settings, export/import.
(7) Sources, editions, method. (8) The motion layer last, so it is never load-bearing.

**Risks.**
1. The maximum disagreement anywhere in the real data is **one point**, so the tinted cap is
   2.6 px tall at default text size. The text label is load-bearing by design; if usability
   testing says the cap is invisible, raise the bar height before adding a second colour.
2. Serif display depends on the platform face: New York in Safari, Iowan Old Style in Chrome on
   macOS, Sitka/Cambria on Windows. Tune line-height and measure against **Iowan**, not New
   York, so the worst common case is the designed case.
3. The night-vision theme lives in a 4.5–6.3:1 band; any future imagery needs a red filter or an
   exclusion.
4. Dark canvas moving from `#05070D` to `#14181F` is a visible change from the mock. It is
   deliberate (§2.1) and should be reviewed on an OLED phone early.
5. The sky has two renderers in its future (SVG, then canvas with focusable proxies). Keep the
   star data and the label generator shared so the accessible representation is written once.
6. One maintainer. Every component in §4 must be renderable from `index.json` alone, with no
   per-component measurement step and no second source of truth for a score.
