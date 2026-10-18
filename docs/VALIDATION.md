# First-edition validation · 18 October 2026

- All six reports pass the current dual-Astra gate. Report, evidence and rubric hashes match both independent approvals; all scores and word bands pass.
- 96 Python tests pass, covering acquisition, update fingerprints, failed-source windows, review gates, transactional publication, library preservation and local controls.
- JavaScript syntax check passes. An independent code review checked rendering, data integration, routes and import validation; two route/queue issues were fixed and rechecked.
- Browser verification covered search, empty results/reset, a full report, source links, both review explanations, mark-as-read, queue, quick search, source filtering, edition coverage and schedule guidance. Reading export successfully produced a JSON file. Import validation was code-reviewed; a full browser file-import round trip was not performed.
- Desktop and 390px mobile layouts were inspected. Decorative overflow and catalogue column integration were fixed; final DOM measurements show no horizontal overflow. Header icon buttons have accessible names when their visible labels are hidden.
- Darkroom preferences applied correctly. The interface also has Plate and Redlight themes. The reduced-motion rules respect the device preference and explicit reduction.
- No browser console errors were observed in the tested flows. The local controls previously completed a real form save for the enabled two-day interval.
- Design detector findings were reviewed. Theme-dependent colour pairs and inner dialog padding produced static warnings; actual theme tokens and layouts were inspected. The designer's reviewer symbols, instrument grid and focus treatments were retained under the user's explicit creative delegation.

Coverage and editorial limitations remain in the public edition and source ledger. These checks do not establish empirical model performance or exhaustive internet coverage.
