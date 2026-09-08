import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig, findingsFor } from "./support.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-live-fixture-"));
  mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
  writeFileSync(path.join(tmpDir, "dist", "index.html"), "<html><head><title>t</title></head><body></body></html>");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function stubInsecureFetch(url: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status: 200,
      redirected: false,
      url,
      text: async () => '<html><head><script src="http://cdn.example.com/legacy.js"></script></head><body></body></html>',
      headers: {
        forEach: (cb: (value: string, key: string) => void) => {
          cb("Apache/2.4.41 (Ubuntu)", "server");
        },
        getSetCookie: () => ["session=abc123; Path=/"],
      },
    }))
  );
}

describe("live checks against a deliberately insecure response", () => {
  it("detects every seeded issue when a URL is given", async () => {
    stubInsecureFetch("https://example.com/");
    const result = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" } }), undefined, "https://example.com/");

    expect(result.liveUrl).toBe("https://example.com/");

    const headers = findingsFor(result.findings, "security.security-headers");
    expect(headers.length).toBe(6);

    expect(findingsFor(result.findings, "security.server-info-disclosure").some((f) => f.message.includes("Apache/2.4.41"))).toBe(true);

    const cookies = findingsFor(result.findings, "security.cookie-security");
    expect(cookies.length).toBe(3);
    expect(cookies.every((f) => f.message.includes('"session"'))).toBe(true);

    expect(findingsFor(result.findings, "security.mixed-content").some((f) => f.message.includes("cdn.example.com/legacy.js"))).toBe(true);

    expect(findingsFor(result.findings, "security.https-enforced").length).toBe(0);
  }, 15000);

  it("flags plain HTTP with no redirect to HTTPS", async () => {
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
    const httpsFindings = findingsFor(result.findings, "security.https-enforced");
    expect(httpsFindings.length).toBe(1);
    expect(httpsFindings[0].severity).toBe("error");
  }, 15000);

  it("still evaluates the final HTTPS response when the given URL is http:// but redirects to https://", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        redirected: true,
        url: "https://example.com/",
        text: async () => '<html><head><script src="http://cdn.example.com/legacy.js"></script></head><body></body></html>',
        headers: {
          forEach: () => {},
          getSetCookie: () => ["session=abc123; Path=/"],
        },
      }))
    );

    const result = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" } }), undefined, "http://example.com/");

    expect(findingsFor(result.findings, "security.security-headers").some((f) => f.message.includes("Strict-Transport-Security"))).toBe(
      true
    );
    expect(findingsFor(result.findings, "security.cookie-security").some((f) => f.message.includes("Secure attribute"))).toBe(true);
    expect(findingsFor(result.findings, "security.mixed-content").length).toBe(1);
    expect(findingsFor(result.findings, "security.https-enforced").length).toBe(1);
  }, 15000);

  it("skips all five live checks (excluded from the score) when no URL is given", async () => {
    const result = await runVortix(buildConfig(tmpDir, { target: { outputDir: "dist" } }));

    const liveChecks = result.checks.filter((c) => c.mode === "live");
    expect(liveChecks.length).toBe(5);
    for (const check of liveChecks) {
      expect(result.skipped[check.id]).toBeDefined();
    }
    expect(result.findings.some((f) => liveChecks.some((c) => c.id === f.checkId))).toBe(false);
  }, 15000);
});
