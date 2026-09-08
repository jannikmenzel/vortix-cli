import { severityForOverage } from "@utils/budget.js";
import { describe, expect, it } from "vitest";

describe("severityForOverage", () => {
  it("returns warn when under budget", () => {
    expect(severityForOverage(100, 200)).toBe("warn");
  });

  it("returns warn when exactly at budget", () => {
    expect(severityForOverage(200, 200)).toBe("warn");
  });

  it("returns error when 1.5x over budget", () => {
    expect(severityForOverage(300, 200)).toBe("error");
  });

  it("returns error when well over budget", () => {
    expect(severityForOverage(1000, 200)).toBe("error");
  });

  it("returns error when budget is zero", () => {
    expect(severityForOverage(0, 0)).toBe("error");
    expect(severityForOverage(1, 0)).toBe("error");
  });

  it("handles decimal budgets", () => {
    expect(severityForOverage(0.16, 0.1)).toBe("error");
    expect(severityForOverage(0.14, 0.1)).toBe("warn");
  });
});
