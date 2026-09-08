import path from "node:path";
import { defineCheck } from "@core/define-check.js";

interface NpmOutdatedEntry {
  current?: string;
  latest?: string;
}

export default defineCheck({
  id: "maintainability.outdated-dependencies",
  name: "Outdated Dependencies (npm outdated)",
  category: "maintainability",
  mode: "static",
  severity: "info",
  description: 'Lists outdated npm dependencies via "npm outdated" (not a security signal — see security.dependency-vulnerabilities).',
  async run(ctx) {
    if (!ctx.fileExists(path.join(ctx.siteRoot, "package.json"))) ctx.skip("no package.json found");

    const output = await ctx.exec("npm outdated --json");
    if (!output.trim()) {
      ctx.detail({ label: "Outdated dependencies", value: "0" });
      return [];
    }

    let report: Record<string, NpmOutdatedEntry> = {};
    try {
      report = JSON.parse(output);
    } catch (error) {
      ctx.skip(`npm outdated produced unreadable output: ${(error as Error).message}`);
    }

    ctx.detail({ label: "Outdated dependencies", value: String(Object.keys(report).length) });

    return Object.entries(report).map(([name, info]) =>
      ctx.finding({
        message: `${name}: current ${info.current ?? "not installed"}, latest ${info.latest ?? "unknown"}`,
      })
    );
  },
});
