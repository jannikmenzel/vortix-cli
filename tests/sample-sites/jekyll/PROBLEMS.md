# Jekyll fixture — seeded problems

Lean fixture (`_config.yml` for adapter detection, `_site/` as the default Jekyll output dir).

| Check | Issue |
|---|---|
| `seo.meta-tags` | no `<meta name="description">` |
| `bugs.broken-links` | `<img src="/missing.png">` doesn't exist in `_site/` |
| `seo.canonical-url` | no `<link rel="canonical">` anywhere on the page |
