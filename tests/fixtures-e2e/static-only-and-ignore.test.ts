import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { launch } = vi.hoisted(() => ({
  launch: vi.fn(async () => {
    throw new Error("browser must not be launched in static-only mode");
  }),
}));

vi.mock("playwright", async (importOriginal) => {
  const actual = await importOriginal<typeof import("playwright")>();
  return { ...actual, chromium: { ...actual.chromium, launch } };
});

import { runVortix } from "@core/runner.js";
import { buildConfig } from "./support.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-static-only-"));
  mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
  writeFileSync(path.join(tmpDir, "dist", "index.html"), "<html><head></head><body><img src='a.png'></body></html>");
  launch.mockClear();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("runVortix staticOnly", () => {
  it("runs only static checks and never starts a browser or fetches the live URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const result = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" } }), undefined, "https://example.com/", {
        staticOnly: true,
      });
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks.every((c) => c.mode === "static")).toBe(true);
      expect(launch).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.liveUrl).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("runVortix ignore rules", () => {
  it("moves ignored findings out of the exit code and reports unused rules", async () => {
    const base = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" }, failOn: "info" }), undefined, undefined, {
      staticOnly: true,
    });
    expect(base.findings.length).toBeGreaterThan(0);

    const result = await runVortix(
      buildConfig(tmpDir, {
        target: { outputDir: "dist" },
        failOn: "info",
        ignore: [
          { check: "*", reason: "test" },
          { check: base.checks[0].id, match: "never-matches-anything" },
          { check: "custom.never-ran", match: "x" },
          { match: "y" },
        ],
      }),
      undefined,
      undefined,
      { staticOnly: true }
    );
    expect(result.findings).toEqual([]);
    expect(result.ignored.length).toBe(base.findings.length);
    expect(result.ignored.every((f) => f.ignoreReason === "test")).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });
});
