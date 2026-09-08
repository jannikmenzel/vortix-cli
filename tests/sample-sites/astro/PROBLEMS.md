# Astro fixture — seeded problems

This is a pre-built Astro output (`astro.config.mjs` for adapter detection, `dist/` as the
output dir — `build: false`, nothing is actually compiled) with deliberately planted issues.
`tests/fixtures-e2e/astro.test.ts` asserts vortix actually detects each one below.

This is the comprehensive fixture — Hugo/Jekyll/Eleventy/Vite each get a lean 2-3 issue
fixture instead, mainly to prove adapter detection + build-output handling. Astro is the one
fixture where every one of vortix's checks gets a genuine, hermetic (no real network access)
seeded finding — split across four files, since some checks need infrastructure this static
`dist/` can't provide on its own:

| File | Covers |
|---|---|
| `astro.test.ts` | Every check below, plus `performance.core-web-vitals` via a deliberately unmeetable LCP budget (timing-based, so it can't be seeded in the static HTML itself) |
| `astro-third-party.test.ts` | `performance.third-party-impact`, `privacy.tracker-requests` — via a real local HTTP server reachable as `localhost`, which reads as cross-origin to the checks (they compare hostnames only) even though it's loopback-only, no real external network call involved. Also covers two `third-party-impact` regression cases: a `<script defer>` third-party resource must not be flagged as blocking (a synchronous one from the same host still is), and a script loaded inside a third-party `<iframe>` must not be flagged either (it runs in a child frame, so it can't block the parent page's render) |
| `astro-dependencies.test.ts` | `security.dependency-vulnerabilities`, `maintainability.outdated-dependencies`, `maintainability.license-check` — a temp copy of this fixture gets a `package.json`/`node_modules` with a fake vulnerable/outdated/GPL-3.0 dependency; `npm audit`/`npm outdated` are mocked (real registry calls aren't hermetic), license-check reads the fabricated local `node_modules` for real |
| `astro-live.test.ts` | The 5 `live`-mode checks (`security.security-headers`, `security.https-enforced`, `security.server-info-disclosure`, `security.cookie-security`, `security.mixed-content`) against a stubbed fetch response, scoped to an `astro.config.mjs` fixture so adapter resolution is genuinely Astro |
| `astro-iframe-accessibility.test.ts` | Regression: `accessibility.axe` / `accessibility.color-contrast` must not scan into a third-party `<iframe>` and attribute its violations to this site — same loopback-as-cross-origin trick, embedding a widget page with its own low-contrast text and alt-less image |
| `astro-ssr-output.test.ts` | Regression: the `astro` adapter must resolve internal links against `dist/client/`, not `dist/`, when the build output is split into `dist/client/` + `dist/server/` (Astro's SSR/hybrid adapters, e.g. `@astrojs/node`) |

## Seeded and asserted

| Check | Where | Issue |
|---|---|---|
| `bugs.broken-links` | index.html | link to `/nowhere.html`, image `src="/missing.png"` — neither exists |
| `bugs.anchor-links` | index.html | `<a href="#nonexistent-section">` with no matching id on the page. Also has `<a href="#section.intro">` + `<h2 id="section.intro">`, which must **not** be flagged (regression check for the dotted-id selector-escaping bug) |
| `bugs.nested-block-elements` | index.html | `<button>` nested inside `<a>` (invalid); `<span><div>` nested (invalid, non-transparent inline); a `<div>`/`<h2>`/`<p>` card nested inside `<a>` is present too and must **not** be flagged (HTML5 transparent content model) |
| `bugs.viewport-meta` | about/index.html | no `<meta name="viewport">` |
| `bugs.console-errors` | index.html | inline `<script>console.error(...)</script>` **plus** a real browser-logged "Failed to load resource: 404" for `/missing.png` — 2 findings total |
| `seo.meta-tags` | index.html | no `<meta name="description">`, no `og:title`/`og:description`, title >70 chars (likely truncated in search results) |
| `seo.canonical-url` | index.html / about+contact | index.html has no canonical (missing); about/index.html and contact/index.html declare the *same* canonical URL (duplicate) |
| `seo.og-images` | index.html | `og:image` points at `./og-broken.png`, which doesn't exist |
| `seo.structured-data` | index.html | no `<script type="application/ld+json">` (about/contact both have one, so this isolates the finding to index) |
| `seo.robots-sitemap` | robots.txt | blanket `Disallow: /` under `User-agent: *`, plus a `Sitemap:` entry pointing at a file that doesn't exist in the output |
| `performance.image-format` | index.html | `photo.jpg` (legacy format) |
| `performance.lazy-loading` | index.html | `photo.jpg` is below the fold (pushed there by the content above it) and missing `loading="lazy"`; the `icon.svg` logo right after `<h1>` is visible without scrolling but wrongly marked `loading="lazy"` (the reverse mistake — delays it and can hurt LCP) |
| `performance.asset-weight` | index.html | `photo.jpg` is ~340KB, over the 300KB default single-image budget |
| `accessibility.axe` | index.html | `<img src="/icon.svg">` with no `alt` attribute (axe's `image-alt` rule) |
| `accessibility.color-contrast` | index.html | light-gray-on-white paragraph, well under WCAG AA contrast |
| `privacy.fingerprinting` | index.html | inline `new AudioContext()` |
| `maintainability.dead-css` | dist/style.css | `.unused-ghost-class` is defined but never used in any page (`.card` *is* used, so it must not be flagged) |
| `maintainability.duplication` | src/format-price.js, src/normalize-price.js | ~20 duplicated lines between the two files (jscpd scans `src/`, not `dist/`) |

## Not seeded with a genuine violation here (see table above for where each one actually is)

- **`performance.core-web-vitals`**, **`performance.third-party-impact`**,
  **`privacy.tracker-requests`**, **`security.dependency-vulnerabilities`**,
  **`maintainability.outdated-dependencies`**, **`maintainability.license-check`**, and the
  five **`live`**-mode checks aren't (and can't be) seeded in *this* static `dist/` — see the
  file table above for where each is actually exercised with a real finding.
- `tests/fixtures-e2e/live-checks.test.ts` still covers the five live checks generically
  (adapter-agnostic, exercises more response shapes) — `astro-live.test.ts` adds the
  astro-scoped version of the same two core scenarios.

## Still genuinely not seedable (and why)

- **`privacy.external-fonts`** — matches against a *hardcoded* host list
  (`fonts.googleapis.com`, `fonts.gstatic.com`, `use.typekit.net`, `fonts.adobe.com`), unlike
  `privacy.tracker-requests`'s configurable `trackerDomains`. Triggering it for real would mean
  either a genuine external network call (not hermetic/CI-safe) or hijacking Chromium's DNS
  resolution for one of those exact hostnames (`--host-resolver-rules`, which `runVortix`
  doesn't currently expose to callers) — both out of scope for a test-only change. It's still
  asserted to run cleanly with zero findings in `astro.test.ts`.
