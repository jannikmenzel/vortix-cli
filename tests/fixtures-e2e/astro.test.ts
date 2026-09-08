import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const cwd = fixturePath("astro");

describe("astro fixture (astro.config.mjs, dist/)", () => {
  it("detects the astro adapter and every seeded issue", async () => {
    const result = await runVortix(buildConfig(cwd));

    expect(result.adapterName).toBe("astro");
    expect(result.totalPages).toBe(3);

    expect(findingsFor(result.findings, "bugs.broken-links").length).toBeGreaterThanOrEqual(2);
    const anchorLinks = findingsFor(result.findings, "bugs.anchor-links");
    expect(anchorLinks.length).toBe(1);
    // Regression: an id containing "." is valid in HTML and must still resolve. A naive
    // `#${id}` selector parses it as a compound id and class selector and wrongly flags it.
    expect(anchorLinks.every((f) => !f.message.includes("section.intro"))).toBe(true);

    const nested = findingsFor(result.findings, "bugs.nested-block-elements");
    expect(nested.some((f) => f.message.includes("Interactive element"))).toBe(true);
    expect(nested.some((f) => /nested inside inline "<SPAN>"/i.test(f.message))).toBe(true);
    expect(nested.some((f) => /nested inside inline "<A>"/i.test(f.message))).toBe(false);

    expect(findingsFor(result.findings, "bugs.viewport-meta").length).toBe(1);
    expect(findingsFor(result.findings, "bugs.console-errors").length).toBe(2);

    const metaTags = findingsFor(result.findings, "seo.meta-tags");
    expect(metaTags.some((f) => f.message.includes("description"))).toBe(true);
    expect(metaTags.some((f) => f.message.includes("Open Graph"))).toBe(true);
    expect(metaTags.some((f) => f.message.includes("characters long"))).toBe(true);
    expect(metaTags.every((f) => f.severity === "warn")).toBe(true);

    const canonical = findingsFor(result.findings, "seo.canonical-url");
    expect(canonical.some((f) => f.message.includes("Missing canonical"))).toBe(true);
    expect(canonical.some((f) => f.message.includes("Duplicate canonical"))).toBe(true);

    expect(findingsFor(result.findings, "seo.og-images").some((f) => f.message.includes("not found"))).toBe(true);
    expect(findingsFor(result.findings, "seo.structured-data").length).toBe(1);
    expect(findingsFor(result.findings, "seo.robots-sitemap").length).toBe(2);

    expect(findingsFor(result.findings, "performance.image-format").some((f) => f.message.includes("photo.jpg"))).toBe(true);

    const lazyLoading = findingsFor(result.findings, "performance.lazy-loading");
    expect(lazyLoading.some((f) => f.message.includes("photo.jpg") && f.message.includes("below the fold"))).toBe(true);
    expect(lazyLoading.some((f) => f.message.includes("icon.svg") && f.message.includes("visible without scrolling"))).toBe(true);

    expect(findingsFor(result.findings, "performance.asset-weight").length).toBeGreaterThan(0);

    expect(findingsFor(result.findings, "accessibility.axe").length).toBeGreaterThan(0);
    expect(findingsFor(result.findings, "accessibility.color-contrast").length).toBeGreaterThan(0);
    expect(findingsFor(result.findings, "privacy.fingerprinting").length).toBe(1);

    const deadCss = findingsFor(result.findings, "maintainability.dead-css");
    expect(deadCss.some((f) => f.message.includes("unused-ghost-class"))).toBe(true);
    expect(deadCss.some((f) => f.message.includes('".card"'))).toBe(false);

    expect(findingsFor(result.findings, "maintainability.duplication").length).toBeGreaterThan(0);

    expect(result.skipped["security.dependency-vulnerabilities"]).toBeDefined();
    expect(result.skipped["maintainability.outdated-dependencies"]).toBeDefined();
    expect(result.skipped["maintainability.license-check"]).toBeDefined();

    expect(result.checks.some((c) => c.id === "performance.third-party-impact")).toBe(true);
    expect(result.checks.some((c) => c.id === "privacy.tracker-requests")).toBe(true);

    // fonts.googleapis.com and friends come from a hardcoded host list (see PROBLEMS.md). This
    // hermetic run makes no external network call, so the check reports nothing.
    expect(result.checks.some((c) => c.id === "privacy.external-fonts")).toBe(true);
    expect(findingsFor(result.findings, "privacy.external-fonts").length).toBe(0);
  }, 30000);

  it("flags an LCP budget breach (core-web-vitals is timing-based, so the budget is deliberately unmeetable)", async () => {
    const result = await runVortix(
      buildConfig(cwd, {
        categories: {
          performance: true,
          security: false,
          accessibility: false,
          bugs: false,
          seo: false,
          maintainability: false,
          privacy: false,
        },
        disabledChecks: [
          "performance.third-party-impact",
          "performance.asset-weight",
          "performance.image-format",
          "performance.lazy-loading",
        ],
        performance: { budgets: { lcpMs: 1, cls: 0.1, maxPageWeightKb: 1500, maxImageKb: 300 } },
      })
    );

    const vitals = findingsFor(result.findings, "performance.core-web-vitals");
    expect(vitals.length).toBeGreaterThan(0);
    expect(vitals.some((f) => f.message.includes("LCP"))).toBe(true);
  }, 30000);
});
