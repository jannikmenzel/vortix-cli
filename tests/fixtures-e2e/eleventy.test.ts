import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const cwd = fixturePath("eleventy");

describe("eleventy fixture (.eleventy.js, _site/)", () => {
  it("detects the eleventy adapter and its seeded issues", async () => {
    const result = await runVortix(buildConfig(cwd));

    expect(result.adapterName).toBe("eleventy");
    expect(result.totalPages).toBe(1);

    expect(findingsFor(result.findings, "bugs.anchor-links").length).toBe(1);
    expect(findingsFor(result.findings, "performance.lazy-loading").some((f) => f.message.includes("photo.png"))).toBe(true);
    expect(findingsFor(result.findings, "performance.image-format").some((f) => f.message.includes("photo.png"))).toBe(true);
  }, 30000);
});
