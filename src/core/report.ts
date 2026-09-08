import { divider, padVisible, renderBox, visibleLength, wrapPlainText } from "@utils/box.js";
import pc from "picocolors";
import { t } from "./messages.js";
import type { RunResult } from "./runner.js";
import { computeScore, type Grade, type Score, SEVERITY_RANK } from "./score.js";
import type { CheckDetail, CheckMode, CheckSummary, Finding, Severity } from "./types.js";
import { CATEGORIES } from "./types.js";

const SEVERITY_COLOR: Record<Severity, (text: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.gray,
};

const SEVERITY_ICON: Record<Severity, string> = { error: "✖", warn: "⚠", info: "ℹ" };
const PASS_ICON = pc.green("✔");
const SKIP_ICON = pc.gray("⊘");

const MODE_COLOR: Record<CheckMode, (text: string) => string> = {
  static: pc.cyan,
  dynamic: pc.magenta,
  live: pc.blue,
};

function modeBadge(mode: CheckMode): string {
  return MODE_COLOR[mode](`[${mode}]`);
}

const GRADE_COLOR: Record<Grade, (text: string) => string> = {
  A: pc.green,
  B: pc.green,
  C: pc.yellow,
  D: pc.yellow,
  F: pc.red,
};

// Hand-drawn 4x5 block-letter glyphs used for the scorecard's grade badge.
const GRADE_ART: Record<Grade, string[]> = {
  A: [" ██ ", "█  █", "████", "█  █", "█  █"],
  B: ["███ ", "█  █", "███ ", "█  █", "███ "],
  C: ["███ ", "█   ", "█   ", "█   ", "███ "],
  D: ["███ ", "█  █", "█  █", "█  █", "███ "],
  F: ["████", "█   ", "███ ", "█   ", "█   "],
};

const MAX_EXAMPLE_MESSAGE_LENGTH = 70;
// Fixed content width the scorecard wraps to, so it stays readable instead of stretching to
// whatever the longest note or category line happens to be.
const SCORECARD_WIDTH = 64;

export function printReport(result: RunResult): void {
  const lines: string[] = [];

  for (const message of result.configErrors) {
    lines.push(pc.yellow(`⚠ ${t("report.configErrorPrefix")}: ${message}`));
  }
  if (result.configErrors.length > 0) lines.push("");

  lines.push(pc.bold(`\n${buildHeader(result)}\n`));
  lines.push(buildScoreCard(result));
  lines.push("");

  const findingsByCheck = groupBy(result.findings, (f) => f.checkId);
  const checksByCategory = groupBy(result.checks, (c) => c.category);

  for (const category of CATEGORIES) {
    const checks = checksByCategory.get(category);
    if (!checks) continue;

    lines.push(pc.bold(category.toUpperCase()));
    for (const check of checks) {
      const skipReason = result.skipped[check.id];
      lines.push(skipReason ? skipLine(check, skipReason) : checkLine(check, findingsByCheck.get(check.id) ?? []));
    }
    lines.push("");
  }

  console.log(lines.join("\n"));
}

const GRADE_ART_GAP = "    ";
const CATEGORY_GRID_COLUMNS = 3;
const CATEGORY_GRID_GAP = "   ";

/**
 * Renders the score summary as a bordered box with a block-letter grade badge. Printed as soon
 * as the checks finish, rather than behind the interactive "Done" step.
 */
