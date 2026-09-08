import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const cwd = fixturePath("jekyll");

describe("jekyll fixture (_config.yml, _site/)", () => {
  it("detects the jekyll adapter and its seeded issues", async () => {
    const result = await runVortix(buildConfig(cwd));

    expect(result.adapterName).toBe("jekyll");
    expect(result.totalPages).toBe(1);

    expect(findingsFor(result.findings, "seo.meta-tags").some((f) => f.message.includes("description"))).toBe(true);
    expect(findingsFor(result.findings, "bugs.broken-links").some((f) => f.message.includes("/missing.png"))).toBe(true);
    expect(findingsFor(result.findings, "seo.canonical-url").some((f) => f.message.includes("Missing canonical"))).toBe(true);
  }, 30000);
});
