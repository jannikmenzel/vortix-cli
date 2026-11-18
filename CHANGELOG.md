# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-18

### Added

- `ignore` in `.vortix/config.json` skips single findings by check id, advisory id, message text or `/regex/`, file or URL. Rules can carry a `reason` and expire after an `until` date. Ignored findings don't count toward the exit code or score and are listed under `ignored` in `vortix ci`. Unused, expired or invalid rules show up as warnings.
- `npm audit` findings carry the GHSA ids of their root cause, resolved through transitive dependencies. Ignoring one id covers every package that is only affected through it.
- `--static` for `vortix check` and `vortix ci` runs only static checks, without a browser or live request. `vortix check --no-interactive` prints the report without prompts.
- `vortix hook install [--full]` and `vortix hook uninstall` manage a git pre-commit hook. It respects `core.hooksPath`, never overwrites foreign hooks and prints the line to add when Husky is used. `vortix init` offers to set it up.

## [0.1.4] - 2026-10-08

### Fixed

- The `vortix init`-generated GitHub Actions workflow now actually persists `.vortix/cache.json` across runs. It used `actions/cache`, which only saves on job success, so any run with error findings (exit code 1) never saved the cache. The workflow now uses separate `actions/cache/restore` and `actions/cache/save` steps, with the save step running under `if: always()`.

## [0.1.3] - 2026-09-13

### Changed

- `hashPageContent` now hashes only the `<body>` content of a page instead of the full HTML, so unrelated `<head>` churn (e.g. content-hashed bundled asset links rewritten by Vite/Rollup) no longer busts the dynamic-check cache.

### Fixed

- Scorecard grade badge glyphs (A–F) redrawn in a 6x5 block-letter format for better legibility.

## [0.1.2] - 2026-09-11

### Changed

- CI workflow now skips the test matrix when no code-relevant files (`src/**`, `tests/**`, config files) changed since the last check, instead of always running on every push/PR.
- `vortix check`/`vortix ci` now cache dynamic (Playwright) check results per page in `.vortix/cache.json` and only re-check pages whose content changed since the last run. The `vortix init`-generated GitHub Actions workflow persists this cache across runs via `actions/cache`.

## [0.1.1] - 2026-09-09

### Fixed

- CLI and GitHub Actions workflow could hang indefinitely instead of exiting. Added abort/timeout logic to ensure runs always terminate.

## [0.1.0] - 2026-09-08

### Added

- Initial release of Vortix CLI: `check`, `ci`, `init`, and `config` commands.
- Static, dynamic, and live checks across performance, security, accessibility, bugs, SEO, maintainability, and privacy.
- Built-in adapters for Astro, Eleventy, Next.js (static export), Nuxt, SvelteKit (adapter-static), Gatsby, Docusaurus, VuePress, Gridsome, Vite, MkDocs, Zola, Hugo, Hexo, and Jekyll, with a generic fallback for other static site generators.
- `vortix init` scaffolding for `.vortix/config.json` and an optional GitHub Actions workflow.
- Custom check API via `defineCheck` for local files or published npm packages.

[0.2.0]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.2.0
[0.1.4]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.4
[0.1.3]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.3
[0.1.2]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.2
[0.1.1]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.1
[0.1.0]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.0