export function buildScoreCard(result: RunResult, color = true): string {
  const skippedIds = new Set(Object.keys(result.skipped));
  const score = computeScore(result.checks, result.findings, skippedIds);
  const counts = countBySeverity(result.findings);
  const gradeColor = GRADE_COLOR[score.grade];

  const infoLines = [
    color ? pc.bold(`${score.value}/100`) : `${score.value}/100`,
    color ? gradeColor(pc.bold(`Grade ${score.grade}`)) : `Grade ${score.grade}`,
    `${pluralize(counts.error, "error", "errors")}, ${pluralize(counts.warn, "warning", "warnings")}, ${pluralize(counts.info, "notice", "notices")}`,
  ];

  const art = GRADE_ART[score.grade];
  // Center the 3 info lines vertically against the taller letter glyph instead of stacking them
  // flush against its top, which used to leave one lone blank glyph row dangling at the bottom.
  const topPad = Math.floor((art.length - infoLines.length) / 2);
  const lines: string[] = [];
  for (let i = 0; i < art.length; i++) {
    const artLine = color ? gradeColor(art[i]) : art[i];
    const info = infoLines[i - topPad] ?? "";
    lines.push(`${artLine}${GRADE_ART_GAP}${info}`);
  }

  lines.push("");
  lines.push(color ? pc.dim(t("report.byCategoryLabel")) : t("report.byCategoryLabel"));
  lines.push(...buildCategoryGrid(result, color));

  const notes = scoreNotes(result, score);
  if (notes.length > 0) {
    lines.push("");
    for (const note of notes) {
      for (const wrapped of wrapPlainText(note, SCORECARD_WIDTH)) lines.push(color ? pc.dim(wrapped) : wrapped);
    }
  }

  return renderBox(lines, { title: t("report.overallScoreLabel").toUpperCase(), minWidth: SCORECARD_WIDTH, padding: 2 });
}

/** Lays categories out in a fixed-width grid instead of greedily bin-packing them, so column edges line up instead of the row wrap falling wherever the next chunk happens to stop fitting. */
function buildCategoryGrid(result: RunResult, color: boolean): string[] {
  const findingsByCheck = groupBy(result.findings, (f) => f.checkId);
  const checksByCategory = groupBy(result.checks, (c) => c.category);

  const cells: string[] = [];
  for (const category of CATEGORIES) {
    const checks = checksByCategory.get(category);
    if (!checks) continue;

    const active = checks.filter((c) => !result.skipped[c.id]);
    if (active.length === 0) {
      cells.push(color ? pc.gray(`${SKIP_ICON} ${category}`) : `⊘ ${category}`);
      continue;
    }

    let worst: Severity | undefined;
    for (const check of active) {
      for (const finding of findingsByCheck.get(check.id) ?? []) {
        if (!worst || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst]) worst = finding.severity;
      }
    }

    const icon = worst ? SEVERITY_ICON[worst] : "✔";
    const text = `${icon} ${category}`;
    cells.push(color ? (worst ? SEVERITY_COLOR[worst](text) : pc.green(text)) : text);
  }

  const columnWidth = Math.max(...cells.map(visibleLength));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += CATEGORY_GRID_COLUMNS) {
    const rowCells = cells.slice(i, i + CATEGORY_GRID_COLUMNS);
    rows.push(rowCells.map((cell, j) => (j === rowCells.length - 1 ? cell : padVisible(cell, columnWidth))).join(CATEGORY_GRID_GAP));
  }
  return rows;
}

type StatusKey = "error" | "warn" | "info" | "pass" | "skip";

const STATUS_TAG: Record<StatusKey, string> = {
  error: "[FAILED]",
  warn: "[WARN]  ",
  info: "[INFO]  ",
  pass: "[PASS]  ",
  skip: "[SKIP]  ",
};

const STATUS_COLOR: Record<StatusKey, (text: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
  pass: pc.green,
  skip: pc.gray,
};

export function checkOptionLabel(check: CheckSummary, findings: Finding[], skipReason?: string): { label: string; hint: string } {
  const key: StatusKey = skipReason ? "skip" : findings.length === 0 ? "pass" : worstSeverity(countBySeverity(findings));
  const status = skipReason ? "skipped" : findings.length === 0 ? "passed" : severitySummary(countBySeverity(findings));
  return { label: `${STATUS_COLOR[key](STATUS_TAG[key])} ${check.name}`, hint: `${check.category} · ${check.mode} · ${status}` };
}

