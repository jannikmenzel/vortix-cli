import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("playwright", async (importOriginal) => {
  const actual = await importOriginal<typeof import("playwright")>();
  return {
    ...actual,
    chromium: {
      ...actual.chromium,
      launch: vi.fn(async () => {
        throw new Error("simulated: no browser binaries available");
      }),
    },
  };
});

import { runVortix } from "@core/runner.js";
import { buildConfig, findingsFor } from "./support.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-dynamic-failure-"));
  mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
  writeFileSync(path.join(tmpDir, "dist", "index.html"), "<html><head><title>t</title></head><body></body></html>");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("a missing/broken browser must not take down the rest of the run", () => {
  it("skips only dynamic checks, and still evaluates live checks when a URL is given", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        redirected: false,
        url: "http://example.com/",
        text: async () => "<html></html>",
        headers: { forEach: () => {}, getSetCookie: () => [] },
      }))
    );

    const result = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" } }), undefined, "http://example.com/");

    const dynamicChecks = result.checks.filter((c) => c.mode === "dynamic");
    expect(dynamicChecks.length).toBeGreaterThan(0);
    for (const check of dynamicChecks) {
      expect(result.skipped[check.id]).toMatch(/playwright/i);
    }
    expect(result.pagesChecked).toBe(0);

    // The regression guarded here: a browser-launch failure used to return early and silently
    // drop every live check, producing neither a finding nor a skip entry.
    const liveChecks = result.checks.filter((c) => c.mode === "live");
    expect(liveChecks.length).toBeGreaterThan(0);
    expect(findingsFor(result.findings, "security.https-enforced").length).toBe(1);
    for (const check of liveChecks) {
      // mixed-content legitimately self-skips on a plain-HTTP page, which is unrelated to this
      // regression. What matters is that no live check was skipped as "no URL given" or crashed
      // because of the browser-launch failure.
      expect(result.skipped[check.id] ?? "").not.toMatch(/no live URL|playwright/i);
    }

    // Static checks are unaffected in either case.
    expect(findingsFor(result.findings, "seo.meta-tags").length).toBeGreaterThan(0);
  }, 15000);
});
