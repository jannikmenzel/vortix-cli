import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor } from "./support.js";

// Astro's SSR and hybrid adapters (e.g. @astrojs/node) split the build into `dist/client/`
// (the static assets) and `dist/server/` (the SSR entry), whereas static output mode puts
// everything directly in `dist/`. The split is reproduced by hand here, without installing a
// real Astro adapter, to verify that vortix scans `dist/client/` rather than `dist/`.
describe("astro fixture — SSR adapter output split (dist/client + dist/server)", () => {
  it("resolves internal links against dist/client, not dist/", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-astro-ssr-"));
    try {
      writeFileSync(path.join(tmpDir, "astro.config.mjs"), "generated");

      const clientDir = path.join(tmpDir, "dist", "client");
      mkdirSync(path.join(clientDir, "about"), { recursive: true });
      mkdirSync(path.join(tmpDir, "dist", "server"), { recursive: true });

      writeFileSync(
        path.join(clientDir, "index.html"),
        `<!doctype html><html><head><title>Home</title></head><body><a href="/">Home</a><a href="/about">About</a></body></html>`
      );
      writeFileSync(
        path.join(clientDir, "about", "index.html"),
        `<!doctype html><html><head><title>About</title></head><body><a href="/">Home</a></body></html>`
      );

      const result = await runVortix(
        buildConfig(tmpDir, {
          categories: {
            performance: false,
            security: false,
            accessibility: false,
            bugs: true,
            seo: false,
            maintainability: false,
            privacy: false,
          },
          disabledChecks: ["bugs.anchor-links", "bugs.nested-block-elements", "bugs.viewport-meta", "bugs.console-errors"],
        })
      );

      expect(result.adapterName).toBe("astro");
      expect(result.outputDir).toBe(clientDir);
      expect(result.totalPages).toBe(2);

      // With the previously hardcoded outputDir ("dist"), every absolute-path href here would
      // resolve against `dist/` instead of `dist/client/` and be reported as broken, including
      // the link to "/" on the site's own home page.
      expect(findingsFor(result.findings, "bugs.broken-links")).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30000);
});
