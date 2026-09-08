import path from "node:path";
import type { ResolvedConfig } from "@core/types.js";

export function fixturePath(name: string): string {
  return path.resolve(import.meta.dirname, "../sample-sites", name);
}

export function buildConfig(cwd: string, overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  const base: ResolvedConfig = {
    cwd,
    build: false,
    failOn: "error",
    target: {},
    categories: {
      performance: true,
      security: true,
      accessibility: true,
      bugs: true,
      seo: true,
      maintainability: true,
      privacy: true,
    },
    checks: [],
    disabledChecks: [],
    severity: {},
    performance: {
      budgets: { lcpMs: 2500, cls: 0.1, maxPageWeightKb: 1500, maxImageKb: 300 },
    },
    privacy: { trackerDomains: [] },
  };

  return {
    ...base,
    ...overrides,
    target: { ...base.target, ...overrides.target },
    categories: { ...base.categories, ...overrides.categories },
    performance: { budgets: { ...base.performance.budgets, ...overrides.performance?.budgets } },
    privacy: { ...base.privacy, ...overrides.privacy },
  };
}

export function findingsFor(findings: { checkId: string }[], checkId: string) {
  return findings.filter((f) => f.checkId === checkId);
}
