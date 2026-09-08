# Hugo fixture — seeded problems

Lean fixture (`hugo.toml` for adapter detection, `public/` as the default Hugo output dir)
— just enough to prove adapter auto-detection and the `public/` output-dir convention work,
not full check coverage (see `tests/sample-sites/astro/PROBLEMS.md` for the comprehensive one).

| Check | Issue |
|---|---|
| `bugs.viewport-meta` | no `<meta name="viewport">` |
| `bugs.broken-links` | `<a href="/nowhere.html">` doesn't exist in `public/` |
| `performance.image-format` | `photo.jpg` uses a legacy format |
