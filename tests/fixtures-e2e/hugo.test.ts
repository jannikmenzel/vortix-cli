import { runVortix } from "@core/runner.js";
import { describe, expect, it } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const cwd = fixturePath("hugo");

describe("hugo fixture (hugo.toml, public/)", () => {
  it("detects the hugo adapter and its seeded issues", async () => {
    const result = await runVortix(buildConfig(cwd));

    expect(result.adapterName).toBe("hugo");
    expect(result.totalPages).toBe(1);

    expect(findingsFor(result.findings, "bugs.viewport-meta").length).toBe(1);
    expect(findingsFor(result.findings, "bugs.broken-links").some((f) => f.message.includes("/nowhere.html"))).toBe(true);
    expect(findingsFor(result.findings, "performance.image-format").some((f) => f.message.includes("photo.jpg"))).toBe(true);
  }, 30000);
});
