# Parallax · AI Observatory

A growing public library of AI tools, models, repositories, research and creative workflows. Reports explain what changed, what the evidence supports, what to try, and where the limitations are. Source discovery is deliberately broad; coverage is finite and disclosed in each edition.

[Open the website](https://ddaehling.github.io/ai-observatory/) · [GitHub repository](https://github.com/ddaehling/ai-observatory)

The reading experience takes inspiration from the owner's Second Look bookmark project. Private bookmarks, browsing history and the earlier project's private source material are not imported.

## How it works

1. A native Codex heartbeat checks whether a scan is due. The default interval is 48 hours, measured from the last **completed** scan. Collection attempts do not reset the clock.
2. The Webcrawl skill visits and researches public sources through Chrome, complemented by bounded RSS/Atom collection. It maintains a source registry, evidence ledger, candidate queue, inclusion/rejection decisions and honest coverage records. New originating publishers become monitored sources; individual story records stay in the ledger without becoming perpetual scan targets.
3. Codex writes original reports, then two separate fresh-context `gpt-6-astra` agents at `high` effort independently check and rate the exact final report and its evidence. No OpenAI API key is needed for these native Codex agents.
4. The Python publication gate accepts only two current approvals from distinct reviewer IDs, exact report/evidence/rubric hashes, valid scores, safe markup and an appropriate report length. A difference greater than two points on any rating blocks that report.
5. GitHub Actions builds and publishes only the generated `dist/` website. New pending reports remain outside the website. A tracked publication baseline protects every already published report: if an edited report is awaiting fresh approvals, the next deployment stops and the existing live edition remains available.

The Mac, Codex and the relevant browser session must be available for a scheduled research run. GitHub Pages serves the static site independently. GitHub Actions does not impersonate Codex or run the research agents; it validates and deploys committed results. An unavailable Mac can delay a run. The displayed next scan time is an eligibility time, not a promise of execution at that instant.

The owner's installed hourly heartbeat is named **Update AI Observatory**. Its configuration belongs to the Codex app and is not embedded in this repository. Cloning the repository does not install a schedule. If the project folder moves, update the heartbeat's project path in Codex. For another installation, create a Codex heartbeat that checks `due` hourly and follows `MAINTENANCE.md` only when enabled and due.

## Run locally

Python 3.9 or later is sufficient for the deterministic pipeline; it has no third-party runtime dependencies. Research additionally uses Codex, the installed Webcrawl skill, Chrome and the user's authenticated access. Publishing uses Git and the authenticated GitHub CLI.

```sh
python3 scripts/observatory.py due
python3 scripts/observatory.py collect
python3 scripts/observatory.py hashes
python3 scripts/observatory.py validate
python3 scripts/observatory.py build
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. A development build can show an empty library. Publication requires at least one fully approved report:

```sh
python3 scripts/observatory.py build --strict
python3 -m unittest discover -s tests
```

`collect` only acquires feed candidates. It does not write reports, decide whether a story is important, produce scores or claim semantic review. It hashes normalized feed titles, publication/update dates and summaries so changed content at an existing URL creates a linked revision candidate. Retrieval time and tracking parameters do not count as a new development. Older candidates and their decisions remain intact. Webpage, X, Reddit and other non-feed outcomes must be recorded by the Codex Chrome research run. A resumed unfinished scan is preferred over starting an overlapping duplicate. A non-success outcome records the source and reason, rather than silently dropping it.

## Change the cadence

```sh
python3 scripts/observatory.py configure --interval-days 2
python3 scripts/observatory.py configure --interval-days 0.5 --enabled true
python3 scripts/observatory.py configure --enabled false
```

The supported interval is one hour through 365 days. `config.json` is authoritative; an hourly Codex heartbeat can check it and skip when nothing is due. Changing the interval does not require changing that heartbeat. Pausing prevents new due runs. Double-click **Open Observatory Controls.command** to open the local controls at `http://127.0.0.1:8893`; the same settings are available without a terminal. Preferences such as the website's reading queue live in the reader's browser and do not change the actual research schedule.

## Publication and review

See [MAINTENANCE.md](MAINTENANCE.md) for the complete research and publication procedure and [DATA_CONTRACT.md](DATA_CONTRACT.md) for the record formats. The canonical [rubric](data/rubric.json) defines five integer scales: usefulness, impact, novelty, maturity and openness. Public dimension scores are the mean of the two reviewers' ratings; the overall score is the mean of those dimensions. These are editorial judgments, not calibrated probabilities or reproduced benchmarks. Two independent runs of the same model are not independent experimental validation.

Review files record process provenance. Their hashes detect changes to reviewed inputs; they are not signatures or cryptographic proof that a particular model was invoked. Maintenance must launch real Astra agents and record their returned identities. Never create ratings by template or alter review records to make the gate pass.

Reports contain 1,000, 2,000 or 3,000 body words, with 10% tolerance, according to the final mean impact: below 5, 5 through 7, or above 7. Titles, summaries and bibliographies do not count toward the body target. Length is a quality requirement, not an invitation to pad weak evidence.

Configure the GitHub repository's Pages source as **GitHub Actions**. Pushing reviewed changes to `main` triggers `.github/workflows/pages.yml`. A clean, already-pushed commit can also request deployment with:

```sh
python3 scripts/observatory.py publish
```

This verifies the local gate and remote commit before requesting the workflow. It does not silently commit or push unrelated files. The Actions gate runs again, and the Pages upload contains only `dist/`. The site also exposes `feed.xml` and a small `manifest.json` of approved report revisions. Git history preserves earlier report and review revisions.

Before publishing newly approved reports, run `python3 scripts/observatory.py baseline --include-approved` and commit `data/publication-baseline.json` with the reviewed changes. This adds protection for the new IDs and never removes existing IDs. A strict build refuses to drop a baseline report or publish an approved report that has not been added to the baseline. Finish revisions and both fresh reviews before deploying; a normal development build may omit pending reports for local inspection, but cannot be published through the strict workflow.

Intentional editorial withdrawal is explicit and audited: `python3 scripts/observatory.py baseline --withdraw REPORT_ID --reason 'Concrete reason'`. Commit the changed baseline; the report's audit files remain in the repository but the public build omits it. Do not withdraw a report merely to bypass pending reviews. Restore it with `baseline --restore REPORT_ID` after both current reviews approve. Ordinary `--include-approved` does not undo an intentional withdrawal.

## Files and limits

`src/` is the static interface. `scripts/observatory.py` owns acquisition, validation and public builds. `data/reports/`, `data/reviews/`, `data/rubric.json`, `data/evidence.json`, `data/sources.json`, `data/candidates.json`, `data/decisions.json`, `data/runs.json` and `data/publication-baseline.json` form the public audit trail. Do not put credentials, private browsing material, agent prompts or raw browser traces there. Keep source passages short and attributable.

The collector accepts public HTTP(S) URLs, refuses private network destinations and credentials, checks redirect destinations, pins the resolved public address, verifies TLS, limits response size and applies finite fetch/run budgets. If Python's default CA store is absent, it can load a root-owned OS certificate bundle that cannot be written by group or other users; certificate and hostname checks remain required. Source content remains untrusted. The report sanitizer allows only a small semantic HTML vocabulary and safe links. It does not establish that a claim is true; that is the research and review responsibility.

Feeds can be truncated, blocked, delayed or incomplete, and social platforms can restrict access. Each run retains failed domains and pending work. Per-source overlapping windows protect against skipped time ranges after failures; they cannot recover content that a publisher no longer exposes. The candidate research cap prioritizes work without deleting overflow discoveries. No system can scan the entire internet, and the website must never imply exhaustive coverage.

## Design provenance

Claude Opus 5.5 designed the Parallax identity, HTML shell, CSS and original SVG artwork through Claude Code. Codex implemented application behavior and integration fixes. See [DESIGN.md](DESIGN.md) and the [measured design provenance](docs/design-provenance.json).
