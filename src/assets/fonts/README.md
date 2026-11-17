# Fonts

| File | Face | Made from | Axes / weight |
|---|---|---|---|
| `serif.woff2` | Parallax Serif | Source Serif 4 (Adobe) | variable: weight 300–650, optical size 8–60 |
| `serif-italic.woff2` | Parallax Serif Italic | Source Serif 4 Italic (Adobe) | variable: weight 300–600, optical size 8–60 |
| `mono.woff2` | Parallax Mono | IBM Plex Mono Regular (IBM) | 400 |
| `mono-medium.woff2` | Parallax Mono Medium | IBM Plex Mono Medium (IBM) | 500 |

Each file is a subset of the original to the Latin characters the site uses, compressed as
WOFF2 and renamed. Under the SIL Open Font License a subset is a Modified Version, which may
not carry the Reserved Font Names ("Source", "Plex"). The stylesheet addresses them as
`PX Serif` and `PX Mono` (`src/styles.css`, first block).

The license and both copyright notices are in [OFL.txt](OFL.txt), and each file keeps them
in its own name table. The build publishes the `.woff2` files only.
