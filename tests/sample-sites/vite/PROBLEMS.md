# Vite fixture — seeded problems

Lean fixture (`vite.config.js` for adapter detection, `dist/` as the default Vite output dir).

| Check | Issue |
|---|---|
| `seo.meta-tags` | no `og:title`/`og:description`/`og:image` |
| `bugs.broken-links` | `<script src="/app-bundle.js">` doesn't exist in `dist/` |
| `seo.structured-data` | no `<script type="application/ld+json">` anywhere on the page |
