import type { Category, CheckSummary, Finding, Severity } from "./types.js";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Score {
  value: number;
  grade: Grade;
  cappedByError: boolean;
}

const CHECK_SCORE: Record<"pass" | Severity, number> = {
  pass: 100,
  info: 90,
  warn: 60,
  error: 20,
};

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, warn: 1, error: 2 };
const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function computeScore(checks: CheckSummary[], findings: Finding[], skippedCheckIds: ReadonlySet<string> = new Set()): Score {
  const scoredChecks = checks.filter((check) => !skippedCheckIds.has(check.id));
  if (scoredChecks.length === 0) return { value: 100, grade: "A", cappedByError: false };

  const worstByCheck = new Map<string, Severity>();
  for (const finding of findings) {
    if (skippedCheckIds.has(finding.checkId)) continue;
    const current = worstByCheck.get(finding.checkId);
    if (!current || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[current]) {
      worstByCheck.set(finding.checkId, finding.severity);
    }
  }

  const checksByCategory = new Map<Category, CheckSummary[]>();
  for (const check of scoredChecks) {
    const list = checksByCategory.get(check.category);
    if (list) list.push(check);
    else checksByCategory.set(check.category, [check]);
  }

  // Averaged per category, then across categories, so a category with many checks (e.g. seo)
  // doesn't outweigh one with few (e.g. privacy) in the overall score.
  const categoryScores = [...checksByCategory.values()].map((categoryChecks) => {
    const total = categoryChecks.reduce((sum, check) => {
      const worst = worstByCheck.get(check.id);
      return sum + (worst ? CHECK_SCORE[worst] : CHECK_SCORE.pass);
    }, 0);
    return total / categoryChecks.length;
  });

  const value = Math.round(categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length);
  const hasErrorFinding = [...worstByCheck.values()].some((severity) => severity === "error");
  const naturalGrade = toGrade(value);
  // Any error-severity finding caps the grade at C, regardless of the numeric score, so one
  // critical issue can't be averaged away by an otherwise clean run.
  const grade = hasErrorFinding ? worseOf(naturalGrade, "C") : naturalGrade;

  return { value, grade, cappedByError: hasErrorFinding && GRADE_RANK[naturalGrade] > GRADE_RANK.C };
}

function toGrade(value: number): Grade {
  if (value >= 90) return "A";
  if (value >= 80) return "B";
  if (value >= 70) return "C";
  if (value >= 60) return "D";
  return "F";
}

function worseOf(a: Grade, b: Grade): Grade {
  return GRADE_RANK[a] <= GRADE_RANK[b] ? a : b;
}
