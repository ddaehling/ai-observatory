# Parallax design audit

13 November 2026

**Subject:** the public site "Parallax · AI Observatory" (https://ddaehling.github.io/ai-observatory/), built from `src/index.html`, `src/styles.css`, `src/app.js` and `dist/data.json`. At the time of the audit it held 53 reports, 3,009 source records and 10 editions.

**Method:** five independent audits were merged here: visual design, interaction, accessibility, performance and data storytelling. Overlapping findings were combined. Where the audits disagreed, the code and data were checked again, and section 5 gives a ruling for each case. Code-level causes and every data statistic in this document were re-checked against the repository and `dist/data.json`. Rendered measurements (pixel positions, timings, contrast of rendered controls) come from the audit harnesses and were spot-checked against their screenshots.

**References:** `src/…`, `scripts/…`, `DESIGN.md`, `PRODUCT.md` and `DATA_CONTRACT.md` are relative to the repository root `/Users/daniel/Documents/New project/ai-observatory`. Screenshots and measurement files are cited as [E1], [E2] and so on, and Appendix B lists their absolute paths.

---

## 1. Summary

Parallax has unusually strong raw material. Every report has a source-linked long form, a practical judgment of one paragraph, use cases and limits, plus five ratings from two separate reviewer runs, each with a written reason. Reading data stays private in the browser. The long-form typography is careful. The founding idea is distinctive and fits the product: two observers at the ends of a baseline, whose readings either agree or show a measurable offset.

The site makes poor use of that material. Five problems explain most of the owner's dislike:

1. **It looks like a template.** Cream paper, navy ink and one vermilion accent, large light serif headlines that end in a full stop, tiny monospace uppercase labels and a four-point sparkle make up the generic "AI editorial" look of 2024–26. The parallax idea appears only as watermarks and a hover effect.
2. **The decision comes last.** The verdict and the ratings sit 69–81 % of the way down each report. The index shows a single score with one decimal, which hides how reports differ: 45 of 53 reports share their overall score with another report.
3. **Core mechanics are unreliable.** Red mode hides the labels of 62–64 buttons. Checking a score corrupts saved reading progress. Device dark mode flips to light after the page loads. Whole surfaces (sources, queue, palette, settings, editions) are effectively unstyled because the markup and the stylesheet follow different contracts.
4. **It does not scale.** Every page waits for one 3.9 MB file, so the index takes about 4.2 s to appear on a mid-range phone over 4G. The Sources page builds 72,000 elements in one task and freezes a mid-range phone for 12–20 s. With thousands of reports, the index would be hundreds of screens long and the data file would grow to tens of megabytes.
5. **The transparency pages read as logs.** Sources opens on an alphabetical list of unverified crawl leads, and its first row is a news headline about AI-generated child sexual abuse material. Editions opens a 196-item access log and labels the library size "published reports".

**Today and the target**

| Measure | Today | Target |
|---|---|---|
| First report title, 1440×900 | y = 873 px, so no title fully visible | ≤ 300 px |
| First report title, 390×844 phone | y = 1,172 px, about 1.4 screens down | ≤ 400 px |
| Report rows per desktop screen | 2.2 | ≥ 8 in compact density |
| Transfer before the first useful paint | 3.89 MB raw, about 680–700 KB gzip | ≤ about 25 KB gzip |
| Index painted, mid-range phone, 4G | about 4.2 s | about 1 s |
| Position of the verdict in a report | 69–81 % down the page | first screen |
| Sources route render | 2.4–4.3 s desktop; 12–20 s at 4× CPU slowdown | < 200 ms |
| Buttons readable in red mode | 2 of 66 | all |
| Distinct font sizes in the CSS | 59 (13 separate `clamp()` formulas) | about 9 tokens |
| Screen CSS rules that never match | 140 of 471 (27 %) | no dead hooks |

---

## 2. Design principles for the rework

Each principle comes with a test that a reviewer can check.

1. **Verdict first, evidence on demand.** Every report answers "is this worth my time?" on its first screen: the judgment, the shape of the rating, reviewer agreement, what it is good for and what to watch out for. The long form follows as the evidence. *Test: on a 390×844 phone, the judgment and the rating glyph are visible without scrolling.*
2. **The parallax is drawn from data.** Wherever ratings appear, reviewer A (a filled point) and reviewer B (an open ring) are plotted at their real scores, and the two marks fuse into one where the reviewers agree. No decorative motif carries the brand on its own. *Test: every rating display is generated from the A/B integers, and no watermark or ornament stands in for the concept.*
3. **Show the shape, never only the mean.** A single overall number may never hide a dimension, least of all openness: `DATA_CONTRACT.md:25` says "General high score must not conceal license or access limitations". Ties are shown as ties, and the reviewer range sits next to every overall score. *Test: no list shows an overall score without the five dimensions.*
4. **Reports first, at any scale.** On every device the first report is visible without scrolling. Lists are paged or windowed and grouped by edition. No view ever renders thousands of records at once. *Test: at least 8 rows per desktop screen in compact density, and fewer than 2,000 DOM nodes per list view with a 3,000-report fixture.*
5. **One system, enforced.** The design uses a small token set (about 7 text steps plus 2 display sizes, 2 font families, 3 radii, one spacing scale, semantic colours) and a component contract that tests check. Themes change tokens, never components. *Test: a unit test fails when `app.js` emits an unstyled hook or the CSS styles a hook that is never emitted.*
6. **Every viewing condition is first-class.** That covers Automatic (follow the device), Day, Night and a true red-only Red mode, plus Increase Contrast, forced colours, reduced motion and text up to about 160 %. *Test: text ≥ 4.5:1, control boundaries, focus and reviewer marks ≥ 3:1 in every theme, and no clipping at 320 px wide or 320×256.*
7. **Plain words, honest numbers.** Readers see one vocabulary they can understand, and every figure is formatted the same way. No claim, label or inference goes beyond what the data records. For example, edition membership comes only from recorded IDs. *Test: a copy review against the vocabulary sheet (DAT-7), and no derived fact is presented as recorded.*
8. **The reader's place is protected.** Reading state stays local and is always correct: progress counts only the prose actually read, the saved order is kept, records for unknown reports are preserved, every change can be undone and focus is never lost. *Test: following a score link or a contents link does not change progress, and removing a queue item moves focus to the next item.*
9. **Fast by construction.** The first useful paint needs at most about 25 KB gzipped. The index is usable in about 1 s on a mid-range phone over 4G, each keystroke takes under 50 ms with 3,000 reports, and scrolling causes no layout work. *Test: a performance budget in CI (PER-10).*
10. **Motion explains change.** Only state changes are animated: opening a report, saving, filtering, and the moment the two reviewers "resolve". Motion follows the device setting by default. *Test: with reduced motion, every transition becomes a crossfade or nothing.*

---

## 3. Findings, ranked by user impact

Severity:

- **Critical:** breaks a required feature, misleads readers, or blocks the product's purpose at its intended scale.
- **Major:** significant friction, a trust problem or an accessibility failure on a core task.
- **Minor:** limited in scope, or affects few users.
- **Polish:** small inconsistencies.

The "Lenses" line names the audits that reported each finding.

### Critical

#### C1. Red mode hides the labels of 62–64 buttons and is not safe for night vision

- **Evidence:** `src/styles.css:2115` sets `:root[data-theme="redlight"] .button { color:#0a0404 }`. Its specificity (0,3,0) beats `.button-secondary`, `:hover` and `[aria-pressed="true"]`, so secondary labels measure 1.00:1 and pressed toggles 1.13:1. The affected buttons are "Save to queue" (×53), Reset, "Mark as read", "Visit official source", "Back to the index", Import, RSS, GitHub and the remove toggles in the queue sheet [E8][E9]. The body ink #ff7a66 is coral rather than red: its relative luminance is 0.36, and 41 % of that comes from the green and blue channels. Links and the focus ring (#ffad7d) are the brightest marks on the page, with 60 % of their luminance from green and blue. Primary buttons and the queue badge are large lit fills. The browser bar stays beige because `theme-color` is fixed (`src/index.html:9`).
- **Impact:** one of the three advertised themes cannot be used, and the mode undoes the dark adaptation it exists to protect.
- **Direction:** themes redefine tokens only, including button colours for each state (VIS-2). Rebuild Red from red-only values with outline controls and no large fills (ACC-3, ruling R2). Add a contrast test for every control in every theme (ACC-1).
- **Lenses:** all five.

#### C2. Saved reading progress is corrupted by navigation and never turns into "read"

- **Evidence:** progress is the deepest scroll point reached in `#report-body`, which also contains the judgment, use cases, limits, ratings and bibliography. The value can only grow, and nothing ever sets `read` automatically (`src/app.js:297–311`, `Math.max` at line 303). Measured on the Transformers report:
  - At the end of the last prose section progress shows 73 %. At the bottom of the page it shows 100 %, and `read` is still false.
  - Following the score link on an index row (`#report/<id>/ratings`, `app.js:127`) changed a report from "Unread" to "84% read" with no reading.
  - One tap on "Sources & research notes" in the table of contents set progress to 96 % and removed "Resume reading", which only appears between 0 and 95 % (`app.js:164`).
  - Marking a report as read and then unmarking it stores `{read:false, progress:100}`. The index then shows "100% read" for a report that still appears under the Unread filter (`app.js:323`, `132`) [E27].
- **Impact:** the read labels, the Unread filter, the queue percentages and Resume all become wrong without the reader noticing. Saved progress is a feature that must be kept.
- **Direction:** measure only the prose sections with an IntersectionObserver, ignore jumps caused by links, store a resume anchor and reset progress on unmark (REA-2).
- **Lenses:** interaction.

#### C3. Report pages bury the verdict

- **Evidence:** the report header (`app.js:163`) holds the category, title, summary, reading time, dates and buttons. It has no score, no rating shape and no judgment, although `styles.css:1257` and `1294` were written to hold a score grid there. The Transformers report is 16,305 px tall at 1440 px wide:
  - The practical judgment starts at y = 11,178 (69 %), the ratings at 73 % and the sources at 80 % [E4].
  - On a 390 px phone the ratings start 81 % of the way down.
  - The first paragraph begins at 933 px on desktop. On a phone it begins about 1.7–1.8 screens down, because the table of contents and the progress widget come first [E21].

  The judgment, use cases and limits have no `id`, so they cannot be deep-linked (`app.js:167–169`). The judgment is a plain paragraph (`.editorial-judgment` has no CSS rule). The right half of the header is a decorative graticule that encodes nothing [E3].
- **Impact:** every one of the 53 reports has a judgment of 108–309 characters. A reader deciding whether a 10–13 minute report is worth reading has to scroll about 11,000 px (more than 13 phone screens) to reach it.
- **Direction:** a verdict-first header ("At a glance", REA-1). The long form follows as the evidence.
- **Lenses:** interaction, storytelling, visual.

#### C4. Five ratings collapse into one decimal, and the two-reviewer story is never drawn

- **Evidence:**
  - **The chip hides the spread.** Index rows, the palette and the queue reduce five dimensions to "5.6 / 10 · two reviews" (`app.js:127, 247`). Overall scores span only 4.0–7.8 (mean 5.87, SD 0.77), and 41 of 53 fall between 5.0 and 6.9. There are only 22 distinct values, and 45 reports share their score with another report. The spread that matters is hidden. Openness runs from 1.5 to 9.0 (SD 2.36) and splits into two groups: 24 reports at 4.0 or below, 27 at 6.0 or above. It is nearly independent of the other dimensions (r between −0.08 and 0.25). Mecatl (openness 8.0) and GPT-6.1 Terra (openness 2.5) show the same 5.8 chip [E7]. That breaks the intent of `DATA_CONTRACT.md:25` by construction.
  - **Agreement is never shown.** The agreement between the reviewers is the literal parallax. A and B give identical scores on 212 of 265 dimension pairs, the other 53 differ by exactly one point, and none differ by two. 22 reports agree on all five dimensions, and novelty is the most contested (16 splits).
  - **The ratings section spends its space on boilerplate.** It prints "A 9 · B 9" as plain text with old-style figures (`app.js:156`) and repeats a fixed rubric definition in every tile. On desktop, phone and the Method page it leaves an empty sixth tile [E5]. The 10 written reasons per report are hidden in two collapsed panels. Opening reviewer A produces a 3,232 px column next to an empty B panel [E6]. All 106 reviews say "Approve", which carries no information, while confidence does vary (30 of 106 reviews are medium) and is buried in the summary line.
  - **The ranking implies false precision.** "Highest rating" breaks 14 tie groups alphabetically (`app.js:132`). On 10 reports the two reviewers' overall means differ by 0.4–0.8, which is larger than most gaps between adjacent ranks.
- **Impact:** readers compare reports on the least informative number, and the main trust signal (agreement) is invisible. Licence and access limits disappear behind a mean, and the order looks precise when it is not.
- **Direction:** the "sighting" glyph family and dimension rows (DAT-1, DAT-2), ties shown as ties, and the reviewer range next to every overall score (DAT-3).
- **Lenses:** visual, storytelling, interaction, accessibility.

#### C5. The index puts a hero and tall rows first and has no structure for thousands of reports

- **Evidence:**
  - **No report on the first screen.** At 1440×900 the masthead and hero fill 74 % of the viewport and the first title starts at y = 873 [E1]. On a phone it starts at y = 1,172 [E2].
  - **Rows are tall.** They average 327 px on desktop, 431 px on tablet and 514 px on phone, which leaves 2.2 rows per desktop screen (below about 170 px of sticky header and toolbar) and 1.45 per phone screen (below the 99 px masthead) [E26]. 53 reports already make an 18,689 px page. 2,000 reports would make about 654,000 px on desktop and about 1,027,000 px on phone.
  - **Rows are noisy.** Each row carries 8 bordered boxes, 5–6 tags that look like buttons but do nothing (12 % of the row area is a dead click), and the word "Unread". On a phone the score (25.6 px) is larger than the title (21.6 px) [E44].
  - **No structure.** Reports are not grouped by edition or category, and there is no paging; the `.pagination` styles at `styles.css:1736–1765` are never used.
  - **It slows down with size.** With 2,120 simulated reports the list has 48,627 DOM nodes and 6,360 tab stops, and each keystroke takes 198–448 ms. With 3,021 reports a keystroke takes 2.75 s and returning to the index 3.07 s at 4× CPU slowdown [E28].
- **Impact:** discovery is already slow and would become unusable at the target scale. `PRODUCT.md:13` asks that the design never delay access to reports.
- **Direction:** a front page that shows reports immediately, two row densities, edition groups, chips with counts, and paging or windowing (DIS-1, DIS-2, PER-3).
- **Lenses:** visual, interaction, storytelling, performance.

#### C6. Every page waits for one 3.9 MB data file

- **Evidence:** `app.js:362` fetches `./data.json` before anything renders. The file is 3,892,460 B on disk because `save_json` writes it with `indent=2` (`scripts/observatory.py:68`). Without the whitespace it would be 3,346,821 B, and GitHub Pages serves it as about 680–700 KB gzip. In compact form the sources take 1.76 MB, the entries 1.26 MB (report sections 0.74 MB, reviews 0.29 MB) and the runs 0.33 MB. The fields the index actually uses come to about 56 KB (1.7 %).

  On a simulated mid-range phone over 4G, the first paint at 0.53 s shows only "Loading the current edition…", and the index appears at about 4.18 s. With a catalogue-only file (14.7 KB transferred) it appears at about 0.85 s [E29]. A deep link to a single report also waits for everything. With 1,060 and 3,021 synthetic reports the file grows to 30 MB and 81 MB.
- **Impact:** first visits on phones are slow today, and the planned scale would make the site unusable. Unthrottled desktop testing hides the problem, because there the page paints in about 60 ms.
- **Direction:** split the build output into a small catalogue, one file per report, and sources and runs loaded on demand (PER-1, PER-2).
- **Lenses:** performance, interaction.

#### C7. The Sources page freezes the device and opens on an offensive headline

- **Evidence:**
  - **Everything renders at once.** `renderSourceList` (`app.js:184–189`) renders all 3,009 records: 72,371 elements (159,980 nodes), on a 763,710 px page. Opening the route takes 2.4–4.3 s on desktop and runs as a single 12–20 s task at 4× CPU slowdown. Each keystroke in the ledger search then costs 0.7–2.9 s, because input is not debounced (`app.js:181`).
  - **Root cause.** An A/B test found it: 3,009 `<summary>` elements (`display: list-item`) sit inside `#app`, which is a size container (`styles.css:432`). Removing the container or setting `summary { display:block }` brings the route down to about 0.56 s, and `content-visibility:auto` brings it to about 0.29 s [E30].
  - **The first rows are noise.** The default sort is alphabetical (`app.js:186`), which puts headlines that start with quotation marks and punctuation first. Row 1 is a news headline about AI-generated CSAM, and row 3 is a Reddit post with profanity [E13][E31]. 2,282 of the 3,009 records (76 %) are unverified leads.
  - **Status is not shown.** Status classes are emitted as `status-*` but styled as `[data-status]` (`styles.css:1602–1622`), so every status looks the same, with a "/" separator drawn inside the tag (`styles.css:1597`).
  - **No links to the reports.** No record links to the reports that cite it (about 300 records, roughly 10 %). 13 cited sources contradict their ledger status: 11 are "unverified" although the report says it accessed them, and 2 are "blocked" 404 pages that are cited anyway.
- **Impact:** Sources is the second item in the main navigation. It freezes mid-range phones and greets visitors with offensive text, so the page meant to prove rigour undermines trust.
- **Direction:** show watched publishers and cited sources by default, keep leads behind a toggle with paging, and never render the full ledger (DAT-5, PER-4).
- **Lenses:** all five.

#### C8. The visual identity is a stock template, and the parallax idea is only ornament

- **Evidence:**
  - **Stock palette and type.** The tokens are cream #f2eee4, navy #13172a and one vermilion #e2502c (`styles.css:15–33`). Every page opens with a large light serif line ending in a full stop ("Look closer.", "Follow the evidence.", "What each scan saw.", "Make room for reading."). Above it sits an 11–12 px uppercase monospace label with a four-point sparkle cut out by `clip-path` (`styles.css:459–475`). The same sparkle is the horizontal-rule ornament, the edition marker and the star in the mark [E32].
  - **The concept is decoration only.** It appears as the graticule watermark in six places, a 2 px red/blue shadow on hover (`--split`, `styles.css:56`) that looks like a printing misregistration, and coloured text shadows. On the index the two reviews shrink to a half-and-half dot of 8.8 px.
  - **Colour meanings overlap.** The reviewer colours also serve as link, focus and label colours, so blue means both "reviewer B" and "clickable".
- **Impact:** nothing on screen is distinctive or memorable, which is the main reason the owner dislikes the site. This finding is critical for the stated goal, not for task completion.
- **Direction:** build the identity on one idea expressed as data: the measured offset between reviewers A and B (DAT-1, VIS-1). Retire the sparkle, the monospace uppercase labels, the coloured split and the watermarks, keeping one graticule moment. Reserve the A/B colours for reviewer data.
- **Lenses:** visual, storytelling.

### Major

#### M1. The markup and the stylesheet follow different contracts, so whole surfaces are unstyled

- **Evidence:** runtime coverage across all routes, both dialogs, the empty, error and 404 states, three viewports and three themes found that 140 of 471 screen rules never match (27 %, 18 KB), and 103 of them are dead hooks. A static scan found 23 styled classes that are never emitted (`.table-wrap`, `.pagination`, `.review-head`, `.score-a` and `.score-b`, `.edition-date`, `.source-name` and others). It also found 26 emitted classes with no rule (`.report-deck`, `.editorial-judgment`, `.overall-score`, `.queue-list` and `.queue-item`, `.settings-layout`, `.status-*`, `.change-*` and others) [E33]. The visible results:
  - **Sources titles** are `<h2>` (`app.js:188`), but the CSS styles `h3`, `h4` and `.source-name` (`styles.css:1568`). They render as 24 px bold, blue, underlined sans text with a doubled ↗: `app.js:29` adds one arrow and `styles.css:1578` adds another, and the bibliography has the same double arrow.
  - **The queue sheet** renders `div.queue-list > article` (`app.js:236`), but the CSS targets `.sheet-body > ol > li` (`styles.css:2078`). Titles come out bold, blue and underlined, and each "In queue ✓" button sits 0 px from the next title [E10].
  - **Palette results:** the detail span sits inside the link (`app.js:252`), so its label style never applies and the text runs together: "…open-weights releaseModels · 5.6 / 10" [E11].
  - **The report summary** under the title is `.report-deck` (`app.js:163`), but the CSS styles `.report-summary` (`styles.css:1250`). It renders as 16 px sans across 1,280 px, about 171 characters per line and wider than the title [E3]. The drop cap never renders, because its selector expects paragraphs directly inside `.report-body`.
  - **Settings** uses three `<select>` menus (`app.js:199`), so the theme swatches and "Aa" previews (`styles.css:1789–1848`) are never drawn. Spacing is inverted: 40 px between elements inside a panel, 0 px between panels (`styles.css:1767`) [E25].
  - **Editions** emit no `<time>` element, leaving an empty 11 rem date column (`styles.css:1700–1704`).
  - **The coverage note** at the end of the index is unstyled 16 px sans at 1,280 px wide, about 164 characters per line.
- **Impact:** next to the carefully set report column, these surfaces look like unfinished prototypes.
- **Direction:** a component contract, a specimen page and a drift test (VIS-3).
- **Lenses:** visual, performance, interaction, accessibility, storytelling.

#### M2. There is no type system, and the cascade fights itself

- **Evidence:**
  - **Too many sizes.** The stylesheet uses 59 distinct font sizes and 13 separate `clamp()` formulas; only the font families are tokens (`styles.css:44–46`). The index renders 17 sizes in 27 type styles.
  - **Too much monospace.** 480 of 829 visible text elements on the index are monospace (58 %), and 219 are uppercase monospace. One row mixes 3 families in 10 styles [E34].
  - **Inconsistent details.** Uppercase letter spacing takes six different values. Toolbar labels follow two systems ("FIND A REPORT" in uppercase monospace, "Category" in sans). Numerals are old-style in "A 9 · B 9" and lining elsewhere.
  - **Rules collide:**
    - `.edition p` (`styles.css:1695`) beats `.eyebrow` (459), so edition labels render as 16.8 px grey serif capitals.
    - `.report-body h3` (1401) restyles `.review h3` (1197) into 24.7 px italic serif capitals.
    - `.report-section > h2:not(.section-heading)` (1493) overrides the reading scale, so phone headings are 24 px instead of 31.5 px.
    - Separators in the metadata lines are drawn as `::before` on every following item (939, 1597), which puts dots and slashes inside tag boxes.
  - **Duplication.** The dark token block is written twice (59–73 and 75–87), there are two competing row grids (967–1001 and 2208–2216), 20 `!important` declarations and three reduced-motion blocks.
- **Impact:** hierarchy comes from switching fonts instead of size and weight, small breakages appear everywhere, and every fix risks a new collision.
- **Direction:** a type system (VIS-4) and token-only themes in cascade layers (VIS-2).
- **Lenses:** visual, performance, accessibility.

#### M3. The navigation follows the research pipeline, not the reader's tasks

- **Evidence:**
  - **Back-office pages in the main navigation.** The main navigation is Index, Sources, Editions, Method, Settings (`src/index.html:40–46`), so two of the five destinations are back-office logs.
  - **The scanner leaks into Settings.** Settings opens with "The scan schedule" and a filled primary button that links to `http://127.0.0.1:8893/` (`app.js:198`); that address only works on the owner's Mac. The reader preferences start below the fold (y = 1,082 on desktop) [E35].
  - **Nothing to browse.** The 5 categories and 153 tags have no page of their own.
  - **No links between sources and reports.** Ledger records do not link to the reports that cite them, and bibliographies do not link to the ledger.
  - **Constraint.** `PRODUCT.md:9` and `:13` require that the schedule is shown accurately and that the ledger, editions, method and settings exist, so the rework should regroup these pages, not remove them.
- **Impact:** the provenance exists but cannot be reached where trust is needed, which is inside a report. The owner's operations leak into the public product.
- **Direction:** Library, Reading list and About, a "How we know this" block in every report, and the local control shown only on localhost (DIS-5, ruling R11).
- **Lenses:** interaction, storytelling, visual.

#### M4. The first screen does not say what this is or why to trust it, and the copy contradicts the method

- **Evidence:**
  - **No plain purpose.** The hero reads "A different angle on artificial intelligence / Look closer." (`app.js:136`). The plain statement of purpose ("research reports on AI for people who teach and build") appears only in the footer (`index.html:86`). The statistics use pipeline jargon ("3009 SOURCE RECORDS", "200 RECURRING ENTRYPOINTS"), and 76 % of those records are unverified leads.
  - **Contradictory claims about independence.** The hero promises "two independent passes on every rating" (`app.js:136`) and the ratings section "two independent Astra review runs" (`app.js:170`). The footer calls the process "a consistency check, not independent validation" (`index.html:89`), and the Method page says "Two independent runs of the same model share underlying limitations" (`app.js:195`). The name "Astra" is never explained.
  - **Internal vocabulary.** "Baseline study" labels 26 of 53 reports, although it means "newly discovered by this project, not newly launched" (`DATA_CONTRACT.md:19`). Crawler terms reach readers: "checked / surfaced", "candidates", "Evidence page", "Role".
  - **One destination, two names.** The ratings section is "Two views, five ratings" in the table of contents and "A closer look at the score." in the body.
  - **An operations paragraph closes the index.** "Bounded November 11 scan: 191 monitored entries accounted for…" (`app.js:143`).
- **Impact:** a non-expert audience gets mixed signals about how far to trust the ratings, and a slogan instead of content.
- **Direction:** one sentence of purpose and method, one vocabulary sheet, and operations language moved to About (DIS-1, DAT-7).
- **Lenses:** interaction, storytelling.

#### M5. Search and filters lead to dead ends

- **Evidence:**
  - **Literal matching.** Search is a literal substring match (`app.js:132`). "lesson" finds 2 reports but "lesson plans" finds none; "comfyui" finds 3 but "comfy ui" none; "editing video" finds none.
  - **A filter that can never match.** "Minimum rating" offers 5–9 (`app.js:140`), but the highest score is 7.8, so 8 and 9 always return nothing [E22].
  - **No state, no way back.** Filter state never reaches the URL, and there is no summary of active filters. The empty state says to reset the filters but offers no button (`app.js:152`).
  - **Missing filters.** There is no filter or sort by dimension, although usefulness (5–9) is the dimension that matters most to this audience.
  - **Inconsistent labels.** Tags have case duplicates ("education" ×36, "Education" ×3). Category options are title-cased ("Open Source"), while rows use sentence case ("Open source") (`app.js:117`).
- **Impact:** natural multi-word queries from teachers fail without explanation, and screens with zero results leave the reader stranded.
- **Direction:** a ranked search with word tokens (DIS-4), filter chips with counts and recovery suggestions, and state in the URL (DIS-3).
- **Lenses:** interaction, storytelling.

#### M6. The command palette hides results and lets its search field scroll away

- **Evidence:**
  - **Pages come last.** With an empty query the palette shows 12 reports in data order and no pages. `app.js:247` cuts reports plus pages to 12 and always lists pages after reports, so typing "method" and pressing Enter opens a report.
  - **The list does not scroll.** `.palette-inner { max-height: inherit }` (`styles.css:1947`) resolves against a dialog with automatic height, so the list never scrolls. At 1440 px only 6 of 12 results are visible and the footer is cut off [E36]. Pressing ↓ eleven times scrolls the whole dialog and pushes the search field 296 px out of view [E12]. On a phone, four results cannot be reached by touch.
  - **Interaction gaps.** Titles and details run together (M1). Hover highlights one item while Enter opens another. The footer hint "/ search the index" only types a "/". There are no commands, for example for theme, text size, saving or marking as read.
  - **Accessibility.** Each option wraps a link (nested interactive elements). The result count is not announced, and "no results" is announced as nothing. The input's only name is its placeholder. The highlighted option measures 1.07–1.23:1 against the dialog, and its side bar 2.33–2.76:1.
- **Impact:** the fastest way around the site is visibly broken on first use, on every device.
- **Direction:** a single search that drives both the index and the palette, with groups, commands and an accessible combobox (DIS-4).
- **Lenses:** interaction, accessibility, visual, storytelling.

#### M7. The reading queue exists three times, ignores the order of saving and loses focus

- **Evidence:**
  - **Three overlapping surfaces.** The queue is a sheet, a page and an index filter. The page re-renders the whole index, with site statistics and four filters, for two items.
  - **Saving order is ignored.** In a test, CADRE, Astryx and Mistral were saved in that order, and the sheet listed Astryx, Mistral, CADRE, which is data order (`app.js:233–236`) [E23].
  - **Removal loses focus.** Removing is a toggle labelled "In queue ✓" with no undo, and afterwards focus falls to `<body>`.
  - **No progress or resume.** The sheet shows "0% read" without a bar or a resume action, and its footer mixes navigation with "Export reading data" (`app.js:238`).
  - **Other gaps.** No navigation item is marked current on `#queue`, and the queue is unstyled (M1).
- **Impact:** this breaks the "keep my place" promise.
- **Direction:** one reading list in three sections with undo (REA-6).
- **Lenses:** interaction, accessibility, visual.

#### M8. Navigation inside reports is inconsistent and ends in empty space

- **Evidence:**
  - **Contents and body disagree.** The table of contents lists the sections plus "Two views, five ratings" and "Sources & research notes" (`app.js:164`). The body numbers every `h2`, including "Where you could use it" and "Limits to keep in view". As a result, "08 Two views, five ratings" in the contents lands on "10 A closer look at the score." in the body [E37].
  - **No current section.** A current-section style exists (`styles.css:1335`), but the code never sets `aria-current` [E38].
  - **History clutter.** Every contents link adds a history entry, so after three taps it takes four Back presses to reach the index.
  - **Focus and Back.** Returning to the index restores the scroll position, but focus moves to `#main` (`app.js:295`), so the next Tab jumps to the search field. "← Back to the index" is a forward link, and the navigation keeps "Index" marked current on report pages (`app.js:278`).
  - **An empty ending.** The report ends with "Mark as read · Back to the index" followed by about 1,368 px of blank scroll, because the sidebar spans 20 grid rows (`styles.css:1267`) [E20]. There is no next or related report.
- **Direction:** one numbered list for contents and body, a current-section marker, and an ending that offers what to read next (REA-3).
- **Lenses:** interaction, accessibility, visual.

#### M9. Phone reading has no controls within reach

- **Evidence:**
  - **Only the masthead stays.** At 390×844 only the masthead (99 px, or 123 px at XL text) and a 3 px reading bar stay on screen.
  - **Controls sit above the text.** The contents and progress sit above the text, which starts around 1,450–1,500 px down, and "Resume reading" is 1,248 px down.
  - **Filters are far away.** The filter bar is not sticky below 48em: at row 21 the filters are 12.7 screens away.
  - **The navigation overflows at XL text.** It is 451 px wide inside a 390 px screen behind a hidden scrollbar, which pushes Settings off-screen [E39].
  - **Small targets.** Targets pass WCAG 2.5.8 (no failures) but miss Apple's 44 pt guideline:

    | Control | Size | Count |
    |---|---|---|
    | "Save to queue" | 118×40 | 53 |
    | Navigation links | 55×42 | 5 |
    | Contents links | 32 px tall | per report |
    | "← Back to the index" | 143×18 | 1 |
    | Review summaries | 29 px tall | 2 per report |
    | Source disclosure rows | 25 px tall | 3,009 |
- **Direction:** a phone reading mode and 44 pt targets everywhere (REA-5, ACC-8).
- **Lenses:** interaction, accessibility.

#### M10. The masthead breaks at tablet widths and at 320 px with large text

- **Evidence:** a sweep from 760 to 1200 px wide found these breakages:
  - The ⌘K hint wraps to two lines at 780–900 px and 980–1040 px.
  - The Find icon shrinks to 6–8 px.
  - At 780–860 px the Queue button is clipped by up to 52 px.

  The causes are an `auto 1fr auto` grid (`styles.css:267`) with a navigation that does not shrink, no `white-space: nowrap` on `.tool-kbd` (386), and a single breakpoint at 47.99em (405) [E15]. At 320 px with XL text the Queue button is cut off by 16 px [E40].
- **Impact:** the first thing an iPad visitor sees is a broken toolbar.
- **Direction:** icon-only tools below about 64em, labels that never wrap, an earlier collapse of the navigation, and a continuous width sweep in tests.
- **Lenses:** visual, accessibility.

#### M11. Content is clipped instead of reflowing

- **Evidence:** `overflow-x: clip` on `body` and `html` (`styles.css:142, 2204`) cuts overflowing content so that it cannot be scrolled:
  - Report tables lose 75 px at 390 px wide, 145 px at 320 px, and 262 px at 320 px with XL text [E16].
  - Opening "Content verification" inside a review cuts 248 px off every line of the reviewers' reasons at 390 px, and 309 px at 834 px [E41].

  The causes:
  - `.report-body > table` (`styles.css:1513`) never matches, because tables sit inside sections, and `.table-wrap` is never emitted.
  - Both sanitizers drop `<caption>`, and the app's sanitizer also drops every attribute, including `scope` (`app.js:100–107`; `scripts/observatory.py:39`).
  - `.review` is a grid with `overflow:hidden`, and the 64-character SHA-256 sets its minimum width.

  At 320×256 (400 % zoom) the sticky masthead takes 39 % of the viewport.
- **Impact:** the site fails WCAG 1.4.10, and phone readers lose table columns and sentences.
- **Direction:** reflow-proof components (ACC-6).
- **Lenses:** accessibility.

#### M12. Keyboard focus is lost, invisible or hidden

- **Evidence:**
  - **Lost after removal.** Removing a queue item moves focus to `<body>`, because the list is re-rendered (`app.js:96/236`, and `319–321` on the page).
  - **Invisible on Import.** "Import reading data" focuses a hidden 1×1 px input whose visible label shows no focus (`app.js:200`), which fails WCAG 2.4.7.
  - **First load skips the masthead.** Every route change, including the first load, focuses the unnamed `#main` (`app.js:295`), so the first Tab skips the masthead's 9 stops.
  - **Hidden under sticky bars.** Shift+Tab hides focus under 170 px of sticky header and toolbar, while `scroll-padding-top` is only 84 px (`styles.css:121`). Of 24 stops, 7 are partly hidden and 1 fully, which fails WCAG 2.4.11 [E17].
  - **A shortcut that cannot be switched off.** "/" is a single-key shortcut (`app.js:336–341`), which fails WCAG 2.1.4.
  - **Duplicate announcements.** Messages are written to two live regions (`app.js:46–51`) and announced twice, and the result count is re-announced on every keystroke.
- **Direction:** focus choreography (ACC-5).
- **Lenses:** accessibility, interaction.

#### M13. Screen readers get no coherent reading of a row, a toggle or a rating

- **Evidence:**
  - **Rows.** `#report-list` is a generic `div`, not a list. The metadata comes before the heading in the DOM (`app.js:123–124`), so heading navigation skips "New · Published…". Tags and reading time are read as one run without separators.
  - **Toggles.** 53 buttons are all named "Save to queue", with no report name. Toggles change their own name ("Save to queue" becomes "In queue ✓") as well as `aria-pressed` (`app.js:85, 90, 116`).
  - **The score link.** Its accessible name ("MiniMax-H3-Image: overall rating 5.6 out of 10. View both reviews.") does not contain its visible text "5.6 / 10 · two reviews", which fails WCAG 2.5.3.
  - **The queue button.** Its count is not exposed.
  - **Ratings.** They read as "Usefulness 9.0 / 10 … A 9 · B 9 Impact 8.0 / 10".
  - **Text selection.** The overlay that makes the whole row clickable (`styles.css:906–912`) prevents selecting summary text, so copy, Speak Selection and Look Up do not work.
- **Direction:** a list that screen readers can follow, and ratings as a table (ACC-4, DAT-2).
- **Lenses:** accessibility.

#### M14. The device's appearance setting is overridden

- **Evidence:** with the device in dark mode and nothing saved, the page loads dark because no `data-theme` is set. After `data.json` arrives, `applyPrefs()` writes `data-theme="plate"` (`app.js:210–212`, called at line 368), and the screen flips from luminance 0.006 to 0.85. On a 4G phone that happens about 4.2 s into the visit [E18]. Settings has no "match device" option (`app.js:199`), and `theme-color` never changes (`index.html:9–10`). The same function always writes `data-text="m"` and `data-motion="allow"`.
- **Impact:** readers who rely on dark mode (for photophobia, migraine or low vision) get a bright flash on every first visit.
- **Direction:** apply appearance in one place, before first paint, and never write defaults (ACC-2).
- **Lenses:** accessibility, performance.

#### M15. Control borders, reviewer marks and high-contrast modes fall short of contrast requirements

- **Evidence:**
  - **Control borders.** The border colour (`--rule-2`, `styles.css:22, 79, 95`) measures 1.83:1 in the light theme, 2.08:1 in the dark theme and 1.65:1 in Red. It is the only boundary of the search input, and WCAG 1.4.11 requires 3:1.
  - **Reviewer marks.** Reviewer B's blue #6f84ff is 2.82:1 on the paper colour, below the 3:1 a ring needs when it identifies reviewer B; reviewer A's vermilion is 3.35:1.
  - **No high-contrast preferences.** There is no handling of `prefers-contrast` or `prefers-reduced-transparency`, so Increase Contrast changes nothing.
  - **Forced colours.** In forced-colours mode (Windows High Contrast):
    - Inputs lose their focus indicator, because focus uses `outline:none` plus a box-shadow (`styles.css:707–714`).
    - The palette selection is invisible.
    - The menu arrows of the selects, which are drawn as gradients, disappear.
    - `<progress>` vanishes [E19].
  - **The dark footer** (#080a14) sits on the dark page (#0e1120) at about 1.05:1.
- **Direction:** a contrast matrix with a CI gate, and appearance that follows the device (ACC-1, ACC-2).
- **Lenses:** accessibility, visual.

#### M16. Editions mislabel their headline number and bury what changed

- **Evidence:**
  - **A mislabelled number.** Each edition card labels `run.publishedCount` as "published reports" (`app.js:192`), but the value is the cumulative library size (6, 11, 17, 24, 31, 38, 43, 46, 49, 53). The 11 Nov card shows "53 published reports" while its own note says it added four.
  - **A log opens by default.** The newest edition opens its "Coverage limitations" by default: 196 bullets keyed by machine IDs, about 12,400–12,900 px of a page about 18,500 px tall. The 10 editions hold 1,305 such lines in total.
  - **No dates, no emphasis.** The labels above the dates show run IDs, the date column stays empty, and the anomaly that matters gets no emphasis: 64 failed or unvisited sources on 11 Nov, against 0–6 in every earlier edition [E14].
  - **No links to reports.** No edition links to its reports. `data/runs.json` already records `newReportIds` and `updatedReportIds` (for the last two runs) and `sourceResults` with `coverageComplete` (for the last three), but `build()` drops them (`scripts/observatory.py:638`, `allowed_run_keys`).
- **Direction:** Editions as an observing log, built from recorded IDs only (DAT-4, ruling R3).
- **Lenses:** storytelling, visual, interaction.

#### M17. Dates on the index contradict the sort, and revisions are invisible

- **Evidence:**
  - **The shown date is not the sorted date.** "Latest additions" sorts by `discoveredAt` (`app.js:132`), but rows print `publishedAt` when it exists (`app.js:123`). The visible sequence reads 10 Nov, 18 Jun, 9 Nov, 11 Nov, 4 Nov, and so on. 12 of 53 reports have no `publishedAt` and say "Added" instead.
  - **Ambiguous labels.** "Published" reads as if Parallax published the report, and the report header calls the same field "Source publication".
  - **Revisions are invisible.** `updatedAt` is never shown. None of the 6 "Update" reports says what changed, and a revision approved on 11 Nov sits in 14th place under "Published 28 Oct".
  - **`discoveredAt` is not the library date.** It records when the candidate was first found, not when the report joined the library.
- **Direction:** one date vocabulary (DIS-8).
- **Lenses:** storytelling, interaction.

#### M18. The rendering model does not scale

- **Evidence:**
  - **Whole-view rewrites.** Every route replaces `#app.innerHTML` (`app.js:136, 163, 178, 192, 195, 198`), then scrolls and moves focus in the same task (294–295), which forces synchronous layout.
  - **No debounce.** Filtering rebuilds the search strings and re-sorts with `localeCompare` on every input event (130–133, 145–147).
  - **Document-wide updates.** `updateReadingControls` rewrites every queue and read button in the document on every toggle (73–97). At 3,021 reports that is 6,043 controls and 1.35 s.
  - **Repeated work.** The index is rebuilt after every report visit, and `safeBody` re-parses every section with DOMParser on each visit (98–115).
  - **Other gaps.** The queue route shares the index's filters, and there are no View Transitions.
- **Direction:** a new rendering model (PER-3).
- **Lenses:** performance.

#### M19. Reading-data validation deletes records for reports that are not loaded

- **Evidence:** `validateReading` keeps only the IDs present in `entries` (`app.js:60–72`). `start()` (367) and the cross-tab `storage` handler (359) replace the reading state with that subset and save it. Today this erases the queue entry, read mark and progress of any withdrawn report. After a catalogue split or sharding, it would erase everything outside the loaded part.
- **Direction:** preserve unknown IDs (PER-2). This must happen before PER-1.
- **Lenses:** performance.

#### M20. Caching and versioning on GitHub Pages waste transfer and allow mismatches

- **Evidence:** every file is served with `max-age=600`, gzip only, and a weak ETag that changes with every deploy. `fetch(…, {cache:'no-cache'})` (`app.js:362`) revalidates on each visit: a 300 B response, but still one round trip and a re-parse of 3.9 MB. Each deploy (every 48 hours) changes every ETag, so a returning reader downloads the full file even if only one report changed. After a deploy, HTML, JS and CSS can be up to 10 minutes older than `data.json`, which will break as soon as the data contract changes.
- **Direction:** versioned assets and content-hashed report files (PER-5).
- **Lenses:** performance.

### Minor

| ID | Finding | Evidence | Direction |
|---|---|---|---|
| N1 | The brand mark is generic and fails at 16 px. | `src/assets/mark.svg`: a navy rounded square with a four-point sparkle over a dashed Λ and two dots. At 16 px the 1.3 px dashed sight lines vanish, the mark has no edge on dark tabs, and it lacks the A–B baseline [E24]. There is no web app manifest and no touch icon: `dist/manifest.json` is the build's integrity manifest, and `index.html:12` links only an SVG favicon. | VIS-5 |
| N2 | Icon sources, corner radii and button shapes are mixed. | Three stroked SVG icons sit beside text glyphs (×, ←, a doubled ↗, ✓ inside labels, the default ▶ disclosure marker, ◆ list markers, the ✦ sparkle). The palette closes with a text "×" (`app.js:345`) while the sheet uses an SVG. There are six radii (3, 4, 6, 14 and 999 px, and 50 %). Masthead tools are pills; every other button is a 6 px rectangle. | VIS-6 |
| N3 | Motion carries no meaning, and the motion setting is modelled inconsistently. | The scroll "parallax" moves a half-transparent watermark 22 px and 5°, and nothing animates when state changes. The UI labels the stored value `allow` as "Follow device preference" (`app.js:199`), the last CSS block (`styles.css:2219–2225`) makes that true, and `DESIGN.md:83–84` says `allow` overrides the device. Reduced-motion users are protected today (ruling R1). | VIS-7 |
| N4 | Loading, error and not-found states are dead ends. | While loading, Find and Queue look enabled but do nothing (`app.js:347–348`). The error card loses its alignment, and its heading is bold sans. `#report/does-not-exist` has no `h1`, and its button sits outside the card (`app.js:284`); unknown routes are titled with the raw slug. Replacing the loading state shifts the layout: CLS 0.53 on the 4G phone profile in 3 of 3 runs [E45][E29]. | PER-7 |
| N5 | Preferences and keyboard support are generic and hidden. | Theme, text size and motion are three selects on Settings, and the reading view has no text-size control. There is no overview of shortcuts and no shortcut to move between rows, save or mark as read. Each row costs three tab stops (159 today, 6,360 at 2,120 reports). The announcer keeps stale messages. | REA-7, ACC-5 |
| N6 | The reading-progress handler forces layout on every scroll frame. | `trackProgress` (`app.js:297–311`) re-queries elements and writes the value, the label and the bar width on every animation frame; the bar animates `width`. That costs about 4.1 ms per frame at 4× CPU slowdown, half of a 120 Hz frame. | PER-6 |
| N7 | Text is too small, and the device text size is ignored. | 44 % of the text on the phone index is below 12 px, and 165 of those elements are tracked uppercase monospace. The in-app text sizes stop at 125 % (`styles.css:106–112`), and nothing hooks into iOS Larger Text. | ACC-7, VIS-4 |
| N8 | Tags are numerous, inconsistent and inert. | 153 distinct tags; 117 used only once; 7 case duplicates. "education" appears on 39 of 53 reports, so it does not distinguish anything. Tags render as inert boxes on every row (`app.js:125`). | DIS-6 |
| N9 | Personal reading state shows up as noise, not as a picture of progress. | A first-time visitor sees "Unread" 53 times (`app.js:126`). Progress appears as raw percentages instead of time left. Records have no timestamps (`app.js:57`), so "revised since you read it" cannot be shown. The only summary is the sentence "1 reports marked read". | DAT-6, REA-2 |
| N10 | The Settings and Method layouts have defects. | Settings has inverted spacing (`styles.css:1767`), and `<dd>` keeps the browser's 40 px indent. Method has two alignment axes (header at x = 80, body at x = 396) and an empty sixth grid tile. "1 reports marked read" (`app.js:200`). | VIS-3, DIS-5 |

### Polish

| ID | Finding | Evidence |
|---|---|---|
| P1 | Numbers and dates are formatted inconsistently. | "3009" in the statistics (`app.js:137`), but "2,849 words" in reports (`app.js:163`). "Updated 11 Nov 2026" is set as a 41.6 px statistic. Dates in the row metadata wrap onto two lines. |
| P2 | External links carry a doubled ↗. | `app.js:29` adds one arrow and `styles.css:1578` another. The accessible name includes the arrow, and opening in a new tab is not announced. |
| P3 | Separators and sticky surfaces are rough. | "10 min read Unread In queue ✓" runs on without separators. The translucent sticky toolbar shows "53 of 53 reports" through its bottom rule. The empty `#settings-status` still draws the A/B dot pair (`styles.css:505–512`). |
| P4 | Print output includes personal controls. | Printed reports include "← Back to the index" and "Your reading progress 0%". |
| P5 | Category labels change case. | The filter shows "Open Source" (`app.js:117`), while rows show "Open source". |

---

## 4. What to keep

| Keep | Why |
|---|---|
| The concept: two reviewers as the two ends of a baseline. A is a filled point and B an open ring; their panels have a solid or a dashed band (`DESIGN.md:18–22`). | Shape as well as colour tells the reviewers apart, so the distinction survives Red mode, forced colours and colour blindness. It is the only distinctive idea in the product. Make it the data, not the decoration. |
| The long-form reading column: 19 px serif at 1.68 line height, a measure of about 36em (about 70 characters), old-style figures in prose, hanging punctuation, balanced headings and pretty wrapping (`styles.css:1352–1359`). | It is the best-made part of the site, and `text-wrap: balance/pretty` costs nothing measurable. |
| The report content model: the practical judgment (on all 53 reports), use cases, limits, ten written reasons per report, review qualifications, content hashes, and a bibliography with "supports" and "locator" lines. | It is the raw material for a verdict-first design, and nothing new has to be invented. |
| Honest provenance: limitation lists, "documentation review only" notices, bounded-coverage notes, "not a benchmark" statements, and missing access recorded as missing. | It is a rare trust asset. Move it closer to the reports; do not delete it. |
| The Method content: the rubric anchors (1 little, 5 moderate, 10 exceptional) and the rule that report depth follows impact (about 1,000, 2,000 or 3,000 words). | Both can be shown directly as visuals. |
| Local-first, private reading data with validated export and import, no cookies and no third-party requests. | It is a core promise, and the site already meets it. |
| Small, dependency-free code: `app.js` is 14.2 KB gzip, `styles.css` 15.9 KB gzip, there are no leaks, and the heap is stable at about 4.8 MB. | It is a good base for a static site. JSON parsing is cheap, so transfer is the only bottleneck. |
| Native elements: `<dialog>` (focus is kept inside and returns to the opener), `<details>`, labelled selects, a skip link, landmarks and polite announcements. | They behave correctly; build on them rather than replacing them. |
| One `--focus` token behind every outline, and a whole-row outline for rows that link as a whole. | It is consistent and visible. |
| Deep links for reports, sections and ratings (`#report/<id>/<anchor>`), which land below the sticky masthead. The index scroll position is restored on return, and filters persist for the session. | These are required features, and they work. |
| Token-based themes with a named red night mode, and the script that applies saved preferences before first paint (`index.html:14–22`). | Fix Red; do not drop it. Make the pre-paint script the only place where preferences are applied. |
| Container queries in em units and a text-size setting that reflows the layout. Pinch zoom is allowed, and the WCAG 1.4.12 text-spacing override causes no clipping. | Layouts already respond to text size, not only to screen width. |
| Data tables with zebra rows, scroll shadows and tabular figures. | They are clean. Drop the uppercase monospace headers in the new type system. |
| A print stylesheet that prints source URLs. | It is useful for teachers. |
| The build pipeline: an atomic swap of `dist/`, tests, a sanitizer allowlist mirrored in the app, links limited to http(s), `.woff2` files already copied (`scripts/observatory.py:651`), and per-report hashes in `manifest.json`. | It supports a self-hosted font and content-hashed report files without new tooling. |
| Keyboard basics: "/", Cmd/Ctrl+K, and Escape to clear the search. | Keep them, add a way to switch single-key shortcuts off, and add a shortcut overview. |
| The graticule artwork and the deep colophon band. | Use them once as a signature moment, not as wallpaper in six places. |

---

## 5. Where the audits disagreed, and the ruling

| # | Topic | Claims | What the check found | Ruling |
|---|---|---|---|---|
| R1 | Reduced motion | **Visual:** the last CSS block overrides the user's "allow" choice, contrary to `DESIGN.md:83–84`. **Accessibility:** reduced motion is respected in all four combinations of device and site setting. | The value `allow` is labelled "Follow device preference" in Settings (`app.js:199`), and the comment above `styles.css:2219` says the block exists to make that label true. `DESIGN.md` is out of date. | **Accessibility** is right about the behaviour, and **visual** is right that the documents disagree. Model the preference as "Follow device" (default) or "Reduce", stop writing a default, and update `DESIGN.md`. |
| R2 | How dark Red mode should be | **Visual:** text at a relative luminance of about 0.05–0.1. **Accessibility:** body text #ff2a1a (5.42:1). | On #0a0404 any text below a relative luminance of about 0.18 fails 4.5:1; at 0.10 contrast is about 2.9:1. Pure #ff0000 reaches 5.09:1. | **Accessibility** is right. Dark adaptation is protected by spectral purity (green and blue channels near zero) and a small lit area (no large fills), not by text below the AA minimum. A dimmer step is acceptable only as an explicit choice combined with large text, where 3:1 applies. |
| R3 | Which reports belong to which edition | **Interaction:** derive them from `discoveredAt` within each scan window. **Storytelling:** do not infer them. | Bucketing by `discoveredAt` gives 9, 13, 7, 5, 2, 5, 3, 2, 3 and 4 reports per run, while the library grew by 6, 5, 6, 7, 7, 7, 5, 3, 3 and 4. | **Storytelling** is right: the inference would publish wrong facts, which breaks the "no fabricated data" rule. Use the recorded `newReportIds` and `updatedReportIds`, which exist for the last two runs but are dropped at `scripts/observatory.py:638`. For older editions, show only "library grew by N". |
| R4 | Glyph form | **Storytelling:** a radial plate with five spokes in report headers. **Visual, interaction, accessibility:** linear dot plots. | The radial sketch shows distinct shapes for reports with the same 5.8 overall, but the shapes depend on the order of the axes and invite comparing areas, which the storytelling audit itself warns against [E7]. | **Linear** encodings for all reading and comparison: aligned scales can be scanned down a list, compared precisely and mapped to a table for assistive technology, and they match the baseline metaphor. A radial silhouette may appear only as a secondary identity mark, for example on share cards, always with numbers. |
| R5 | Touch target size | **Accessibility:** no failures. **Interaction:** many targets under 44 pt. | The site passes WCAG 2.5.8 (24 px minimum) and misses Apple's 44 pt guideline. | Both are right. For this ambition, adopt 44 pt. |
| R6 | Size of `data.json` | **Brief:** 3.35 MB compact. **Interaction and performance:** 3.89 MB. | The file is 3,892,460 B on disk because of `indent=2`, would be 3,346,821 B compact, and is served as about 680–700 KB gzip. | Both are right. Compacting alone saves 14 %; the split (PER-1) is what matters. |
| R7 | Counts of broken Red-mode buttons and unstyled classes | **Red buttons:** 62 (accessibility) or 64 of 66 (performance). **Unstyled classes:** 19 of 70 (interaction) or 26 (performance). | In each case the root cause is the same; the audits counted different views or used different methods. | No conflict. |
| R8 | Fonts | **Performance:** system fonts cost no bytes and cause no swap. **Visual (and a performance idea):** self-host one serif. | Today the reading voice depends on the platform: Iowan on Apple, Palatino on Windows, a generic serif on Android. The build already copies `.woff2` files. | Self-host one variable serif subset (at most about 120 KB, cached) with a fallback whose metrics match, and keep the system UI sans. Visual consistency is worth the one-time cost. |
| R9 | Tab stops per row | **Interaction:** one stop per row, with shortcuts for actions. **Accessibility:** keep real buttons with stable names. | Paging limits the total number of stops in any case. | Keep real buttons and use two stops per row (the title link and Save), folding the score link into the row link. Add j/k as optional shortcuts with an off switch (WCAG 2.1.4). |
| R10 | Phone navigation | **Interaction:** a permanent bottom tab bar. | Safari on iPhone puts its own toolbar at the bottom, so a fixed tab bar would stack on top of it and take reading height. | Use a collapsing top bar, plus a bottom bar on report pages only that hides while scrolling down and respects the safe area. Library, Reading list and About stay in the top bar and the palette. |
| R11 | The scan schedule in Settings | **Interaction:** remove it. **Visual:** demote it to a note. | `PRODUCT.md:9` requires the site to "accurately distinguish scheduler configuration from browser preferences". | Keep a factual public schedule line ("next edition expected after …") under About and Editions. Show the localhost control only when the site is served from localhost. |
| R12 | Short display headlines ("Look closer.") | **Visual:** a template habit. **Storytelling:** keep them as headings. | Every page repeats the same pattern. | Use plain titles that name each page (Library, Reading list, Sources) and put the voice in one supporting line. Keep one signature line on the front page only. |
| R13 | Placement of the library map | **Storytelling:** above the index. **Visual and interaction:** reports must appear above the fold. | Principle 4. | Make the map a view mode (list or map), not a block above the list. |
| R14 | Icons for a "manifest.json" | **Visual idea:** add icon variants "for the existing manifest.json". | `dist/manifest.json` is the build's integrity manifest (report hashes), not a web app manifest. | A web app manifest and touch icons would be new files. |
| R15 | Share cards for each report | **Visual idea:** generate an Open Graph card per report at build time. | Link-preview crawlers cannot see hash routes (`#report/<id>`). | Share cards for individual reports depend on pre-rendered report URLs (PER-9). |

---

## 6. Improvement backlog

Effort, for one developer who knows the code: **S** = up to 1 day, **M** = 2–5 days, **L** = 1–3 weeks. The fix columns refer to the finding IDs in section 3.

Under `DATA_CONTRACT.md:27`, data and the build belong to the backend, while `src/` and `DESIGN.md` belong to the front end. Items marked *(build)* need changes to `scripts/observatory.py`, its tests and `DATA_CONTRACT.md`. The `git status` taken at the start of this audit showed uncommitted changes to `scripts/observatory.py`, `tests/test_observatory.py` and `DATA_CONTRACT.md`, so coordinate with that work.

### 6.1 Identity and visual language

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| VIS-1 | **New art direction: "observing instrument".** Replace the paper, serif and monospace template. Use graticule geometry as structure (scales, axes and rules inside the glyph and the charts), not as watermarks, with one graticule moment on the front page or the loading screen. Retire the sparkle, the uppercase monospace labels, the coloured split and the scroll drift. Colour roles: A and B only for reviewer data, one interaction colour for links, focus and controls, and quiet neutral keys for categories. Three surface levels per theme. | High | L | C8 | VIS-2, VIS-4, DAT-1 |
| VIS-2 | **Tokens in cascade layers.** Use `@layer reset, tokens, base, components, views, themes, utilities` and `:where()` to keep specificity flat. Themes only redefine tokens, including control colours for every state (default, hover, pressed, disabled, focus). Keep one source of dark tokens (`light-dark()`), and remove the 20 `!important` declarations, the duplicate grids and the extra motion blocks. | High | M | C1, M2 | none |
| VIS-3 | **Component contract, specimen page and drift test.** Document the class and attribute hooks for each view in `DESIGN.md`. Add a development-only specimen page that renders every component in every theme and text size. Add a standard-library unit test that compares the hooks emitted by `app.js` and `index.html` with the selectors in `styles.css` and fails on dead or unstyled hooks. | High | S | M1, N10 | none |
| VIS-4 | **Type system.** About 7 text steps plus 2 display sizes as tokens. Self-host one OFL variable serif with an optical-size axis, such as Source Serif 4 (already named in `DESIGN.md`), Newsreader or Literata: Latin subset, roman and italic, at most about 120 KB of WOFF2, preloaded, with a fallback whose metrics match. Use the system UI sans for the interface and monospace only for code, hashes and IDs. Use tabular lining numerals for data and old-style figures only in prose. One label style in sentence case at 13 px or more. | High | M | M2, N7 | VIS-2 |
| VIS-5 | **Redraw the mark and add icons.** Draw the mark around a solid baseline: a filled A and a ring B, with sight lines to a visibly displaced near point. No dashes and no sparkle; legible at 16 px; a plate with continuous corners; light and dark variants. Add a web app manifest with PNG, maskable and Apple touch icons (new files). | Medium | S | N1 | VIS-1 |
| VIS-6 | **Icons and shapes.** One inline SVG sprite with a consistent stroke, custom disclosure chevrons, 3 radius tokens, and one button family (primary, secondary, quiet) that uses the state tokens. | Medium | S | N2 | VIS-2 |
| VIS-7 | **Motion that explains change.** Use View Transitions from a row to the report header, as progressive enhancement. When ratings come into view, A and B converge and "resolve" in 300 ms or less. A saved item moves to the reading-list badge, and filter changes reflow smoothly. Under reduced motion, use crossfades or nothing. Drop the scroll drift and the split. Motion setting: "Follow device" (default) or "Reduce". Update `DESIGN.md`. | Medium | M | N3, C8 | PER-3 |
| VIS-8 | **Share cards.** An Open Graph image for each report (title plus glyph), generated at build time. | Low | M | none | PER-9 *(build)* |

### 6.2 Discovery

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| DIS-1 | **A front page that shows reports immediately.** One sentence stating the purpose and the method, then search, then a group titled "This edition · 11 Nov · 4 new, 1 revised" with each report's glyph and the first clause of its judgment, then the library. Use honest counts: 53 reports, about 300 cited sources, 200 publishers watched. The first title starts at 300 px or less on desktop and 400 px or less on phone. | High | M | C5, M4 | DAT-1, DAT-4 |
| DIS-2 | **Rows built for thousands of reports.** Two densities: "Scan", about 56 px per row (glyph, title, category, minutes, reading state), and "Rich", about 120 px (adds the first clause of the judgment). Sticky edition headers. Pages or windowing with 30–50 rows and a "Show more" sentinel. Two tab stops per row. Reading state appears only when it exists. | High | M | C5, N5 | PER-3, DAT-1 |
| DIS-3 | **Filters as chips with live counts.** Chips for Category, Topic, Ratings (overall and per-dimension thresholds built from the data, for example "Openness ≥ 6 (27)"), Reading state, and Sort (Latest, Highest overall, Highest by dimension, Title). Options that would return nothing are disabled. Active filters appear as removable tokens with "Clear all", and the state is mirrored in the hash (for example `#index?cat=models&open=6`). Empty states propose the nearest relaxation and state facts: "No report has reached 8 overall; the highest is 7.8." | High | M | M5 | none |
| DIS-4 | **One ranked search for the index field and Cmd/Ctrl+K.** It matches words in any order, matches prefixes, and applies light stemming and a small list of synonyms (TTS and "text to speech"). Results are ranked by field weight: title, then entity, tags, summary, headings. Results are grouped: Continue reading, Pages, Reports, Topics, Actions. Commands cover the theme (including Red), text size, opening the reading list, saving or marking the current report, and copying a link to the current section. The list is a fixed scroll container, and the input is an accessible combobox. | High | M | M5, M6 | PER-3 |
| DIS-5 | **Information architecture.** Main destinations: Library, Reading list, and About (with Method, Editions and Sources). Category and topic shelves with counts, and a "Highest usefulness" shelf. Settings becomes "Reading preferences" plus "Your data". The localhost control appears only on localhost. Every hash route in `DATA_CONTRACT.md:27` keeps working. | High | M | M3, N10 | DIS-1 |
| DIS-6 | **Tags become facets.** Fold case at build time. Promote a small controlled set of facets (modality, deployment, licence) to filters and topic pages. Make tags real links, and drop near-universal tags from rows. | Medium | S | N8 | *(build)* for case folding; it can start in the browser |
| DIS-7 | **Library map as a view mode.** A scatter of openness against impact: 37 distinct positions for 53 reports, with at most 3 per cell. Add an axis picker, brushing that filters the list, keyboard navigation, a table fallback, and hexagonal binning at scale. Captions use the rubric's words and never say "best". | Medium | M | C4 | DAT-1 |
| DIS-8 | **One date vocabulary.** "Released" for the vendor's date; "Added" and "Revised" for Parallax. Each row shows the date the list is sorted by. Revised reports get a marker with a one-line note from recorded data. A true "added to the library" date needs the build to record one. | Medium | S | M17, P1 | *(build)* for the library date |

### 6.3 Reading

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| REA-1 | **Verdict-first report header ("At a glance").** The header holds: (1) the judgment as an italic serif standfirst, at most 34em wide; (2) the overall score with the reviewer range ("5.6 · reviewers 5.4 and 5.8"); (3) the five-dimension glyph; (4) an agreement line ("Agreed on 3 of 5; split by one on impact and openness"); (5) "Good for" (use cases) and "Watch out for" (limitations); (6) rule-based callouts whose thresholds are published on Method ("Openness 2.5 · restricted"); (7) the depth tier; (8) the dates; and (9) Save or Continue reading. Every block gets an `id`. | High | M | C3 | DAT-1 |
| REA-2 | **Trustworthy reading state.** Track progress over the prose sections with an IntersectionObserver, store a resume anchor (section and paragraph), and ignore jumps caused by links. Reset progress on unmark. Show "Finished? Mark as read" when the reader reaches the judgment. Schema v2 stores `{queued, savedAt, read, readAt, readVersion, progress, anchor}`, with a migration from v1; import accepts both v1 and v2. | High | M | C2, N9 | PER-2 |
| REA-3 | **Navigation inside reports.** One numbered list for the contents and the body that covers every `h2` with the same labels. Mark the current section with `aria-current="location"`. Use `history.replaceState` for jumps within a report. Back behaves like Back. Focus returns to the row the reader came from. The sidebar spans one row. Each report ends with "Up next" (from the reading list) and "Related" (same category or topics). | High | M | M8 | none |
| REA-4 | **Reading layout.** Centre the prose in a grid, with a margin column on wide screens for sidenotes (source locators, definitions) instead of the empty 308 px gutter. Put tables in labelled scroll regions with caption and `scope`. Fix the spacing of the first section. Restore the drop cap or drop it on purpose. | Medium | M | M1, M11 | ACC-6 |
| REA-5 | **Phone reading mode.** The top bar collapses while scrolling down and returns while scrolling up. Report pages get a bottom reading bar (Contents sheet with the current section, Aa, Save) that respects the safe area and hides while scrolling down. The text starts on the first screen. Sheets have height stops. Every target is at least 44 pt. | High | M | M9 | REA-3, ACC-8 |
| REA-6 | **One reading list.** A sheet, plus the `#queue` route, with three sections: "Continue reading", "Up next" (saved order, reorderable by drag and by keyboard) and "Finished". Removal is an explicit action with an Undo toast, and focus moves to the next item. Show the time left instead of percentages. Export and import move to Settings → "Your data". | Medium | M | M7, N9 | REA-2 |
| REA-7 | **Aa popover.** Appearance (Automatic, Day, Night, Red) as live swatch radios, text size from S to XXL shown at its own size, and motion. It can be opened from the reading bar, the masthead and the palette. Settings shows the same controls. | Medium | S | N5, M1 | ACC-2 |

### 6.4 Data storytelling

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| DAT-1 | **The "sighting" glyph family (signature).** The list version is about 64×24 px: five fixed columns in rubric order (usefulness, impact, novelty, maturity, openness), each a 1–10 scale with a faint tick at 5, and the mean drawn as a bar. A filled dot (A) and a ring (B) appear only where the reviewers split, joined by a hairline; elsewhere they show as one resolved mark. The header version is about 160 px wide with labels. It is drawn as inline SVG from the existing integers. Its accessible name lists the values and the agreement. Shape and position carry A and B, not hue, so the glyph works in Red mode and in forced colours. | High | M | C4, C8 | none |
| DAT-2 | **Ratings as five dimension rows.** Each row has a shared 1–10 axis with A (filled point), B (ring), a mean tick, and the middle half of the library as a band. The rubric line becomes a tooltip or a link to Method. Expanding a row shows A's and B's reasons side by side. Confidence appears as a chip. "Both reviewers approved" is stated once. The hashes move into "Fingerprints (for auditors)". A captioned table is the source of truth. | High | M | C4, M13 | DAT-1 |
| DAT-3 | **Honest numbers.** Show ties as joint ranks with a stated tie-break (the date). Show the reviewer range next to every overall score and the library context for each dimension. The Method page shows the agreement facts (212 of 265 identical, 53 split by one, none by two, novelty the most contested, no 10 so far) and the dimension strips. Format every count with `Intl.NumberFormat`. | Medium | S | C4, P1 | DAT-1 |
| DAT-4 | **Editions as an observing log** *(build)*. Each edition shows "+4 new, +1 revised · library 53" and links its reports, using only recorded IDs; whitelist `newReportIds`, `updatedReportIds` and compact `sourceResults` counts in `build()`. Older editions show "library grew by N". Small multiples on a date axis show new reports, leads assessed, sources reached and sources failed. Annotate anomalies, such as the 64 failures on 11 Nov and the gap from 2 to 8 Nov. A coverage strip per edition shows each watched publisher as complete, partial, feed or failed. Limitations are collapsed and grouped with counts. | Medium | M | M16 | ruling R3 |
| DAT-5 | **Sources as instruments and citations.** An overview bar shows 725 reached, 2,282 unverified leads and 2 blocked. The default list shows the 200 watched publishers grouped by kind, with status glyphs (shape plus text) and the last check. Evidence pages are nested under their publisher via `discoveredFrom`. Cited records link back to the reports that cite them ("Cited in …"). Every bibliography entry shows its ledger status, which exposes the 13 mismatches. Leads sit behind a toggle, paged and sorted by recency. | High | L | C7, M3 | PER-1, PER-4 |
| DAT-6 | **Personal reading summary (local only).** "2 of 53 read · 23 of 465 minutes", a "Continue reading" card, and a "Revised since you read it" badge (which needs `readVersion`). The reading-list page shows personal statistics instead of library statistics. | Medium | M | N9 | REA-2 |
| DAT-7 | **A plain-language vocabulary sheet.** Replace "independent" with "two separate, blind reviews by the same model", "Baseline study" with "Profile (not a new release)", "Published" with "Released", "recurring entrypoints" with "publishers watched", "checked / surfaced" with "sources reached", "candidates" with "leads assessed" and "Evidence page" with "single article". Give each destination one name ("Ratings"). Show categories exactly as the data spells them. | Medium | S | M4, P5 | none |

### 6.5 Accessibility and inclusivity

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| ACC-1 | **Contrast and state token matrix with a CI gate.** Each theme defines tokens for text, controls (foreground, background and border for default, hover, pressed, disabled and focus), selection and rules. A pure-Python test parses the theme blocks, composites alpha over the page colour and asserts text ≥ 4.5:1 and control boundaries, focus and reviewer marks ≥ 3:1. | High | S | C1, M15 | VIS-2 |
| ACC-2 | **Appearance that follows the device.** "Automatic" is the default, set from `prefers-color-scheme` by the pre-paint script only, and the page never writes preferences after it loads. Listen to `matchMedia` changes. For `prefers-contrast: more`: rules at 3:1 or more, 2 px borders and underlined links. For `prefers-reduced-transparency`: opaque bars. For forced colours: Highlight outlines for focus and the palette selection, native select styling, and `progress { appearance:auto }`. Keep `theme-color` in sync. | High | M | M14, M15 | VIS-2 |
| ACC-3 | **A true night-vision Red mode.** A red-only palette: body text about #ff2a1a (5.4:1), secondary text about #e62a1a (4.6:1), and every token's green channel at about 45 or less and blue at about 30 or less. Outline-only controls and no large fills. Links marked by underline and weight. A 3 px red focus ring, dimmed images and `theme-color` #0a0404. An optional dimmer step only together with L or XL text. | Medium | S | C1 | ACC-1 |
| ACC-4 | **A list and ratings that screen readers can follow.** Render the index as an `<ol>` of `<li><article aria-labelledby>` with the heading first in the DOM. Toggles keep stable names, use `aria-pressed` and point to the report title with `aria-describedby`. The score link's name starts with its visible text. The queue button is named "Reading list, 3 saved". Ratings are a captioned table. The click overlay covers only the title, so summaries can be selected. | High | S | M13 | none |
| ACC-5 | **Focus choreography and a keyboard layer.** On first load the skip link is the first stop. Later route changes focus the `h1` and announce the page once. Focus returns to the row the reader came from, and after a removal it moves to the next item. Import becomes a real button. Each message goes to one live region, and the result count is announced only after typing pauses. The `scroll-padding-top` matches the measured height of the sticky bars. A "?" sheet lists shortcuts (j/k, s, m, [ and ], t), and single-key shortcuts can be switched off. | High | S | M12, N5 | none |
| ACC-6 | **Components that reflow.** Remove the root overflow clip. Wrap tables in a labelled, focusable `.table-wrap` region. Allow `caption` and `scope` in both sanitizers (`app.js` and `scripts/observatory.py`). Use `minmax(0,1fr)` and `overflow-wrap:anywhere` for hashes. The navigation wraps at XL text. The masthead is not sticky on viewports shorter than about 480 px. Add reflow checks at 320×256, at 320 px with XL text, and at 390 px with medium text. | High | S | M11, M10 | *(build)* for `caption` |
| ACC-7 | **A minimum text size and Dynamic Type.** A 13 px floor, and sentence case below 14 px. Text sizes S 90 %, M 100 %, L 118 %, XL 137 % and XXL 162 %. Opt in to iOS text size with `@supports (font: -apple-system-body)`. Layouts recompose at XL: single-column header, wrapping navigation. | Medium | S | N7 | VIS-4 |
| ACC-8 | **44 pt hit areas.** Every button, summary, navigation link, contents link and back link has a hit area of at least 44 pt. Where the visual must stay compact, an inset `::before` extends the hit area. | Medium | S | M9 | none |

### 6.6 Performance and architecture

| ID | Improvement | Impact | Effort | Fixes | Depends on |
|---|---|---|---|---|---|
| PER-1 | **Split the data contract** *(build)*. Files:<br>• `catalog.json`: card fields, A/B integers and a file reference; about 14 KB gzip today.<br>• `reports/<id>.<sha10>.json`: one file per report, 6–13 KB gzip each.<br>• `sources-monitored.json` (about 16 KB gzip), with `sources.json` (about 217 KB gzip) loaded on demand.<br>• `runs.json` (about 67 KB gzip), loaded on demand.<br>Write all files without whitespace. Keep `data.json` for one or two releases, add a map of files to `manifest.json`, and update the tests and the dist section of `DATA_CONTRACT.md`. Shard the catalogue (recent reports plus one file per year) before about 1,000 reports; it is projected at about 768 KB gzip for 3,000. | High | M | C6 | PER-2 |
| PER-2 | **Preserve unknown reading IDs.** Validate only the shape of each record. Store records for unknown IDs untouched and ignore them in the UI. Add a unit test that an unknown ID survives load and save. | High | S | M19 | none |
| PER-3 | **A new rendering model.** Keyed row nodes (a map from report ID to element). Search text precomputed once, input debounced by about 150 ms, sorting with `Intl.Collator` and only when the sort changes. Windowing or pages of 30–50 rows. Toggles patch only the controls for that report. The index (and the current report) stay mounted. Render, yield one frame, then scroll and move focus. `content-visibility:auto` on rows. Separate filter state per route. | High | M | C5, M18 | none |
| PER-4 | **Fix the cost of the ledger.** Never render the full ledger. Use no size container around unbounded lists, or set `summary{display:block}`. Render a record's provenance only when it is opened. Debounce the search. | High | S | C7 | none |
| PER-5 | **Versioned assets and caching** *(build)*. Put a build ID and schema version in `catalog.json`. Asset URLs carry a content hash (`app.js?v=…`), and report files have content-hashed names, which makes them immutable by URL. Only `catalog.json` is fetched with no-cache. If a report file returns 404, fetch the catalogue again and retry. | Medium | S | M20 | PER-1 |
| PER-6 | **Reading instruments with no layout cost.** The reading bar uses a CSS scroll-driven animation of `transform: scaleX`, with a JS fallback. An IntersectionObserver drives the contents marker and progress. Element references are cached, and labels are written only when they change. | Medium | S | N6 | none |
| PER-7 | **Loading and error states.** Show a skeleton of the target view, with the title taken from the slug in the hash. Reserve space while loading (`aria-busy`). Header actions are shown as busy until data arrives, or their action is queued. Error and 404 pages carry the brand and have an `h1`, a search field and suggestions (fuzzy-matched from the slug). Preload the catalogue. | Medium | S | N4 | PER-1 |
| PER-8 | **An offline reading room.** A same-origin service worker caches the app shell and the catalogue (serving the cached copy while it revalidates), plus every report that has been opened or saved, so saving a report also makes it available offline. | Medium | M | none | PER-1, PER-5 |
| PER-9 | **Static-first build** *(build)*. Pre-render `index.html` with the first rows, and `reports/<id>/index.html` for each report from the same sanitized HTML; JavaScript adds the interactive features on top. This gives real URLs, with the hash routes redirecting, link previews and reading without JavaScript. | High | L | C6 | PER-1 |
| PER-10 | **CI gates.** A performance budget: index painted in 1.2 s or less on the 4G profile, keystrokes in 50 ms or less with 3,000 reports, the ledger route in 200 ms or less, and no layout on scroll frames. Add the contrast (ACC-1), reflow (ACC-6) and drift (VIS-3) checks, with Playwright as a development-only dependency and a synthetic fixture of 3,000 reports. | Medium | M | none | none |

### 6.7 Suggested order of work

1. **Foundations, which make the rework safe and fast.**
   - VIS-2 token layers, VIS-3 drift test, ACC-1 contrast gate.
   - PER-2, then PER-1 (with the backend), PER-3 and PER-4.
   - REA-2 reading state, ACC-2 appearance, ACC-6 reflow, ACC-5 focus.

   These items eliminate most of the must-fix list in section 7.
2. **The signature.**
   - VIS-1 art direction and VIS-4 type.
   - DAT-1 glyph and DAT-2 ratings rows.
   - REA-1 verdict-first header, REA-3 report navigation, REA-4 reading layout, DAT-7 vocabulary.
3. **Discovery at scale.**
   - DIS-1 front page, DIS-2 rows, DIS-3 filters, DIS-4 search and palette, DIS-5 information architecture.
   - REA-6 reading list, REA-5 phone reading mode, REA-7 Aa popover, ACC-3 Red mode, ACC-4 list semantics, ACC-7, ACC-8.
4. **Provenance and finish.**
   - DAT-4 editions, DAT-5 sources, DAT-3 honest numbers, DAT-6 personal summary.
   - VIS-7 motion, VIS-5 mark, VIS-6 icons, DIS-6 tags, DIS-7 map, DIS-8 dates.
   - PER-5 to PER-7, then PER-8, PER-9, VIS-8 and PER-10.

---

## 7. Must-fix checklist (acceptance criteria for any redesign)

| # | Defect | Evidence | Done when |
|---|---|---|---|
| 1 | Red-mode button labels are invisible. | `styles.css:2115`; [E8][E9] | Every control in every theme and state measures ≥ 4.5:1 for text and ≥ 3:1 for its boundary, and a test checks this. |
| 2 | Reading progress is corrupted. | `app.js:297–311`, `127`, `164`, `323` | Following a score link or a contents link leaves progress unchanged. Unmarking resets progress. The percentage measures prose only. |
| 3 | Reading data for unknown IDs is deleted. | `app.js:60–72`, `359`, `367` | A record with an unknown ID survives load and save. |
| 4 | Device dark mode is overridden after load. | `app.js:210–212`, `368`; [E18] | No `data-theme` is written unless the reader chose one. Automatic is the default, and nothing flashes. |
| 5 | One 3.9 MB file gates every page. | `app.js:362`; `scripts/observatory.py:68`; [E29] | The first useful paint needs about 25 KB gzip or less, and a report deep link fetches only the catalogue and that report. |
| 6 | Sources renders all 3,009 records, and its first row is offensive. | `app.js:184–189`, `186`; `styles.css:432`; [E13][E30] | The route renders fewer than 100 rows and finishes in under 200 ms at 4× CPU slowdown, and the default view shows watched publishers or cited sources, not raw leads. |
| 7 | The verdict sits 69–81 % down each report. | `app.js:163–170`; [E4] | The judgment, the rating glyph and reviewer agreement are on the first screen at 390×844. |
| 8 | The rating is a single decimal that hides openness and agreement. | `app.js:127`, `156`; `DATA_CONTRACT.md:25`; [E5][E7] | Every rating display shows all five dimensions and the A/B readings. |
| 9 | No report is visible on the first screen of the index. | [E1][E2]; [E26] | The first title starts at y ≤ 300 px on desktop and y ≤ 400 px on phone. |
| 10 | Content is clipped at small widths. | `styles.css:142`, `2204`, `1513`; `app.js:100–107`; [E16][E41] | Nothing is cut off at 320×256, at 320 px with XL text, or at 390 px with medium text. Tables scroll inside labelled regions. |
| 11 | Focus is lost, invisible or hidden. | `app.js:96/236`, `200`, `295`, `319–321`; `styles.css:121`; [E17] | After a removal, focus moves to the next item. Import shows focus. The skip link is the first Tab stop. No focused element sits under the sticky bars. |
| 12 | The palette list does not scroll, its text runs together, and pages come last. | `styles.css:1947`; `app.js:247`, `252`; [E11][E12][E36] | All results can be reached, the field stays visible, title and detail are separate, and a matching page comes first. |
| 13 | The masthead breaks at 780–1040 px and at 320 px with XL text. | `styles.css:267`, `386`, `405`; [E15][E40] | A continuous sweep from 320 to 1440 px shows no wrapping or clipping. |
| 14 | Markup and CSS have drifted apart. | [E33]; `app.js:163`, `188`, `199`, `236`, `252` | The drift test passes with zero dead or unstyled hooks. |
| 15 | The contents numbering does not match the body, and there is no current-section marker. | `app.js:164`, `167–172`; `styles.css:1335`; [E37][E38] | The contents and the body use one numbered list covering every `h2`, and `aria-current` follows the scroll position. |
| 16 | Editions mislabel the library size and open a 196-line log. | `app.js:192`; [E14] | The edition count reads as new and revised reports plus the library size, and limitations start collapsed and grouped. |
| 17 | Filters offer options that can never match, and empty states offer no way out. | `app.js:140`, `152`; [E22] | Filter options are built from the data with counts, and every empty state has a recovery action. |
| 18 | Rows show a different date from the one they are sorted by. | `app.js:123` against `132` | The visible date matches the sort key and is labelled for what it records. |
| 19 | A localhost button is the primary action on the public Settings page. | `app.js:198`; [E35] | The local control appears only when the site is served from localhost. |
| 20 | Control borders measure 1.65–2.08:1, and the B ring 2.82:1. | `styles.css:22`, `79`, `95`; [E42] | Boundaries and reviewer marks reach ≥ 3:1 in every theme. |
| 21 | Copy calls the reviews "independent" and contradicts the method. | `app.js:136`, `170`, `195`; `index.html:89` | One phrase is used everywhere: two separate, blind reviews by the same model. |
| 22 | Screen readers get unstable toggle names and a score link whose name does not match its label. | `app.js:85`, `90`, `116`, `127` | Toggle names stay stable while `aria-pressed` changes, and every accessible name starts with the visible text. |
| 23 | Forced colours lose input focus and the palette selection. | `styles.css:707–714`; [E19] | Focus and the selection use outlines in Highlight. |
| 24 | Reports end in about 1,368 px of empty scroll. | `styles.css:1267`; [E20] | The sidebar spans one row, and the report ends with what to read next. |

---

## 8. Constraints and feature map

**Hard constraints, and how the backlog respects them**

| Constraint | How the backlog respects it |
|---|---|
| Static GitHub Pages | Every item produces static files. The split (PER-1) and pre-rendering (PER-9) are generated by `scripts/observatory.py`. |
| No third-party scripts, trackers, CDNs or remote fonts | The font is self-hosted under `src/assets`, which the build already copies (`scripts/observatory.py:651`). Playwright is a development-only dependency in CI and is never shipped. |
| No fabricated data or ratings | Glyphs, bands, agreement lines and map positions are computed from the existing integer scores. Edition membership comes only from recorded IDs (ruling R3). Callout thresholds are published editorial rules and are labelled as derived. Dates are never inferred. |
| Reading data stays in the browser | Everything stays in localStorage. The service worker caches only public files. |
| Hash routes in `DATA_CONTRACT.md:27` | `#report/<id>`, `#sources`, `#editions`, `#method`, `#settings` and `#queue` keep working, even where the navigation regroups them. |

**Features that must stay, and where they live after the rework**

| Feature | Where it lives |
|---|---|
| Search | One ranked search shared by the Library field and Cmd/Ctrl+K (DIS-4) |
| Category, score and reading filters | Chips with counts, including overall and per-dimension thresholds (DIS-3) |
| Sorting | The Sort chip: Latest, Highest overall, Highest by dimension, Title (DIS-3) |
| Reading queue | The reading list sheet plus the `#queue` route (REA-6) |
| Read marks | Stable toggles and a "Finished" section (REA-6, ACC-4) |
| Saved reading progress | Resume anchors in schema v2 (REA-2) |
| Export and import | Settings → "Your data"; v1 and v2 files accepted (REA-2) |
| Deep links | All existing routes, plus filter state in the hash; optional real URLs (PER-9) |
| Command palette (Cmd/Ctrl+K) | Upgraded with groups and commands (DIS-4) |
| Keyboard support | A shortcut sheet, with single keys that can be switched off (ACC-5) |
| Themes, including the red night mode | Automatic, Day, Night and Red (ACC-2, ACC-3) |
| Text size | S to XXL, plus Dynamic Type (ACC-7) |
| Reduced motion | "Follow device" or "Reduce" (VIS-7) |
| Print | Kept, with personal controls hidden (P4) |

---

## Appendix A. Data facts used in this audit (verified 13 November 2026)

| Fact | Value |
|---|---|
| Reports | 53: Models 20, Tools 12, Open source 8, Creative workflows 7, Research 6 |
| Change types | baseline 26, new 21, update 6 |
| Overall score | 4.0–7.8; mean 5.87; SD 0.77; 41 of 53 between 5.0 and 6.9; 22 distinct values; 14 tie groups covering 45 reports |
| Dimension ranges (mean of A and B) | usefulness 5.0–9.0 (SD 0.79); impact 3.5–8.0 (1.06); novelty 3.0–7.0 (1.04); maturity 2.5–8.0 (1.08); openness 1.5–9.0 (2.36) |
| Openness | Two groups: 24 reports at 4.0 or below, 27 at 6.0 or above, 2 in between. 17 at 3 or below, 21 at 7 or above. Correlation with the other dimensions is between −0.08 and 0.25. |
| Raw ratings | 530 in total; none is 10; novelty never exceeds 7; 83 % of usefulness ratings are 7 or 8 |
| Reviewer agreement | 212 of 265 pairs are identical, 53 differ by 1 and none by 2 or more. 22 reports agree on all five dimensions. Splits by dimension: novelty 16, impact 11, maturity 10, usefulness 8, openness 8. |
| Reviewer overall means | differ by 0.4–0.8 on 10 reports |
| Verdicts and confidence | 106 of 106 reviews approve; 76 high and 30 medium confidence; 24 reports have at least one medium |
| Practical judgment | present on all 53 reports; 108–309 characters, mean 203 |
| Length | 465 reading minutes and 97,425 words; 7 short, 44 standard and 2 long reports |
| Dates | 12 of 53 reports have no `publishedAt` |
| Tags | 153 distinct; 117 used once; 7 case duplicates; "education" on 39 of 53 reports |
| Sources | 3,009 records: 725 active, 2,282 unverified, 2 blocked. 200 watched entrypoints. About 300 records are cited by reports, and 13 cited records conflict with their ledger status. |
| Editions | 10. The library grew from 6 to 53 reports. The latest edition has 196 limitation lines (1,305 in total). 64 sources failed on 11 Nov, against 0–6 in each earlier edition. |
| `data.json` | 3,892,460 B on disk (`indent=2`), 3,346,821 B without whitespace, about 680–700 KB gzip. Without whitespace: sources 1.76 MB, entries 1.26 MB, runs 0.33 MB. |

## Appendix B. Evidence files

All paths are absolute.

| ID | Shows | Path |
|---|---|---|
| E1 | Index at 1440×900 with no report title visible | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/vp_index__desktop__plate.png` |
| E2 | Index on a phone, with the hero filling the first screen | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/vp_index__phone__plate.png` |
| E3 | Report header without a verdict, with a sans summary line and a watermark | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/vp_report__desktop__plate.png` |
| E4 | Practical judgment 69 % of the way down | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d15-practical-judgment-buried.png` |
| E5 | Ratings grid with "A 9 · B 9" as text and an empty tile | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/ratings__desktop__plate.png` |
| E6 | Reviewer A opened: a 3,232 px column | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d08-ratings-reviewerA-open.png` |
| E7 | Encoding prototypes built from real data (radial, spectrum, strips, map, editions) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/shots/sketch-encodings.png` |
| E8 | Red mode: blank buttons | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/redlight_actions__desktop.png` |
| E9 | Red mode on a phone | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/redlight-invisible-buttons__phone.png` |
| E10 | Unstyled queue sheet | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/queue_sheet__desktop__plate.png` |
| E11 | Palette title and detail running together | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/palette-glued-detail__desktop__plate.png` |
| E12 | Palette search field scrolled out of view | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/s01-palette-12th-item.png` |
| E13 | Sources, first screen | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/shots/sources-top__desktop.png` |
| E14 | Editions, first screen | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/shots/editions-top__desktop.png` |
| E15 | Masthead at 834 px | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/vp_index__tablet__plate.png` |
| E16 | Table clipped at 320 px | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/reflow-table__320__m.png` |
| E17 | Focus hidden under the sticky bars | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/kbd-focus-obscured__desktop__plate.png` |
| E18 | Device dark mode: during load | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/osdark-during-load.png` |
| E18 | Device dark mode: after load | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/osdark-after-load.png` |
| E19 | Forced colours: focused search field with no indicator | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/forced-colors-toolbar-search-focused.png` |
| E20 | Empty scroll at the end of a report | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d16-report-end.png` |
| E21 | Contents above the text on a phone | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/p04-report-toc-before-body.png` |
| E22 | "Minimum rating 8" returns no reports | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d04-filter-min8-zero.png` |
| E23 | Queue ignoring the order of saving | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d11-queue-sheet.png` |
| E24 | The mark at 16, 32 and 180 px | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/mark_sizes.png` |
| E25 | Settings page | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/full_settings__desktop__plate.png` |
| E26 | Layout measurements (positions, row heights) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/measurements.json` |
| E27 | Progress and flow measurements | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/desktop-results.json` |
| E27 | Progress and flow measurements (states) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/states-results.json` |
| E28 | Scale simulation (2,120 reports) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/scale-results.json` |
| E28 | Scale simulation (3,021 reports, 4× CPU) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/scale-x57-cpu4.log` |
| E29 | Load timings today | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/load-current.log` |
| E29 | Load timings with a catalogue-only file | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/load-catalog-only.log` |
| E29 | File sizes after a split | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/split-sizes.txt` |
| E30 | A/B test of the ledger's root cause | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/ab-sources.log` |
| E31 | Citation and ledger mismatches; first rows of the ledger | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/stats4.txt` |
| E32 | Hero type and the sparkle label | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/hero_type_2x.png` |
| E33 | Runtime CSS coverage | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/css-coverage-unused.txt` |
| E33 | Static scan of CSS against markup | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/performance/css_vs_markup.txt` |
| E34 | One row: three families in ten styles | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/row1__desktop__plate.png` |
| E35 | Settings opening with the scanner controls | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d13-settings.png` |
| E36 | Palette showing 6 of 12 results | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d09-palette-empty-query.png` |
| E37 | Contents item "08" landing on body section "10" | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d07-ratings-deeplink.png` |
| E38 | No current-section marker | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d06-report-mid-toc-no-current.png` |
| E39 | Navigation overflowing at XL text on a phone | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/x02-xl-text-phone-index.png` |
| E40 | Masthead at 320 px with XL text | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/masthead__320__xl.png` |
| E41 | Review text clipped at 390 px | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/shots/reflow-review-open__390__m.png` |
| E42 | Contrast measurements | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/accessibility/contrast.json` |
| E43 | Rating statistics and position probes | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/stats.txt` |
| E43 | Rating statistics and position probes (positions) | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/storytelling/probe-results.json` |
| E44 | Rows on a phone | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/visual/shots/vp_index_rows__phone__plate.png` |
| E45 | Missing-report page | `/private/tmp/claude-501/-Users-daniel--claude-spares-spare-rtWwV0/8a2f2c1b-cdec-4495-ade2-7284fb12ae96/scratchpad/audit/interaction/d14-missing-report.png` |
