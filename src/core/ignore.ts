import { t } from "./messages.js";
import type { Finding, IgnoredFinding, IgnoreRule } from "./types.js";

export interface IgnoreResult {
  kept: Finding[];
  ignored: IgnoredFinding[];
  warnings: string[];
}

interface CompiledRule {
  rule: IgnoreRule;
  label: string;
  pattern?: RegExp;
  used: boolean;
}

export interface IgnoreOptions {
  ranCheckIds?: string[];
  partial?: boolean;
}

const RULE_FIELDS = ["check", "id", "match", "file", "url", "reason", "until"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_LITERAL = /^\/(.+)\/([a-z]*)$/;

export function applyIgnoreRules(
  findings: Finding[],
  rules: IgnoreRule[],
  today: Date = new Date(),
  options: IgnoreOptions = {}
): IgnoreResult {
  const warnings: string[] = [];
  const active = compileRules(rules, today, warnings);
  const kept: Finding[] = [];
  const ignored: IgnoredFinding[] = [];

  for (const finding of findings) {
    const matched = matchFinding(finding, active);
    if (!matched) {
      kept.push(finding);
      continue;
    }
    for (const entry of matched) entry.used = true;
    const reasons = [...new Set(matched.map((entry) => entry.rule.reason).filter((reason): reason is string => Boolean(reason)))];
    ignored.push(reasons.length > 0 ? { ...finding, ignoreReason: reasons.join("; ") } : { ...finding });
  }

  for (const entry of active) {
    if (!entry.used && couldHaveMatched(entry.rule, options)) warnings.push(t("ignore.unused", { rule: entry.label }));
  }

  return { kept, ignored, warnings };
}

function compileRules(rules: IgnoreRule[], today: Date, warnings: string[]): CompiledRule[] {
  const todayKey = formatLocalDate(today);
  const compiled: CompiledRule[] = [];

  for (const rule of rules) {
    const label = describeRule(rule);

    const invalidField = RULE_FIELDS.find((key) => rule[key] !== undefined && typeof rule[key] !== "string");
    if (invalidField) {
      warnings.push(t("ignore.invalidField", { rule: label, field: invalidField }));
      continue;
    }

    if (!rule.check && !rule.id && !rule.match && !rule.file && !rule.url) {
      warnings.push(t("ignore.noMatcher", { rule: label }));
      continue;
    }

    if (rule.until !== undefined) {
      if (!DATE_PATTERN.test(rule.until) || Number.isNaN(Date.parse(rule.until))) {
        warnings.push(t("ignore.invalidUntil", { rule: label, until: String(rule.until) }));
        continue;
      }
      if (todayKey > rule.until) {
        warnings.push(t("ignore.expired", { rule: label, until: rule.until }));
        continue;
      }
    }

    let pattern: RegExp | undefined;
    const literal = rule.match ? REGEX_LITERAL.exec(rule.match) : null;
    if (literal) {
      try {
        pattern = new RegExp(literal[1], literal[2].replace(/[gy]/g, ""));
      } catch (error) {
        warnings.push(t("ignore.invalidRegex", { rule: label, message: (error as Error).message }));
        continue;
      }
    }

    compiled.push({ rule, label, pattern, used: false });
  }

  return compiled;
}

function matchFinding(finding: Finding, rules: CompiledRule[]): CompiledRule[] | undefined {
  const direct = rules.find((entry) => !entry.rule.id && matchesFields(finding, entry));
  if (direct) return [direct];

  const ids = (finding.ids ?? []).map((id) => id.toLowerCase());
  if (ids.length === 0) return undefined;

  const covering = rules.filter((entry) => entry.rule.id && ids.includes(entry.rule.id.toLowerCase()) && matchesFields(finding, entry));
  const covered = new Set(covering.map((entry) => entry.rule.id?.toLowerCase()));
  return ids.every((id) => covered.has(id)) ? covering : undefined;
}

function matchesFields(finding: Finding, { rule, pattern }: CompiledRule): boolean {
  if (rule.check && !matchesCheck(finding.checkId, rule.check)) return false;
  if (rule.match && !(pattern ? pattern.test(finding.message) : finding.message.includes(rule.match))) return false;
  if (rule.file && !finding.file?.includes(rule.file)) return false;
  if (rule.url && !finding.url?.includes(rule.url)) return false;
  return true;
}

function couldHaveMatched(rule: IgnoreRule, options: IgnoreOptions): boolean {
  if (!rule.check) return !options.partial;
  const pattern = rule.check;
  return options.ranCheckIds === undefined || options.ranCheckIds.some((id) => matchesCheck(id, pattern));
}

function matchesCheck(checkId: string, pattern: string): boolean {
  return pattern.endsWith("*") ? checkId.startsWith(pattern.slice(0, -1)) : checkId === pattern;
}

function describeRule(rule: IgnoreRule): string {
  const parts = (["check", "id", "match", "file", "url"] as const).filter((key) => rule[key]).map((key) => `${key}=${rule[key]}`);
  return parts.length > 0 ? parts.join(", ") : JSON.stringify(rule);
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
