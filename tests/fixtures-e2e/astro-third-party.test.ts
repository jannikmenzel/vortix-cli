import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

// vortix's own static server always binds to "127.0.0.1" (see src/dynamic/serve.ts). A resource
// served from "localhost" uses the same loopback interface but a different hostname string, so
// the checks cannot distinguish it from a genuine cross-origin third party or tracker. That
// makes it a stand-in for one without any real external network call.
function startLoopbackThirdPartyServer(): Promise<{ base: string; close(): Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/iframe.html") {
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><html><body><script src="/nested-tracker.js"></script></body></html>');
        return;
      }
      res.setHeader("Content-Type", "application/javascript");
      res.end("// pretend third-party/tracker script\n");
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        base: `http://localhost:${port}`,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}

async function runWithInjectedHtml(inject: (html: string) => string) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-astro-thirdparty-"));
  cpSync(fixturePath("astro"), tmpDir, { recursive: true });

  const thirdParty = await startLoopbackThirdPartyServer();
  try {
    const indexPath = path.join(tmpDir, "dist", "index.html");
    const html = readFileSync(indexPath, "utf-8");
    writeFileSync(indexPath, inject(html).replace("{{THIRD_PARTY}}", thirdParty.base));

    const result = await runVortix(
      buildConfig(tmpDir, {
        categories: {
          performance: true,
          privacy: true,
          security: false,
          accessibility: false,
          bugs: false,
          seo: false,
          maintainability: false,
        },
        disabledChecks: ["performance.asset-weight", "performance.image-format", "performance.lazy-loading", "performance.core-web-vitals"],
        privacy: { trackerDomains: ["localhost"] },
      })
    );

    return { result, base: thirdParty.base };
  } finally {
    await thirdParty.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("astro fixture — cross-origin network checks", () => {
  it("flags a cross-origin blocking script as both third-party-impact and an unconsented tracker request", async () => {
    const { result, base } = await runWithInjectedHtml((html) =>
      html.replace("</body>", `  <script src="{{THIRD_PARTY}}/tracker.js"></script>\n</body>`)
    );

    expect(result.adapterName).toBe("astro");

    const thirdPartyFindings = findingsFor(result.findings, "performance.third-party-impact");
    expect(thirdPartyFindings.some((f) => f.message.includes(`${base}/tracker.js`))).toBe(true);

    const trackerFindings = findingsFor(result.findings, "privacy.tracker-requests");
    expect(trackerFindings.some((f) => f.message.includes(`${base}/tracker.js`))).toBe(true);
  }, 30000);

  it("does not flag a <script defer> third-party resource as render-blocking, but still flags a synchronous one", async () => {
    const { result, base } = await runWithInjectedHtml((html) =>
      html.replace(
        "</body>",
        `  <script src="{{THIRD_PARTY}}/sync-tracker.js"></script>\n` +
          `  <script defer src="{{THIRD_PARTY}}/defer-tracker.js"></script>\n</body>`
      )
    );

    const thirdPartyFindings = findingsFor(result.findings, "performance.third-party-impact");
    expect(thirdPartyFindings.some((f) => f.message.includes(`${base}/sync-tracker.js`))).toBe(true);
    expect(thirdPartyFindings.some((f) => f.message.includes(`${base}/defer-tracker.js`))).toBe(false);
  }, 30000);

  it("does not flag a script loaded inside a third-party iframe as render-blocking on the parent page", async () => {
    const { result, base } = await runWithInjectedHtml((html) =>
      html.replace("</body>", `  <iframe src="{{THIRD_PARTY}}/iframe.html"></iframe>\n</body>`)
    );

    const thirdPartyFindings = findingsFor(result.findings, "performance.third-party-impact");
    // The iframe document and the script it loads both run in a child frame, so neither can
    // block the parent page's render, regardless of content type.
    expect(thirdPartyFindings.some((f) => f.message.includes(`${base}/iframe.html`))).toBe(false);
    expect(thirdPartyFindings.some((f) => f.message.includes(`${base}/nested-tracker.js`))).toBe(false);
  }, 30000);
});
