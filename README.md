# Vortix CLI

[![npm](https://img.shields.io/npm/v/vortix-cli.svg)](https://www.npmjs.com/package/vortix-cli)
[![CI](https://github.com/jannikmenzel/vortix-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jannikmenzel/vortix-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)

Local, no-account CLI that audits static sites for performance, security, accessibility, bugs, SEO, maintainability & privacy issues. Auto-detects Astro, Eleventy, Next.js, Nuxt, SvelteKit, Gatsby, Docusaurus, VuePress, Gridsome, Vite, MkDocs, Zola, Hugo, Hexo, Jekyll — or any generator via its output folder.

![vortix check demo](./media/demo.gif)

## Quick Start

```bash
npm install -D vortix-cli
npx vortix init
npx vortix check
```

Node.js `>=20` required. Chromium downloads automatically via `@playwright/browser-chromium`.

## Commands

```bash
npx vortix check
npx vortix check https://example.com
npx vortix ci
```

Checks run in one of three modes: **static** (built files on disk), **dynamic** (headless browser), **live** (a real HTTP request — only when you pass a URL, otherwise shown as skipped).

## Config

`vortix init` writes `.vortix/config.json`:

```json
{
  "target": { "adapter": "astro" },
  "categories": { "performance": true, "security": true, "privacy": false },
  "failOn": "error",
  "performance": { "budgets": { "lcpMs": 2500, "cls": 0.1, "maxPageWeightKb": 1500 } },
  "checks": ["./checks/no-todo-comments.js"]
}
```

## Custom checks

```js
// ./checks/no-todo-comments.js
import { defineCheck } from "vortix-cli";

export default defineCheck({
  id: "custom.no-todo-comments",
  category: "maintainability",
  mode: "static",
  severity: "warn",
  async run(ctx) {
    const files = await ctx.glob("src/**/*.{astro,md}");
    return files.filter((f) => ctx.readFile(f).includes("TODO")).map((f) => ctx.finding({ message: "Found a TODO", file: f }));
  },
});
```

Reference a local path or a published npm package in `checks: []`.

## Ignoring findings

`disabledChecks` turns off a whole check. `ignore` skips single findings:

```json
{
  "ignore": [
    { "id": "GHSA-fc5q-39xc-vjpf", "reason": "no patched picomatch yet", "until": "2027-01-31" },
    { "check": "seo.*", "url": "/drafts/" },
    { "check": "bugs.broken-links", "match": "/example\\.com/i" }
  ]
}
```

| Field | Matches |
| --- | --- |
| `check` | check id, `*` at the end as wildcard |
| `id` | advisory id, e.g. from `npm audit` |
| `match` | text in the message, or `/regex/flags` |
| `file`, `url` | text in the file path or URL |

All given fields must match. `reason` is shown in the output. After `until` (`YYYY-MM-DD`) the rule stops applying.

Ignored findings don't count toward the exit code or score. `vortix ci` lists them under `ignored`. Rules that match nothing or have expired show up as warnings.

`npm audit` findings carry the advisory ids of their root cause. Ignoring one id also covers every package that is only affected through it.

## Included checks

| Category | Checks |
|---|---|
| Performance | Core Web Vitals budget, page weight & image size, image formats, lazy loading, third-party impact |
| Security | `npm audit`, mixed content, security headers, HTTPS enforcement, server info disclosure, cookie security |
| Accessibility | WCAG 2.1 A/AA (axe-core), color contrast |
| Bugs | Broken links/images/assets, dangling anchors, invalid nesting, viewport meta, console errors |
| SEO | Meta/OG tags, OG images, canonical URL, structured data, robots.txt/sitemap |
| Maintainability | Code duplication, outdated deps, dead CSS, license check |
| Privacy | Tracking requests, external fonts/APIs, fingerprinting APIs |

Each run ends in a 0–100 score (A–F), averaged per-check → per-category so no category drowns out another. Any `error`-severity finding caps the grade at "C", regardless of the average.

## License

[MIT](./LICENSE)
