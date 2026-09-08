import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

// Uses the same loopback-as-cross-origin setup as astro-third-party.test.ts: "localhost" reads
// as a different origin than vortix's own "127.0.0.1" static server, with no real network call.
function startLoopbackWidgetServer(): Promise<{ base: string; close(): Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        "<!doctype html><html><body>" +
          '<img src="/x.png">' + // No alt: seeds a second axe "image-alt" violation node.
          '<p style="color: #f0f0f0; background-color: #ffffff;">Low-contrast text inside the third-party widget</p>' +
          "</body></html>"
      );
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

describe("astro fixture — accessibility checks must not scan into third-party iframes", () => {
  it("does not attribute a cross-origin iframe widget's axe/color-contrast violations to the page being checked", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-astro-iframe-a11y-"));
    const widget = await startLoopbackWidgetServer();
    try {
      cpSync(fixturePath("astro"), tmpDir, { recursive: true });

      const indexPath = path.join(tmpDir, "dist", "index.html");
      const html = readFileSync(indexPath, "utf-8");
      writeFileSync(indexPath, html.replace("</body>", `  <iframe src="${widget.base}/widget.html"></iframe>\n</body>`));

      const result = await runVortix(
        buildConfig(tmpDir, {
          categories: {
            performance: false,
            security: false,
            accessibility: true,
            bugs: false,
            seo: false,
            maintainability: false,
            privacy: false,
          },
        })
      );

      // The fixture's own index.html seeds exactly one color-contrast violation and two
      // alt-less images (icon.svg and photo.jpg, reported as "affects 2 element(s)"). Had the
      // iframe's matching violations leaked in, these counts would be higher.
      expect(findingsFor(result.findings, "accessibility.color-contrast").length).toBe(1);

      const axeFindings = findingsFor(result.findings, "accessibility.axe");
      const imageAlt = axeFindings.find((f) => f.message.includes("image-alt"));
      expect(imageAlt?.message).toContain("affects 2 element(s)");
    } finally {
      await widget.close();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30000);
});
