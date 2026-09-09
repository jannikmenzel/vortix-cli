import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "./config.js";
import type { CheckDefinition, DynamicCacheFile, ResolvedConfig } from "./types.js";

export const CACHE_FILE = "cache.json";

export function getCachePath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, CACHE_FILE);
}

/**
 * A cache entry is only valid while this fingerprint is unchanged. It covers everything besides
 * page content that can change what a dynamic check reports for the same HTML: the active check
 * set, severity overrides, performance budgets, tracker domains, and the source of any local
 * custom check (so editing a check's own logic busts the cache even though its id didn't
 * change). Custom checks loaded from a package rather than a local file are not fingerprinted —
 * a version bump there is an accepted v1 limitation, same as a vortix upgrade.
 */
export function computeDynamicFingerprint(dynamicChecks: CheckDefinition[], config: ResolvedConfig): string {
  const localCheckSources = config.checks
    .filter((specifier) => specifier.startsWith("."))
    .sort()
    .map((specifier) => {
      try {
        return readFileSync(path.resolve(config.cwd, specifier), "utf-8");
      } catch {
        return "";
      }
    });

  const relevant = {
    checkIds: dynamicChecks.map((c) => c.id).sort(),
    severity: sortRecord(config.severity),
    budgets: config.performance.budgets,
    trackerDomains: [...config.privacy.trackerDomains].sort(),
    localCheckSources,
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function hashPageContent(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function loadDynamicCache(cwd: string): DynamicCacheFile | undefined {
  const cachePath = getCachePath(cwd);
  if (!existsSync(cachePath)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf-8"));
    if (typeof parsed?.fingerprint !== "string" || typeof parsed?.pages !== "object" || parsed.pages === null) {
      return undefined;
    }
    return parsed as DynamicCacheFile;
  } catch {
    return undefined;
  }
}

/** Best-effort: a cache write failure must never fail the run itself. */
export function saveDynamicCache(cwd: string, cache: DynamicCacheFile): void {
  try {
    const cachePath = getCachePath(cwd);
    mkdirSync(path.dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, `${JSON.stringify(cache)}\n`, "utf-8");
  } catch {
    // ignore
  }
}
