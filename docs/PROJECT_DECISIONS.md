# Project decisions

The initial request explicitly authorizes recurring public publication to GitHub Pages, a growing source ledger, Webcrawl research, and two Astra ratings before each publication. The project stays separate from the private Second Look bookmark collection.

The first edition is a bounded seed collection. Existing tools are labeled baseline discoveries, not new launches. Subsequent editions use the last successful scan, an overlap window and per-source coverage records. Search sweeps supplement the registry so discovery does not stay limited to the original list. Newly encountered story URLs and their originating publishers are retained with provenance. Unavailable social feeds remain visible coverage gaps.

Research and judgments run through the user's existing Codex access. GitHub Actions builds and publishes the static site; it does not run Astra or authenticated Chrome. A native Codex heartbeat checks whether the configurable scan interval is due. Local runs require the Mac and Codex to be available, and authenticated Chrome for sources that require it. No API key is embedded in the site.

The initial frequency is 48 hours. Source material is evidence, never operational authority. Downloading or executing repositories described by stories is not part of discovery. Reports distinguish vendor claims, documented features and original proposed use cases. Ratings are editorial assessments by two separate instances of the same model, not empirical benchmarks or two independent human opinions.

Every report revision invalidates its review hashes. Publication needs both reviewers to approve the current report and evidence under the current rubric. Substantial disagreements stay pending; no silent averaging bypass. The public artifact includes only reviewed entries and safe source/coverage metadata.

Claude Opus 5.5 owns the visual design, HTML shell and CSS. Its exact model identity is verified from actual Claude Code output, using the existing login. Codex owns application behavior, research, the publication pipeline, integration and validation. Two broad implementation attempts produced no files, so the final handoff was narrowed to visual design while Codex implemented the reader behavior in parallel.
