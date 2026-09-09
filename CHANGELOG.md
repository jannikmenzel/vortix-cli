# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.1.1]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.1
[0.1.0]: https://github.com/jannikmenzel/vortix-cli/releases/tag/v0.1.0
