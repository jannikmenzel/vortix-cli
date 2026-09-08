import { buildScoreCard } from "@core/report.js";
import type { RunResult } from "@core/runner.js";
import type { CheckSummary, Finding } from "@core/types.js";
import { describe, expect, it } from "vitest";

const CHECKS: CheckSummary[] = [
  { id: "perf.a", name: "Perf A", category: "performance", mode: "static" },
  { id: "sec.a", name: "Sec A", category: "security", mode: "static" },
  { id: "a11y.a", name: "A11y A", category: "accessibility", mode: "dynamic" },
  { id: "bugs.a", name: "Bugs A", category: "bugs", mode: "static" },
  { id: "seo.a", name: "SEO A", category: "seo", mode: "static" },
  { id: "maint.a", name: "Maint A", category: "maintainability", mode: "static" },
  { id: "privacy.a", name: "Privacy A", category: "privacy", mode: "dynamic" },
];

function buildResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    findings: [],
    details: [],
    checks: CHECKS,
    skipped: {},
    adapterName: "astro",
    outputDir: "/dist",
    pagesChecked: 3,
    totalPages: 3,
    exitCode: 0,
    configErrors: [],
    ...overrides,
  };
}

describe("buildScoreCard", () => {
  it("renders every row (border, grade art, category grid, notes) at the same visible width", () => {
    const findings: Finding[] = [
      { checkId: "perf.a", category: "performance", severity: "warn", message: "slow" },
      { checkId: "a11y.a", category: "accessibility", severity: "error", message: "contrast" },
    ];
    const card = buildScoreCard(buildResult({ findings }), false);
    const widths = new Set(card.split("\n").map((line) => line.length));
    expect(widths.size).toBe(1);
  });

  it("still renders every row at the same width when the notes section adds wrapped text", () => {
    // liveUrl unset + a live-mode check present triggers the "live checks were skipped" note,
    // the longest text block the card ever wraps.
    const checksWithLive: CheckSummary[] = [...CHECKS, { id: "sec.headers", name: "Headers", category: "security", mode: "live" }];
    const card = buildScoreCard(buildResult({ checks: checksWithLive }), false);
    const widths = new Set(card.split("\n").map((line) => line.length));
    expect(widths.size).toBe(1);
  });

  it("centers the score/grade/count lines against the taller block-letter glyph instead of leaving them stacked at the top", () => {
    const card = buildScoreCard(buildResult(), false);
    const lines = card.split("\n");
    const glyphLines = lines.filter((l) => /[█]{2,}/.test(l));
    const scoreLineIndex = lines.findIndex((l) => l.includes("100/100"));

    expect(glyphLines.length).toBeGreaterThan(0);
    expect(scoreLineIndex).toBeGreaterThan(0);
    // Centered vertically means the score line sits strictly between the glyph's first and last rows.
    expect(lines.indexOf(glyphLines[0])).toBeLessThan(scoreLineIndex);
    expect(lines.indexOf(glyphLines[glyphLines.length - 1])).toBeGreaterThan(scoreLineIndex);
  });

  it("lays the category grid out in fixed-width aligned columns, not a ragged greedy wrap", () => {
    const card = buildScoreCard(buildResult(), false);
    const lines = card.split("\n");

    const row1 = lines.find((l) => l.includes("performance"));
    const row2 = lines.find((l) => l.includes("bugs"));
    expect(row1).toBeDefined();
    expect(row2).toBeDefined();

    // Both rows are full (3 categories each), so their first and second columns must start at
    // identical offsets for the grid to actually look like a grid.
    expect((row1 as string).indexOf("performance")).toBe((row2 as string).indexOf("bugs"));
    expect((row1 as string).indexOf("security")).toBe((row2 as string).indexOf("seo"));
  });
});
