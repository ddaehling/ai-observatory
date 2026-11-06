# A growing catalogue of public AI sources

## One catalogue, two kinds of record

The selected project's `data/publisher-catalogue.json` is the live curated catalogue. Read it before choosing recurring social/news sources. `data/sources.json` remains the acquisition authority and holds both individual story URLs and monitored entrypoints. The catalogue adds editorial purpose and dated assessments; it does not replace source results, evidence or candidate decisions.

The catalogue stays in the writable project so each research run can improve it without editing the installed skill. In a new project, create the same structure from sources actually inspected there; do not silently import this project's account assumptions. If the catalogue is missing in this project, reconstruct from its source ledger and saved public evidence, recording what remains unverified.

Keep one entry per recurring identity or publication. Different platforms may have separate entries linked as the same owner; do not count them as independent corroboration. Store individual posts/articles as evidence examples, not as catalogue identities or recurring monitors. Communities such as a subreddit are not individual social accounts.

## Discovery on every substantive research run

1. Revisit useful existing sources and the oldest unresolved discovery leads. Prioritize primary announcements and independent technical interpretation; rotate topics and platforms to reduce repeated coverage of one vendor.
2. Follow attribution and outbound links from worthwhile stories, papers, repositories, model cards, newsletters and public threads to authors, maintainers and original publishers. Search public pages for additional independent specialists where current coverage is weak.
3. Inspect the proposed profile/feed/archive and representative relevant items. Record identity, actual URL, available dates, topics, originality, practical usefulness and limits. Do not guess a handle from an organization name. A linked but unvisited account remains a discovery lead.
4. Add worthwhile inspected identities to the catalogue and a distinct `monitor:true` source record if absent. Add new story URLs separately with `monitor:false`. Inspect a newly added monitor before marking it active; otherwise leave it unverified. An inspected article alone does not establish successful access to its publisher homepage.
5. Record which identities were considered, added, updated, rejected or deferred, with concrete reasons and source locators. Aim to add useful sources each run, but allow zero additions when the actual search produces no qualifying new identity. Never fill a quota with low-value accounts.

A due-gate skip makes no research or catalogue-growth claim. Catalogue-only curation from saved evidence is labeled as such, not a newly completed scan or fresh source access.

## What qualifies

Prefer original announcements, reproducible work, useful implementation detail, careful comparisons, transparent limitations and links to primary artifacts. Preserve a role such as **official announcements**, **independent analysis**, **community discovery**, **specialist research** or **secondary tracker**. Vendor ownership is a conflict to disclose, not a reason to exclude a useful primary source.

Assess frequency only from observed dated posts/issues spanning a stated window. Several visible items can support “multiple relevant posts observed,” not a numeric daily cadence or “always first.” Follower count, verification badges and popularity do not establish accuracy. Older occasional essays can be valuable without being frequent news. Mark mixed-topic sources and narrow specialists accordingly.

Treat aggregator rankings, model launch trackers and repost accounts as leads. Verify dates, availability, licensing and performance at the origin. Do not mistake several syndications for independent confirmation. Retain low-yield or blocked entries with reasons rather than silently deleting history; reduce priority when warranted.

## Catalogue data and audit history

Use the schema documented in the project's `DATA_CONTRACT.md`. Preserve stable entry IDs and source-ledger IDs. At minimum, retain canonical identity URL, title, kind/platform, topics, role, assessment, observed examples, access limits and dated provenance. Keep retrieval date distinct from a post's publication date; unknown dates stay null. Unvisited profile links belong in `discoveryQueue` until inspected.

Add one `discoveryRuns` record per substantive run, linked to the real run ID. Include concrete considered URLs, additions/updates/rejections/deferred leads, counts, search strategy and a reason if no entries were added. An initial migration may use a descriptive curation ID, with its type explicitly stating saved-evidence curation. Do not invent a research run or source-check timestamp.

Before saving, mechanically verify unique IDs/canonical URLs, public credential-free URLs, evidence references and counts. Compare each `sourceId` to an actual monitored ledger record; catalogue growth and source-ledger growth are separate counts. An entry's current assessment must agree with dated observations, not a stale free-text note.

Run the bundled read-only helper, `python3 <skill-directory>/scripts/validate_catalogue.py <project-directory>`. Add `--check-captures` when ignored local archives are available to check their hashes and evidence URL occurrence. This catches structural/accounting errors; it cannot establish that a passage supports an interpretation, that an account is reliable, or that a source's history was exhausted.

The original catalogue includes inspected public X profiles, subreddits, newsletters and independent blogs. It also includes concrete unvisited author/account links as leads. Consult the current file for names and latest evidence rather than copying a static list into this skill. Local provenance files can help an agent resume work, but publicly readable source URLs must support the assessment; never include private account information, raw traces or machine-specific absolute paths.

## Review for accuracy, not forced growth

Before closing a run, sample a newly added identity and a rejected/deferred lead. Verify that evidence supports the claimed identity, topical relevance and cadence, and that a story has not accidentally become a recurring monitor. Recheck cited archive links when a prior note claims none exist: an extraction summary can omit links that are present in the saved DOM. Record corrections as dated observations.
