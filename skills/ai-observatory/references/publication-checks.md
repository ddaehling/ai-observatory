# Evidence integration and publication checks

The current project contracts define the exact schema, CLI commands and review gate. Read them; this reference records fragile invariants, not a replacement implementation.

## Before integrating

Record current hashes for protected reports. Evidence hashes include the report's source records and claims overlapping its source IDs. Adding a new claim to a shared source can therefore invalidate an existing approval even when the report body is unchanged. Plan genuine shared-evidence revisions deliberately and re-review all affected reports; do not remove relevant evidence merely to preserve an approval.

Use one coordinator for mutations, including catalogue integration and Git. Run every observatory CLI command sequentially, even hashing. Workers write only their assigned checkpoint files. Inspect structured packets and actual evidence artifacts before merging worker claims.

## Reviews that prove what was reviewed

Prepare a frozen report/evidence/rubric packet with current CLI hashes. Spawn two distinct native collaboration agents using exactly `gpt-6-astra`, `high`, and `fork_turns:"none"`. Each sees the report and underlying evidence, never the other review. Save actual invocation metadata and canonical returned agent identities; a model name typed into JSON is not proof of invocation.

Require all five integer scores from 1–10: usefulness, impact, novelty, maturity and openness, with rationale, confidence, concerns and verdict. Both must approve the current hashes. A difference greater than two points in any dimension blocks publication. Reconcile the disputed evidence and revise within the project's limits; do not average away the disagreement or solicit a preferred score.

The final mean impact determines body length: below 5 → 1,000 words, 5–7 → 2,000, above 7 → 3,000, ±10%. If the band changes, revise substantively and obtain fresh approvals. Any substantive report, relevant evidence or rubric change needs reviews matching the final inputs. Keep earlier review history.

If exact Astra is unavailable, save pending work and report the blocker. Never use another model, fabricate approvals, change protection lists or withdraw an unfinished revision to get a green build. At most three generative attempts and one focused acquisition repair per item; retain unresolved work afterward.

## Closing and verifying

Reconcile source results against the run's expected IDs, each candidate against its disposition, and catalogue discovery against actual considered identities. Distinguish source accessibility from full date-window coverage. An independent accounting pass is useful when integrating multiple worker bundles.

Run the contract's validation, completion, baseline inclusion, strict build and relevant tests in the documented order. The baseline protects all published IDs; pending updates must not silently remove old reports from the site. Inspect the generated index, a full changed report, citations, edition coverage, scores and both reviewer rationales. Interface changes also need mobile/keyboard and empty/pending-state inspection.

Stage explicit project-owned public-safe files only. Inspect the staged diff; exclude ignored acquisition dumps, personal paths in public data, private account UI and unrelated untracked files. Existing publication authorization applies only to the configured project and approved content.

After pushing, confirm the successful Pages deployment corresponds to the pushed commit. Fetch the live manifest and data payload and compare the published report set, relevant content/evidence/review hashes and edition accounting with the local strict build. Inspect the live changed report route. A successful workflow dispatch or build is insufficient to claim the site is published.

Keep deployment and content checks checkpointed. If deployment fails, retain the last working site and describe the actual failure. Notices should link changed reports and state concise counts plus material coverage limits; do not send a routine “checked” notification when nothing actionable changed.
