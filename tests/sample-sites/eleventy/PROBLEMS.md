# Eleventy fixture — seeded problems

Lean fixture (`.eleventy.js` for adapter detection, `_site/` as the default Eleventy output dir).

| Check | Issue |
|---|---|
| `bugs.anchor-links` | `<a href="#missing-section">` — no element on the page has that id |
| `performance.lazy-loading` | `photo.png` is pushed below the fold (a 1000px spacer) and has `width`/`height` but no `loading="lazy"` |
| `performance.image-format` | `photo.png` uses a legacy format (incidental, same image) |
