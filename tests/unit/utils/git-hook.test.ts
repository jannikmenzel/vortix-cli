import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildHookScript, HOOK_MARKER, installHook, uninstallHook } from "@utils/git-hook.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(path.join(os.tmpdir(), "vortix-hook-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

const hookPath = () => path.join(repo, ".git", "hooks", "pre-commit");

describe("buildHookScript", () => {
  it("runs only static checks by default", () => {
    const script = buildHookScript("npm", "static");
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain(HOOK_MARKER);
    expect(script).toContain("npx vortix check --static --no-interactive");
  });

  it("runs every check in full mode", () => {
    const script = buildHookScript("npm", "full");
    expect(script).toContain("npx vortix check --no-interactive");
    expect(script).not.toContain("--static");
  });

  it("uses bunx for bun projects", () => {
    expect(buildHookScript("bun", "static")).toContain("bunx vortix check");
  });
});

describe("installHook", () => {
  it("writes an executable pre-commit hook", () => {
    const result = installHook(repo, { mode: "static", pm: "npm" });
    expect(result.status).toBe("installed");
    expect(readFileSync(hookPath(), "utf-8")).toContain("--static");
    expect(statSync(hookPath()).mode & 0o111).not.toBe(0);
  });

  it("updates a hook it wrote before", () => {
    installHook(repo, { mode: "static", pm: "npm" });
    const result = installHook(repo, { mode: "full", pm: "npm" });
    expect(result.status).toBe("updated");
    expect(readFileSync(hookPath(), "utf-8")).not.toContain("--static");
  });

  it("never overwrites a foreign hook", () => {
    writeFileSync(hookPath(), "#!/bin/sh\nnpm test\n");
    const result = installHook(repo, { mode: "static", pm: "npm" });
    expect(result.status).toBe("foreign");
    expect(readFileSync(hookPath(), "utf-8")).toBe("#!/bin/sh\nnpm test\n");
  });

  it("respects core.hooksPath", () => {
    execFileSync("git", ["config", "core.hooksPath", "githooks"], { cwd: repo });
    const result = installHook(repo, { mode: "static", pm: "npm" });
    expect(result.path).toBe(path.join(repo, "githooks", "pre-commit"));
    expect(existsSync(result.path)).toBe(true);
  });

  it("leaves husky setups alone and returns the line to add", () => {
    mkdirSync(path.join(repo, ".husky", "_"), { recursive: true });
    execFileSync("git", ["config", "core.hooksPath", ".husky/_"], { cwd: repo });
    const result = installHook(repo, { mode: "static", pm: "npm" });
    expect(result.status).toBe("husky");
    expect(result.path).toBe(path.join(repo, ".husky", "pre-commit"));
    expect(result.command).toBe("npx vortix check --static --no-interactive");
    expect(existsSync(path.join(repo, ".husky", "pre-commit"))).toBe(false);
  });

  it("ignores a leftover .husky folder that git does not use", () => {
    mkdirSync(path.join(repo, ".husky"), { recursive: true });
    expect(installHook(repo, { mode: "static", pm: "npm" }).status).toBe("installed");
  });

  it("changes into the project folder when it is not the repository root", () => {
    const project = path.join(repo, "site");
    mkdirSync(project);
    const result = installHook(project, { mode: "static", pm: "npm" });
    expect(result.path).toBe(hookPath());
    expect(readFileSync(hookPath(), "utf-8")).toContain('cd "site" && exec npx vortix check --static --no-interactive');
  });

  it("fails outside a git repository", () => {
    const plain = mkdtempSync(path.join(os.tmpdir(), "vortix-nogit-"));
    try {
      expect(() => installHook(plain, { mode: "static", pm: "npm" })).toThrow(/git/i);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe("uninstallHook", () => {
  it("removes a hook it wrote", () => {
    installHook(repo, { mode: "static", pm: "npm" });
    expect(uninstallHook(repo).status).toBe("removed");
    expect(existsSync(hookPath())).toBe(false);
  });

  it("keeps foreign hooks", () => {
    writeFileSync(hookPath(), "#!/bin/sh\nnpm test\n");
    expect(uninstallHook(repo).status).toBe("foreign");
    expect(existsSync(hookPath())).toBe(true);
  });

  it("reports when there is nothing to remove", () => {
    expect(uninstallHook(repo).status).toBe("missing");
  });
});
