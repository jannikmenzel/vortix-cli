import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { t } from "./messages.js";
import type { ResolvedConfig, VortixConfig } from "./types.js";

export const CONFIG_DIR = ".vortix";
export const CONFIG_FILE = "config.json";

const DEFAULTS: Omit<ResolvedConfig, "cwd"> = {
  build: true,
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

export function defineConfig(config: VortixConfig): VortixConfig {
  return config;
}

export function getConfigPath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export function loadConfig(cwd: string): ResolvedConfig {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    return mergeConfig(cwd, {});
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (error) {
    throw new Error(t("errors.configRead", { message: (error as Error).message }), { cause: error });
  }

  let userConfig: VortixConfig;
  try {
    userConfig = JSON.parse(raw);
  } catch (error) {
    throw new Error(t("errors.configParse", { message: (error as Error).message }), { cause: error });
  }

  return mergeConfig(cwd, userConfig);
}

function mergeConfig(cwd: string, user: VortixConfig): ResolvedConfig {
  return {
    cwd,
    build: user.build ?? DEFAULTS.build,
    failOn: user.failOn ?? DEFAULTS.failOn,
    target: { ...DEFAULTS.target, ...user.target },
    categories: { ...DEFAULTS.categories, ...user.categories },
    checks: user.checks ?? DEFAULTS.checks,
    disabledChecks: user.disabledChecks ?? DEFAULTS.disabledChecks,
    severity: { ...DEFAULTS.severity, ...user.severity },
    performance: {
      budgets: { ...DEFAULTS.performance.budgets, ...user.performance?.budgets },
    },
    privacy: {
      trackerDomains: [...DEFAULTS.privacy.trackerDomains, ...(user.privacy?.trackerDomains ?? [])],
    },
  };
}
