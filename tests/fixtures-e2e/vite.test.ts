import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const cwd = fixturePath("vite");

describe("vite fixture (vite.config.js, dist/)", () => {
  it("detects the vite adapter and its seeded issues", async () => {
    const result = await runVortix(buildConfig(cwd));

    expect(result.adapterName).toBe("vite");
    expect(result.totalPages).toBe(1);

    expect(findingsFor(result.findings, "seo.meta-tags").some((f) => f.message.includes("Open Graph"))).toBe(true);
    expect(findingsFor(result.findings, "bugs.broken-links").some((f) => f.message.includes("/app-bundle.js"))).toBe(true);
    expect(findingsFor(result.findings, "seo.structured-data").length).toBe(1);
  }, 30000);
});
