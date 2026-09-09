import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProgressEvent } from "@core/runner.js";
import { runVortix } from "@core/runner.js";
import { chromium } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig, findingsFor } from "./support.js";

let tmpDir: string;
let indexPath: string;
let aboutPath: string;

function html(body: string): string {
  return `<html><head><title>t</title></head><body>${body}</body></html>`;
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-page-cache-e2e-"));
  mkdirSync(path.join(tmpDir, "dist", "about"), { recursive: true });
  indexPath = path.join(tmpDir, "dist", "index.html");
  aboutPath = path.join(tmpDir, "dist", "about", "index.html");
  writeFileSync(indexPath, html("<script>throw new Error('boom')</script>"));
  writeFileSync(aboutPath, html(""));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Only "bugs" is enabled, which has exactly one dynamic check (console-errors) — keeps the
// browser work in this test to a minimum while still exercising the real cache/browser path.
function config() {
  return buildConfig(tmpDir, {
    target: { outputDir: "dist" },
    categories: {
      performance: false,
      security: false,
      accessibility: false,
      bugs: true,
      seo: false,
      maintainability: false,
      privacy: false,
    },
  });
}

function collectEvents() {
  const events: ProgressEvent[] = [];
  return { events, onProgress: (e: ProgressEvent) => events.push(e) };
}

function pageEventTypes(events: ProgressEvent[], type: ProgressEvent["type"]): string[] {
  return events
    .filter((e): e is Extract<ProgressEvent, { pageInfo: { urlPath: string } }> => e.type === type && "pageInfo" in e)
    .map((e) => e.pageInfo.urlPath);
}

describe("dynamic check page-level caching", () => {
  it("re-checks every page on the first run, and populates the cache", async () => {
    const { events, onProgress } = collectEvents();
    const result = await runVortix(config(), onProgress);

    expect(pageEventTypes(events, "dynamic-page-start").sort()).toEqual(["/", "/about/"]);
    expect(pageEventTypes(events, "dynamic-page-cached")).toEqual([]);
    expect(result.pagesChecked).toBe(2);
    expect(result.pagesCached).toBe(0);
    expect(findingsFor(result.findings, "bugs.console-errors").length).toBe(1);
  }, 30000);

  it("serves every page from cache on an unchanged second run, keeping prior findings", async () => {
    await runVortix(config());

    const { events, onProgress } = collectEvents();
    const result = await runVortix(config(), onProgress);

    expect(pageEventTypes(events, "dynamic-page-start")).toEqual([]);
    expect(pageEventTypes(events, "dynamic-page-cached").sort()).toEqual(["/", "/about/"]);
    expect(result.pagesChecked).toBe(2);
    expect(result.pagesCached).toBe(2);
    expect(findingsFor(result.findings, "bugs.console-errors").length).toBe(1);
  }, 30000);

  it("re-checks only the page whose content changed, and keeps the other page cached", async () => {
    await runVortix(config());

    writeFileSync(aboutPath, html("<script>throw new Error('now broken too')</script>"));

    const { events, onProgress } = collectEvents();
    const result = await runVortix(config(), onProgress);

    expect(pageEventTypes(events, "dynamic-page-start")).toEqual(["/about/"]);
    expect(pageEventTypes(events, "dynamic-page-cached")).toEqual(["/"]);
    expect(result.pagesChecked).toBe(2);
    expect(result.pagesCached).toBe(1);
    expect(findingsFor(result.findings, "bugs.console-errors").length).toBe(2);
  }, 30000);

  it("keeps an earlier page's cached findings even if the browser fails to launch for a later, changed page in the same run", async () => {
    await runVortix(config());

    // Force a cache miss on "/about/" only — "/" (iterated first) stays a cache hit.
    writeFileSync(aboutPath, html("<script>throw new Error('now broken too')</script>"));

    const launchSpy = vi.spyOn(chromium, "launch").mockImplementationOnce(async () => {
      throw new Error("simulated: browser unavailable");
    });
    try {
      const result = await runVortix(config());

      // "/"'s cached finding must survive and must not be reported as skipped, even though the
      // browser never came up for "/about/".
      expect(findingsFor(result.findings, "bugs.console-errors").length).toBe(1);
      expect(result.skipped["bugs.console-errors"]).toBeUndefined();
      expect(result.pagesCached).toBe(1);
    } finally {
      launchSpy.mockRestore();
    }
  }, 30000);
});
