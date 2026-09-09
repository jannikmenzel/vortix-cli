import path from "node:path";
import type { PackageManager } from "./package-manager.js";

export const GITHUB_WORKFLOW_PATH = ".github/workflows/vortix.yml";

export function getGithubWorkflowPath(cwd: string): string {
  return path.join(cwd, GITHUB_WORKFLOW_PATH);
}

const SETUP_STEPS: Record<PackageManager, string> = {
  npm: `      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci`,
  yarn: `      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile`,
  pnpm: `      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile`,
  bun: `      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile`,
};

const RUN_COMMAND: Record<PackageManager, string> = {
  npm: "npx vortix ci",
  yarn: "npx vortix ci",
  pnpm: "npx vortix ci",
  bun: "bunx vortix ci",
};

/**
 * Builds a GitHub Actions workflow that installs dependencies with the given package manager and
 * runs `vortix ci` on every push and pull request. `vortix ci` builds the site itself (per the
 * project's `.vortix/config.json`), so no separate build step is needed here.
 */
export function buildGithubWorkflowYaml(pm: PackageManager): string {
  return `name: Vortix

on:
  push:
  pull_request:

jobs:
  vortix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${SETUP_STEPS[pm]}
      - uses: actions/cache@v4
        # Persists the dynamic-check cache (.vortix/cache.json) across runs, so \`vortix ci\`
        # only re-checks pages that changed since the last run instead of the whole site.
        with:
          path: .vortix/cache.json
          key: vortix-cache-\${{ github.sha }}
          restore-keys: |
            vortix-cache-
      - run: ${RUN_COMMAND[pm]}
        # Pass a deployed URL as an argument to also run live checks (HSTS, cookies, redirects):
        # - run: ${RUN_COMMAND[pm]} https://your-deployed-url.example.com
`;
}
