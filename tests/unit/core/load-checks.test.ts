import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadChecks } from "@core/load-checks.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildConfig } from "../../fixtures-e2e/support.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-load-checks-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function write(relPath: string, content: string): void {
  const full = path.join(tmpDir, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

describe("loadChecks", () => {
  it("loads a valid custom check alongside the built-ins", async () => {
    write(
      "checks/custom.mjs",
      `export default {
        id: "custom.always-warns",
        category: "maintainability",
        mode: "static",
        async run(ctx) { return [ctx.finding({ message: "always warns" })]; },
      };`
    );
    const config = buildConfig(tmpDir, { checks: ["./checks/custom.mjs"] });
    const { checks, loadErrors } = await loadChecks(config);
    expect(loadErrors).toEqual([]);
    expect(checks.some((c) => c.id === "custom.always-warns")).toBe(true);
  });

  it("isolates broken custom checks instead of crashing the whole load", async () => {
    write("checks/broken.mjs", `throw new Error("boom at import time");`);
    const config = buildConfig(tmpDir, { checks: ["./checks/broken.mjs", "./does-not-exist.mjs"] });
    const { checks, loadErrors } = await loadChecks(config);
    // Every built-in check still loaded despite two broken custom specifiers.
    expect(checks.length).toBeGreaterThan(0);
    expect(loadErrors.length).toBe(2);
    expect(loadErrors.some((e) => e.specifier === "./checks/broken.mjs")).toBe(true);
  });

  it("reports a clear error for a module with no default export instead of silently dropping it", async () => {
    write("checks/no-default.mjs", `export const notDefault = {};`);
    const config = buildConfig(tmpDir, { checks: ["./checks/no-default.mjs"] });
    const { loadErrors } = await loadChecks(config);
    expect(loadErrors.length).toBe(1);
    expect(loadErrors[0].message).toMatch(/no default export/);
  });

  it("flags duplicate check ids instead of silently letting one shadow the other", async () => {
    write(
      "checks/dup.mjs",
      `export default {
        id: "seo.meta-tags",
        category: "seo",
        mode: "static",
        async run() { return []; },
      };`
    );
    const config = buildConfig(tmpDir, { checks: ["./checks/dup.mjs"] });
    const { checks, loadErrors } = await loadChecks(config);
    expect(checks.filter((c) => c.id === "seo.meta-tags").length).toBe(1);
    expect(loadErrors.some((e) => e.message.includes("Duplicate check id"))).toBe(true);
  });
});