export function buildFullReport(result: RunResult): string {
  const lines: string[] = [];

  for (const message of result.configErrors) {
    lines.push(`⚠ ${t("report.configErrorPrefix")}: ${message}`);
  }
  if (result.configErrors.length > 0) lines.push("");

  lines.push(t("report.header", { adapter: result.adapterName, totalPages: result.totalPages, pagesChecked: result.pagesChecked }));
  lines.push("");
  lines.push(buildScoreCard(result, false));
  lines.push("");

  const findingsByCheck = groupBy(result.findings, (f) => f.checkId);
  const checksByCategory = groupBy(result.checks, (c) => c.category);

  for (const category of CATEGORIES) {
    const checks = checksByCategory.get(category);
    if (!checks) continue;

    lines.push(category.toUpperCase());
    for (const check of checks) {
      const skipReason = result.skipped[check.id];
      if (skipReason) {
        lines.push(`  ⊘ ${check.name} [${check.mode}] — skipped: ${skipReason}`);
        continue;
      }

      const findings = findingsByCheck.get(check.id) ?? [];
      if (findings.length === 0) {
        lines.push(`  ✔ ${check.name} [${check.mode}]`);
        continue;
      }

      lines.push(`  ${SEVERITY_ICON[worstSeverity(countBySeverity(findings))]} ${check.name} [${check.mode}]`);
      for (const finding of findings) {
        const location = [finding.file, finding.url].filter(Boolean).join(" ");
        lines.push(`      - [${finding.severity}] ${finding.message}${location ? ` (${location})` : ""}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildHeader(result: RunResult): string {
  const header = t("report.header", { adapter: result.adapterName, totalPages: result.totalPages, pagesChecked: result.pagesChecked });
  const hasLiveChecks = result.checks.some((c) => c.mode === "live");
  if (hasLiveChecks && result.liveUrl) {
    return header + t("report.headerLiveSuffix", { url: result.liveUrl });
  }
  return header;
}

function scoreNotes(result: RunResult, score: Score): string[] {
  const notes: string[] = [];
  if (score.cappedByError) notes.push(`(${t("report.scoreCappedNote")})`);
  if (result.pagesChecked < result.totalPages) {
    notes.push(t("report.scorePartialPagesNote", { pagesChecked: result.pagesChecked, totalPages: result.totalPages }));
  }
  const hasLiveChecks = result.checks.some((c) => c.mode === "live");
  if (hasLiveChecks && !result.liveUrl) {
    notes.push(t("report.scoreLiveSkippedNote"));
  }
  return notes;
}

function skipLine(check: CheckSummary, reason: string): string {
  return `  ${SKIP_ICON} ${check.name} ${modeBadge(check.mode)} ${pc.dim(`— skipped: ${reason}`)}`;
}

function checkLine(check: CheckSummary, findings: Finding[]): string {
  if (findings.length === 0) {
    return `  ${PASS_ICON} ${check.name} ${modeBadge(check.mode)}`;
  }

  const counts = countBySeverity(findings);
  const worst = worstSeverity(counts);
  const summary = severitySummary(counts);
  const topFinding = findings.find((f) => f.severity === worst) ?? findings[0];
  const more = findings.length > 1 ? pc.dim(t("report.moreFindingsSuffix", { count: findings.length - 1 })) : "";

  return `  ${SEVERITY_COLOR[worst](SEVERITY_ICON[worst])} ${check.name} ${modeBadge(check.mode)} ${pc.dim(`— ${summary}:`)} ${truncate(topFinding.message, MAX_EXAMPLE_MESSAGE_LENGTH)}${more}`;
}

export function buildCheckDetail(check: CheckSummary, findings: Finding[], details: CheckDetail[], skipReason?: string): string {
  const counts = countBySeverity(findings);
  const statusKey: StatusKey = skipReason ? "skip" : findings.length === 0 ? "pass" : worstSeverity(counts);
  const statusText = skipReason
    ? t("report.detailStatusSkipped", { reason: skipReason })
    : findings.length === 0
      ? t("report.detailStatusPass")
      : t("report.detailStatusIssues", { summary: severitySummary(counts) });

  const lines: string[] = [];

  // Summary block, always first: overall status before any per-finding detail.
  lines.push(`${STATUS_COLOR[statusKey](STATUS_TAG[statusKey].trim())}  ${pc.bold(check.name)}`);
  lines.push(pc.dim(`${check.category} · ${modeBadge(check.mode)}${check.description ? ` · ${check.description}` : ""}`));
  lines.push(statusText);

  lines.push(pc.dim(divider()));
  lines.push(pc.bold(t("report.detailFindingsHeader")));
  if (findings.length === 0) {
    lines.push(`  ${t("report.detailNoFindings")}`);
  } else {
    for (const finding of findings) {
      const location = [finding.file, finding.url].filter(Boolean).join(" ");
      lines.push(
        `  ${SEVERITY_COLOR[finding.severity](SEVERITY_ICON[finding.severity])} [${finding.severity}] ${finding.message}${location ? ` ${pc.dim(`(${location})`)}` : ""}`
      );
    }
  }

  lines.push(pc.dim(divider()));
  lines.push(pc.bold(t("report.detailValuesHeader")));
  if (details.length === 0) {
    lines.push(`  ${t("report.detailNoValues")}`);
  } else {
    for (const line of aggregateDetailLines(details)) lines.push(`  ${line}`);
  }

  return lines.join("\n");
}

function aggregateDetailLines(details: CheckDetail[]): string[] {
  const byLabel = groupBy(details, (d) => d.label);
  const lines: string[] = [];

  for (const [label, group] of byLabel) {
    if (group.length === 1) {
      lines.push(`${label}: ${pc.bold(group[0].value)}`);
      continue;
    }

    const parsed = group.map((entry) => parseLeadingNumber(entry.value));
    if (parsed.every((p): p is { num: number; rest: string } => p !== null)) {
      const nums = parsed.map((p) => p?.num);
      const rest = parsed[0]?.rest;
      const med = formatNum(median(nums));
      const avg = formatNum(nums.reduce((a, b) => a + b, 0) / nums.length);
      lines.push(`${label}: median ${pc.bold(med + rest)}, avg ${pc.bold(avg + rest)} ${pc.dim(`(${group.length} pages)`)}`);
      continue;
    }

    const distinct = [...new Set(group.map((entry) => entry.value))];
    if (distinct.length === 1) {
      lines.push(`${label}: ${pc.bold(distinct[0])} ${pc.dim(`(${group.length} pages)`)}`);
    } else {
      const sample = distinct
        .slice(0, 3)
        .map((v) => `"${v}"`)
        .join(", ");
      lines.push(
        `${label}: ${distinct.length} different values ${pc.dim(`across ${group.length} pages, e.g. ${sample}${distinct.length > 3 ? ", ..." : ""}`)}`
      );
    }
  }

  return lines;
}

function parseLeadingNumber(value: string): { num: number; rest: string } | null {
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  return { num: Number(match[1]), rest: match[2] };
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function worstSeverity(counts: Record<Severity, number>): Severity {
  if (counts.error > 0) return "error";
  if (counts.warn > 0) return "warn";
  return "info";
}

function severitySummary(counts: Record<Severity, number>): string {
  return [
    counts.error > 0 && pluralize(counts.error, "error", "errors"),
    counts.warn > 0 && pluralize(counts.warn, "warning", "warnings"),
    counts.info > 0 && pluralize(counts.info, "notice", "notices"),
  ]
    .filter(Boolean)
    .join(", ");
}

function truncate(message: string, max: number): string {
  return message.length > max ? `${message.slice(0, max - 1)}…` : message;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warn: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}
