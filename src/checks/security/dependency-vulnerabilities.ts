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

interface NpmAuditReport {
  vulnerabilities?: Record<string, { severity: string; via?: { title?: string }[] }>;
  error?: { code?: string; summary?: string };
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

    const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
    ctx.detail({ label: "Vulnerable dependencies found", value: String(vulnerabilities.length) });

    return vulnerabilities.map(([name, info]) =>
      ctx.finding({
        message: `${name}: ${info.severity} severity vulnerability${info.via?.[0]?.title ? ` (${info.via[0].title})` : ""}`,
        severity: SEVERITY_MAP[info.severity] ?? "warn",
      })
    );
  },
});
