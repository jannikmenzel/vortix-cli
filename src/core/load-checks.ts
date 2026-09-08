import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUILT_IN_CHECKS } from "@checks/index.js";
import type { CheckDefinition, ResolvedConfig } from "./types.js";

export interface LoadChecksResult {
  checks: CheckDefinition[];
  /** Custom check modules that failed to load. Surfaced as run-level findings, never as a crash. */
  loadErrors: { specifier: string; message: string }[];
}

export async function loadChecks(config: ResolvedConfig): Promise<LoadChecksResult> {
  const builtins = BUILT_IN_CHECKS.filter((check) => config.categories[check.category] && !config.disabledChecks.includes(check.id));

  const custom: CheckDefinition[] = [];
  const loadErrors: { specifier: string; message: string }[] = [];

  for (const specifier of config.checks) {
    try {
      const resolved = specifier.startsWith(".") ? pathToFileURL(path.resolve(config.cwd, specifier)).href : specifier;
      const mod = await import(resolved);
      const exported = mod.default;
      if (!exported) {
        throw new Error(`Check module "${specifier}" has no default export`);
      }
      const defs: CheckDefinition[] = Array.isArray(exported) ? exported : [exported];
      for (const def of defs) {
        if (def && !config.disabledChecks.includes(def.id)) custom.push(def);
      }
    } catch (error) {
      // A mistyped path or a broken custom check must not take down the rest of the run.
      // Record the failure once and continue with every check that did load.
      loadErrors.push({ specifier, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const allChecks = [...builtins, ...custom];
  const seenIds = new Set<string>();
  const checks: CheckDefinition[] = [];
  for (const check of allChecks) {
    if (seenIds.has(check.id)) {
      loadErrors.push({ specifier: check.id, message: `Duplicate check id "${check.id}" — the later definition was ignored` });
      continue;
    }
    seenIds.add(check.id);
    checks.push(check);
  }

  return { checks, loadErrors };
}
