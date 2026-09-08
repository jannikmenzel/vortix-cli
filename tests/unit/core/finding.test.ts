import { createFindingFactory } from "@core/finding.js";
import type { CheckDefinition } from "@core/types.js";
import { describe, expect, it } from "vitest";

function makeCheck(overrides: Partial<CheckDefinition> = {}): CheckDefinition {
  return {
    id: "test.check",
    category: "bugs",
    mode: "static",
    severity: "warn",
    ...overrides,
  } as CheckDefinition;
}

describe("createFindingFactory", () => {
  it("uses check default severity when nothing else is specified", () => {
    const finding = createFindingFactory(makeCheck(), undefined);
    const result = finding({ message: "test" });
    expect(result.severity).toBe("warn");
  });

  it("uses per-finding severity over check default", () => {
    const finding = createFindingFactory(makeCheck(), undefined);
    const result = finding({ message: "test", severity: "info" });
    expect(result.severity).toBe("info");
  });

  it("config override always wins over per-finding severity", () => {
    const finding = createFindingFactory(makeCheck(), "error");
    const result = finding({ message: "test", severity: "info" });
    expect(result.severity).toBe("error");
  });

  it("config override wins over check default", () => {
    const finding = createFindingFactory(makeCheck({ severity: "info" }), "error");
    const result = finding({ message: "test" });
    expect(result.severity).toBe("error");
  });

  it("falls back to warn when check has no severity and no config", () => {
    const finding = createFindingFactory(makeCheck({ severity: undefined }), undefined);
    const result = finding({ message: "test" });
    expect(result.severity).toBe("warn");
  });

  it("stamps checkId and category from check definition", () => {
    const finding = createFindingFactory(makeCheck({ id: "seo.meta-tags", category: "seo" }), undefined);
    const result = finding({ message: "test" });
    expect(result.checkId).toBe("seo.meta-tags");
    expect(result.category).toBe("seo");
  });

  it("passes through file and url", () => {
    const finding = createFindingFactory(makeCheck(), undefined);
    const result = finding({ message: "test", file: "index.html", url: "/" });
    expect(result.file).toBe("index.html");
    expect(result.url).toBe("/");
  });
});
