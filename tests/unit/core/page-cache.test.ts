import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeDynamicFingerprint, getCachePath, hashPageContent, loadDynamicCache, saveDynamicCache } from "@core/page-cache.js";
import type { CheckDefinition, DynamicCacheFile, ResolvedConfig } from "@core/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-page-cache-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function buildConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    cwd: tmpDir,
    build: false,
    failOn: "error",
    target: {},
    categories: {
      performance: true,
      security: true,
      accessibility: true,
      bugs: true,
      seo: true,
      maintainability: true,
      privacy: true,
    },
    checks: [],
    disabledChecks: [],
    severity: {},
    performance: { budgets: { lcpMs: 2500, cls: 0.1, maxPageWeightKb: 1500, maxImageKb: 300 } },
    privacy: { trackerDomains: [] },
    ...overrides,
  };
}

function dynamicCheck(id: string): CheckDefinition {
  return { id, category: "performance", mode: "dynamic", async run() {} };
}

describe("getCachePath", () => {
  it("returns .vortix/cache.json path", () => {
    expect(getCachePath("/project")).toBe(path.join("/project", ".vortix", "cache.json"));
  });
});

describe("computeDynamicFingerprint", () => {
  it("is stable for the same checks and config", () => {
    const config = buildConfig();
    const a = computeDynamicFingerprint([dynamicCheck("a"), dynamicCheck("b")], config);
    const b = computeDynamicFingerprint([dynamicCheck("a"), dynamicCheck("b")], config);
    expect(a).toBe(b);
  });

  it("is order-independent over the active check set", () => {
    const config = buildConfig();
    const a = computeDynamicFingerprint([dynamicCheck("a"), dynamicCheck("b")], config);
    const b = computeDynamicFingerprint([dynamicCheck("b"), dynamicCheck("a")], config);
    expect(a).toBe(b);
  });

  it("changes when the active dynamic check set changes", () => {
    const config = buildConfig();
    const a = computeDynamicFingerprint([dynamicCheck("a")], config);
    const b = computeDynamicFingerprint([dynamicCheck("a"), dynamicCheck("b")], config);
    expect(a).not.toBe(b);
  });

  it("changes when severity overrides change", () => {
    const checks = [dynamicCheck("a")];
    const a = computeDynamicFingerprint(checks, buildConfig());
    const b = computeDynamicFingerprint(checks, buildConfig({ severity: { a: "error" } }));
    expect(a).not.toBe(b);
  });

  it("changes when performance budgets change", () => {
    const checks = [dynamicCheck("a")];
    const a = computeDynamicFingerprint(checks, buildConfig());
    const b = computeDynamicFingerprint(
      checks,
      buildConfig({ performance: { budgets: { lcpMs: 1000, cls: 0.1, maxPageWeightKb: 1500, maxImageKb: 300 } } })
    );
    expect(a).not.toBe(b);
  });

  it("changes when tracker domains change", () => {
    const checks = [dynamicCheck("a")];
    const a = computeDynamicFingerprint(checks, buildConfig());
    const b = computeDynamicFingerprint(checks, buildConfig({ privacy: { trackerDomains: ["example.com"] } }));
    expect(a).not.toBe(b);
  });

  it("is unaffected by the key order of severity overrides", () => {
    const checks = [dynamicCheck("a")];
    const a = computeDynamicFingerprint(checks, buildConfig({ severity: { a: "error", b: "warn" } }));
    const b = computeDynamicFingerprint(checks, buildConfig({ severity: { b: "warn", a: "error" } }));
    expect(a).toBe(b);
  });

  it("changes when a local custom check file's content changes", () => {
    const checkFile = path.join(tmpDir, "my-check.mjs");
    writeFileSync(checkFile, "export default { id: 'a' };");
    const checks = [dynamicCheck("a")];
    const config = buildConfig({ checks: ["./my-check.mjs"] });

    const a = computeDynamicFingerprint(checks, config);
    writeFileSync(checkFile, "export default { id: 'a', changed: true };");
    const b = computeDynamicFingerprint(checks, config);
    expect(a).not.toBe(b);
  });

  it("does not fingerprint checks loaded from a package rather than a local file", () => {
    const checks = [dynamicCheck("a")];
    const a = computeDynamicFingerprint(checks, buildConfig({ checks: ["some-npm-package"] }));
    const b = computeDynamicFingerprint(checks, buildConfig({ checks: ["some-npm-package"] }));
    expect(a).toBe(b);
  });
});

describe("hashPageContent", () => {
  it("is stable for identical content", () => {
    const file = path.join(tmpDir, "a.html");
    writeFileSync(file, "<html></html>");
    expect(hashPageContent(file)).toBe(hashPageContent(file));
  });

  it("changes when the file content changes", () => {
    const file = path.join(tmpDir, "a.html");
    writeFileSync(file, "<html>1</html>");
    const before = hashPageContent(file);
    writeFileSync(file, "<html>2</html>");
    const after = hashPageContent(file);
    expect(before).not.toBe(after);
  });
});

describe("loadDynamicCache / saveDynamicCache", () => {
  it("returns undefined when no cache file exists", () => {
    expect(loadDynamicCache(tmpDir)).toBeUndefined();
  });

  it("round-trips a saved cache", () => {
    const cache: DynamicCacheFile = {
      fingerprint: "abc",
      pages: { "index.html": { contentHash: "h1", findings: [], details: [] } },
    };
    saveDynamicCache(tmpDir, cache);
    expect(loadDynamicCache(tmpDir)).toEqual(cache);
  });

  it("tolerates a corrupt cache file instead of throwing", () => {
    mkdirSync(path.join(tmpDir, ".vortix"), { recursive: true });
    writeFileSync(path.join(tmpDir, ".vortix", "cache.json"), "{not valid json");
    expect(loadDynamicCache(tmpDir)).toBeUndefined();
  });

  it("tolerates a cache file with the wrong shape instead of throwing", () => {
    mkdirSync(path.join(tmpDir, ".vortix"), { recursive: true });
    writeFileSync(path.join(tmpDir, ".vortix", "cache.json"), JSON.stringify({ nope: true }));
    expect(loadDynamicCache(tmpDir)).toBeUndefined();
  });

  it("creates the .vortix directory on save if it does not exist yet", () => {
    const cache: DynamicCacheFile = { fingerprint: "abc", pages: {} };
    saveDynamicCache(tmpDir, cache);
    expect(loadDynamicCache(tmpDir)).toEqual(cache);
  });
});
