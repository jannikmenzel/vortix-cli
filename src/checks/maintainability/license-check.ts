import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

const PROBLEMATIC_LICENSES = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "SSPL-1.0", "EUPL-1.1"]);

export default defineCheck({
  id: "maintainability.license-check",
  name: "License Check",
  category: "maintainability",
  mode: "static",
  severity: "info",
  description: "Checks dependencies for copyleft licenses that may conflict with proprietary code.",
  async run(ctx) {
    const findings: Finding[] = [];
    const pkgPath = path.join(ctx.siteRoot, "package.json");

    if (!existsSync(pkgPath)) {
      ctx.skip("No package.json found");
    }

    const nodeModules = path.join(ctx.siteRoot, "node_modules");
    if (!existsSync(nodeModules)) {
      ctx.skip("node_modules not found — install dependencies first");
    }

    const lockPath = path.join(ctx.siteRoot, "package-lock.json");
    const npmPath = path.join(ctx.siteRoot, "node_modules", ".package-lock.json");
    const lockExists = existsSync(lockPath) || existsSync(npmPath);
    if (!lockExists) {
      ctx.skip("No lockfile found");
    }

    const deps = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = { ...deps.dependencies, ...deps.devDependencies };

    let checked = 0;
    for (const [name] of Object.entries(allDeps)) {
      const licensePath = path.join(nodeModules, name, "package.json");
      if (!existsSync(licensePath)) continue;

      try {
        const pkg = JSON.parse(readFileSync(licensePath, "utf-8"));
        const license = typeof pkg.license === "string" ? pkg.license : pkg.license?.type;
        checked++;

        if (license && PROBLEMATIC_LICENSES.has(license)) {
          findings.push(
            ctx.finding({
              message: `Dependency "${name}" uses license "${license}" — may have copyleft restrictions`,
              severity: "warn",
            })
          );
        }
      } catch {}
    }

    ctx.detail({ label: "Dependencies with a resolvable license / flagged", value: `${checked} / ${findings.length}` });

    return findings;
  },
});
