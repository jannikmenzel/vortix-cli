import { createDetailFactory } from "@core/detail.js";
import type { CheckDefinition, CheckDetail } from "@core/types.js";
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

describe("createDetailFactory", () => {
  it("stamps checkId and category from check definition", () => {
    const details: CheckDetail[] = [];
    const detail = createDetailFactory(makeCheck({ id: "seo.meta-tags", category: "seo" }), (d) => details.push(d));
    detail({ label: "Title", value: "Home" });
    expect(details).toEqual([{ checkId: "seo.meta-tags", category: "seo", label: "Title", value: "Home", url: undefined }]);
  });

  it("passes through url", () => {
    const details: CheckDetail[] = [];
    const detail = createDetailFactory(makeCheck(), (d) => details.push(d));
    detail({ label: "LCP", value: "1240ms", url: "/about" });
    expect(details[0].url).toBe("/about");
  });

  it("pushes every call, allowing multiple details per check", () => {
    const details: CheckDetail[] = [];
    const detail = createDetailFactory(makeCheck(), (d) => details.push(d));
    detail({ label: "LCP", value: "1240ms" });
    detail({ label: "CLS", value: "0.05" });
    expect(details).toHaveLength(2);
  });
});
