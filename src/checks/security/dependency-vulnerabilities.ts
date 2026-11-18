import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Severity } from "@core/types.js";

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "error",
  high: "error",
  moderate: "warn",
  low: "info",
  info: "info",
};

type AuditVia = string | { title?: string; url?: string };

interface AuditVulnerability {
  severity: string;
  via?: AuditVia[];
}

interface NpmAuditReport {
  vulnerabilities?: Record<string, AuditVulnerability>;
  error?: { code?: string; summary?: string };
}

export interface VulnerabilityEntry {
  name: string;
  severity: string;
  message: string;
  ids: string[];
}

const ADVISORY_ID = /(GHSA(?:-[a-z0-9]{4}){3})/i;

export function describeVulnerabilities(report: NpmAuditReport): VulnerabilityEntry[] {
  const vulnerabilities = report.vulnerabilities ?? {};

  const collectIds = (name: string, seen: Set<string>): Set<string> => {
    const ids = new Set<string>();
    if (seen.has(name)) return ids;
    seen.add(name);
    for (const via of vulnerabilities[name]?.via ?? []) {
      if (typeof via === "string") {
        for (const id of collectIds(via, seen)) ids.add(id);
      } else {
        const match = via.url ? ADVISORY_ID.exec(via.url) : null;
        if (match) ids.add(match[1]);
      }
    }
    return ids;
  };

  return Object.entries(vulnerabilities).map(([name, info]) => {
    const via = info.via ?? [];
    const ids = [...collectIds(name, new Set())].sort();
    const parents = [...new Set(via.filter((v): v is string => typeof v === "string"))].sort();
    const direct = via.find((v): v is { title?: string } => typeof v === "object" && Boolean(v.title));
    const origin = direct ? ` (${direct.title})` : parents.length > 0 ? ` via ${parents.join(", ")}` : "";
    const suffix = ids.length > 0 ? ` [${ids.join(", ")}]` : "";
    return { name, severity: info.severity, message: `${name}: ${info.severity} severity vulnerability${origin}${suffix}`, ids };
  });
}

export default defineCheck({
  id: "security.dependency-vulnerabilities",
  name: "Dependency Vulnerabilities (npm audit)",
  category: "security",
  mode: "static",
  severity: "error",
  description: 'Checks for known vulnerabilities in npm dependencies via "npm audit".',
  async run(ctx) {
    if (!ctx.fileExists(path.join(ctx.siteRoot, "package.json"))) ctx.skip("no package.json found");

    const hasNpmLock = ctx.fileExists(path.join(ctx.siteRoot, "package-lock.json"));
    if (!hasNpmLock) {
      if (ctx.fileExists(path.join(ctx.siteRoot, "pnpm-lock.yaml"))) {
        ctx.skip("project uses a pnpm lockfile — npm audit can't read it; run `pnpm audit` manually");
      }
      if (ctx.fileExists(path.join(ctx.siteRoot, "yarn.lock"))) {
        ctx.skip("project uses a yarn lockfile — npm audit can't read it; run `yarn audit` manually");
      }
      ctx.skip("no package-lock.json found — run `npm install` so dependencies can be audited");
    }

    const output = await ctx.exec("npm audit --json");
    let report: NpmAuditReport = {};
    try {
      report = JSON.parse(output);
    } catch (error) {
      ctx.skip(`npm audit produced unreadable output: ${(error as Error).message}`);
    }

    if (report.error) {
      ctx.skip(`npm audit failed: ${report.error.summary ?? report.error.code ?? "unknown error"}`);
    }

    const entries = describeVulnerabilities(report);
    ctx.detail({ label: "Vulnerable dependencies found", value: String(entries.length) });

    return entries.map((entry) =>
      ctx.finding({
        message: entry.message,
        ids: entry.ids,
        severity: SEVERITY_MAP[entry.severity] ?? "warn",
      })
    );
  },
});
