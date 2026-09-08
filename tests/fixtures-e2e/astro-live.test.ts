import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConfig, findingsFor } from "./support.js";

// The five "live" checks evaluate a fetched HTTP response rather than the build output, so the
// response is stubbed instead of hitting a real server, as in
// tests/fixtures-e2e/live-checks.test.ts. What ties this case to Astro is the astro.config.mjs
// in the fixture directory, which makes adapter detection resolve to "astro" (see
// src/adapters/index.ts).
let tmpDir: string;

function makeAstroFixture(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vortix-astro-live-"));
  writeFileSync(path.join(dir, "astro.config.mjs"), "generated");
  mkdirSync(path.join(dir, "dist"), { recursive: true });
  writeFileSync(path.join(dir, "dist", "index.html"), "<html><head><title>t</title></head><body></body></html>");
  return dir;
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("astro fixture — live checks against a deliberately insecure response", () => {
  it("detects every seeded live-mode issue for the astro adapter", async () => {
    tmpDir = makeAstroFixture();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: async () => '<html><head><script src="http://cdn.example.com/legacy.js"></script></head><body></body></html>',
        headers: {
          forEach: (cb: (value: string, key: string) => void) => {
            cb("Apache/2.4.41 (Ubuntu)", "server");
          },
          getSetCookie: () => ["session=abc123; Path=/"],
        },
      }))
    );

    const result = await runVortix(
      buildConfig(tmpDir, {
        categories: {
          security: true,
          performance: false,
          accessibility: false,
          bugs: false,
          seo: false,
          maintainability: false,
          privacy: false,
        },
      }),
      undefined,
      "https://example.com/"
    );

    expect(result.adapterName).toBe("astro");
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

  it("flags plain HTTP with no redirect to HTTPS for the astro adapter", async () => {
    tmpDir = makeAstroFixture();

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

    const result = await runVortix(
      buildConfig(tmpDir, {
        categories: {
          security: true,
          performance: false,
          accessibility: false,
          bugs: false,
          seo: false,
          maintainability: false,
          privacy: false,
        },
      }),
      undefined,
      "http://example.com/"
    );

    expect(result.adapterName).toBe("astro");
    const httpsFindings = findingsFor(result.findings, "security.https-enforced");
    expect(httpsFindings.length).toBe(1);
    expect(httpsFindings[0].severity).toBe("error");
  }, 15000);
});
