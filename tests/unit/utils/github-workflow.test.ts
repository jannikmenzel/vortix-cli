import path from "node:path";
import { buildGithubWorkflowYaml, getGithubWorkflowPath } from "@utils/github-workflow.js";
import { describe, expect, it } from "vitest";

describe("getGithubWorkflowPath", () => {
  it("resolves to .github/workflows/vortix.yml under cwd", () => {
    expect(getGithubWorkflowPath("/site")).toBe(path.join("/site", ".github", "workflows", "vortix.yml"));
  });
});

describe("buildGithubWorkflowYaml", () => {
  it("runs `vortix ci` on both push and pull_request", () => {
    const yaml = buildGithubWorkflowYaml("npm");
    expect(yaml).toContain("on:");
    expect(yaml).toContain("push:");
    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("npx vortix ci");
  });

  it("installs with npm ci and enables npm caching for the npm package manager", () => {
    const yaml = buildGithubWorkflowYaml("npm");
    expect(yaml).toContain("cache: npm");
    expect(yaml).toContain("npm ci");
  });

  it("installs with a frozen lockfile and enables yarn caching for yarn", () => {
    const yaml = buildGithubWorkflowYaml("yarn");
    expect(yaml).toContain("cache: yarn");
    expect(yaml).toContain("yarn install --frozen-lockfile");
  });

  it("adds the pnpm setup action before setup-node for pnpm", () => {
    const yaml = buildGithubWorkflowYaml("pnpm");
    expect(yaml).toContain("pnpm/action-setup@v4");
    expect(yaml).toContain("cache: pnpm");
    expect(yaml).toContain("pnpm install --frozen-lockfile");
    expect(yaml.indexOf("pnpm/action-setup@v4")).toBeLessThan(yaml.indexOf("actions/setup-node@v4"));
  });

  it("uses setup-bun instead of setup-node, and bunx instead of npx, for bun", () => {
    const yaml = buildGithubWorkflowYaml("bun");
    expect(yaml).toContain("oven-sh/setup-bun@v2");
    expect(yaml).toContain("bun install --frozen-lockfile");
    expect(yaml).toContain("bunx vortix ci");
    expect(yaml).not.toContain("actions/setup-node");
  });
});
