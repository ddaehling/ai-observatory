# Research lessons from repeated observatory runs

## Access and historical coverage are separate

- A successful HTTP request or visible profile means access, not an exhausted date window. Record each source's own `windowStart`, inspected scope and inaccessible history. Curated homepages, pinned posts, trending lists and a current README normally support only partial coverage.
- Use `record-source --status success --partial` when history is incomplete. This preserves the existing coverage watermark; it cannot undo a watermark previously advanced by a full-success record. Keep a successful feed result when adding supplementary partial browser observations, and record that supplement separately.
- Only claim complete historical coverage when the inspected feed/archive demonstrably brackets the outstanding window and pagination is accounted for. Do not inherit a newer watermark from a different publisher.
- Distinguish source publication, event/announcement, rollout, update, repository activity and retrieval dates. Leave unknown dates null. A model specification’s release date does not establish when an undated announcement page was published; keep the event date while leaving the publication date unknown. A newly visible pinned post may be months old. A dated URL slug can differ from the date displayed in the article; record the discrepancy rather than silently choosing one.
- Sparse extraction, login walls, search-engine gaps and stale snippets do not establish absence. After one focused acquisition repair per item, preserve the unresolved question and continue independent work.

For a supplementary visit to a source already successfully collected by RSS, do **not** invoke `record-source` again for that source: the command replaces its existing result. The coordinator should use the existing bundle-integration path, or acquire `scripts/observatory.py`'s `project_lock(root)`, reload the latest run data, locate the exact run/source result, and append a dated object to `supplementaryObservations`. Use `{status,checkedAt,note,coverageComplete:false}` for a partial success; failed supplements also use `coverageComplete:false`. Avoid duplicating an identical observation on resume. Atomically save through the project's existing JSON writer while holding the lock. Preserve the original feed result, timestamps, window, watermark and counters; do not rewrite completed historical runs for a catalogue-only correction. The supplementary note must say what was inspected and what remains inaccessible.

## Browser acquisition that survives long runs

Apply Webcrawl's current browser rules. Use owned Chrome tabs and public article/post content; exclude account navigation, recommendations carrying personal context and unrelated UI from retained evidence. A readable X profile does not repair an empty extraction of an older individual post.

Small batches of roughly three or four pages proved easier to checkpoint and recover than larger navigation batches. Treat this as a starting size, reducing it for heavy pages. Record owned tab IDs, source URLs, retrieval times and saved paths as each batch completes. If the runtime resets, recover from disk; a stale in-memory archive index is not proof that a capture was saved. Inspect the actual relevant files and hashes.

Capture complete relevant source content in ignored run storage when practical, then retain concise supporting passages and locators in public evidence. Do not publish raw browser dumps or screenshots containing account chrome. A worker's claimed success needs a saved artifact or explicit tool result, not just a filename mentioned in prose.

When a shared browser connection disappears mid-run, distinguish an individually attempted failure from an entrypoint that was never visited. An unvisited result keeps `checkedAt:null` and its prior access and coverage timestamps; record the outage-accounting time separately. Coordinate one availability recheck before workers resume, rather than making every remaining source repeat the same connection failure.

## Discover broadly; promote selectively

Official release pages identify announcements; docs, licenses, repositories and model cards constrain what those announcements mean. Independent analysts and communities expose failure modes and implementation questions. Trackers are discovery aids: observed errors included dates, vendor attribution and openness labels. Verify consequential claims at the origin.

Rotate domains and practical interests: coding/agents, retrieval, small/local models, multimodal systems, speech/audio/video, education, evaluation/safety, creative production and relevant scientific tools. Include independent sources and different organizations; multiple accounts owned by one vendor are not independent corroboration. Expand through linked authors and maintainers rather than follower counts.

Do not install packages or run advertised demos simply to satisfy a research checklist. Documentary evaluation and native testing are different kinds of evidence. Claim testing only when actually performed within the authorized scope.

## Preserve changes and decisions

Canonicalize tracking parameters and fragments, but retain discovery provenance. Consolidate the same story found by several workers while preserving each candidate's duplicate disposition. A feed fingerprint uses normalized title, dates and summary, excluding retrieval time; a changed fingerprint signals a candidate revision, not necessarily a material product change.

The acquisition ledger can contain stale free-text notes alongside recent successful visits. Reconcile current status against dated run results and saved evidence; do not copy an old “not visited” note as a current fact. Add dated observations instead of rewriting historical failures out of existence.

Reserve capacity for the oldest unresolved backlog before new stories. Record the exact selected backlog set and its final dispositions. Do not describe a sampled selection as the whole backlog. Sample ordinary accepted and rejected decisions, fully inspect consequential ambiguity, and broaden review if the sample exposes errors.

## Honest accounting

Keep separate counts for capture files, unique source URLs, recurring monitored identities, successful accesses, complete windows, partial accesses, failures, new candidates, revisited backlog, candidate decisions and changed reports. Retries and screenshots can increase capture count without increasing sources checked. Several included candidates may support one report.

A run is complete when its required source/candidate accounting is complete, with limitations recorded. That does not mean the web was exhausted or every source was accessible. Never report measured token cost, monetary cost, runtime performance or savings from estimates alone.
