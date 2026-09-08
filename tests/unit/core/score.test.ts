import { computeScore } from "@core/score.js";
import type { CheckSummary, Finding } from "@core/types.js";
import { describe, expect, it } from "vitest";

const checks: CheckSummary[] = [
  { id: "a", name: "A", category: "performance", mode: "static" },
  { id: "b", name: "B", category: "security", mode: "static" },
];

describe("computeScore", () => {
  it("returns 100/A when no findings", () => {
    const score = computeScore(checks, []);
    expect(score.value).toBe(100);
    expect(score.grade).toBe("A");
    expect(score.cappedByError).toBe(false);
  });

  it("returns lower score for warn findings", () => {
    const findings: Finding[] = [{ checkId: "a", category: "performance", severity: "warn", message: "test" }];
    const score = computeScore(checks, findings);
    expect(score.value).toBeLessThan(100);
    expect(score.grade).not.toBe("A");
  });

  it("caps grade at C when error exists and natural grade is better", () => {
    const manyChecks: CheckSummary[] = [
      { id: "a", name: "A", category: "performance", mode: "static" },
      { id: "b", name: "B", category: "security", mode: "static" },
      { id: "c", name: "C", category: "bugs", mode: "static" },
      { id: "d", name: "D", category: "seo", mode: "static" },
      { id: "e", name: "E", category: "maintainability", mode: "static" },
    ];
    const findings: Finding[] = [{ checkId: "a", category: "performance", severity: "error", message: "test" }];
    const score = computeScore(manyChecks, findings);
    expect(score.grade).toBe("C");
    expect(score.cappedByError).toBe(true);
  });

  it("does not cap when natural grade is already C or worse", () => {
    const findings: Finding[] = [{ checkId: "a", category: "performance", severity: "error", message: "test" }];
    const score = computeScore(checks, findings);
    expect(score.cappedByError).toBe(false);
  });

  it("excludes skipped checks from scoring", () => {
    const findings: Finding[] = [{ checkId: "a", category: "performance", severity: "error", message: "test" }];
    const score = computeScore(checks, findings, new Set(["a"]));
    expect(score.value).toBe(100);
    expect(score.grade).toBe("A");
    expect(score.cappedByError).toBe(false);
  });

  it("averages categories equally regardless of check count", () => {
    const manyChecks: CheckSummary[] = [
      { id: "a1", name: "A1", category: "performance", mode: "static" },
      { id: "a2", name: "A2", category: "performance", mode: "static" },
      { id: "b1", name: "B1", category: "security", mode: "static" },
    ];
    const findings: Finding[] = [{ checkId: "a1", category: "performance", severity: "warn", message: "test" }];
    const score = computeScore(manyChecks, findings);
    expect(score.value).toBe(90);
  });
});
