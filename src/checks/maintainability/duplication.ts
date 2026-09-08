import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import { resolvePackageBin } from "@utils/resolve-bin.js";

interface JscpdFileRef {
  name?: string;
  start?: number;
  end?: number;
}

interface JscpdDuplicate {
  lines: number;
  firstFile?: JscpdFileRef;
  secondFile?: JscpdFileRef;
}

interface JscpdReport {
  duplicates?: JscpdDuplicate[];
}

const MAX_FINDINGS = 20;

const SOURCE_FORMATS = "javascript,typescript,jsx,tsx,vue,svelte,astro,css,scss,less,markup";
// Paths whose duplication the site owner cannot act on, grouped by reason.
const IGNORE_PATTERNS = [
  // Dependencies, lockfiles and generated or minified assets.
  "**/node_modules/**",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/*.min.js",
  "**/*.svg",

  // Framework and deployment build caches.
  "**/.astro/**",
  "**/.vercel/**",
  "**/.netlify/**",
  "**/.cache/**",

  // Type declarations, which are repetitive by nature.
  "**/*.d.ts",

  // Tests, fixtures and snapshots, where repetition is intentional.
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/__snapshots__/**",
  "**/*.snap",
  "**/fixtures/**",

  // Vendored third-party code.
  "**/vendor/**",
];

const MIN_LINES = 15;
const MIN_TOKENS = 150;

export default defineCheck({
  id: "maintainability.duplication",
  name: "Code Duplication (jscpd)",
  category: "maintainability",
  mode: "static",
  severity: "warn",
  description: "Finds duplicated code in the source folder via jscpd.",
  async run(ctx) {
    const jscpdBin = resolvePackageBin("jscpd", "run-jscpd.js");
    const reportDir = await mkdtemp(path.join(os.tmpdir(), "vortix-jscpd-"));
    try {
      const outputIsSiteRoot = path.resolve(ctx.outputDir) === path.resolve(ctx.siteRoot);
      const ignore = [...IGNORE_PATTERNS, ...(outputIsSiteRoot ? [] : [`**/${path.basename(ctx.outputDir)}/**`])].join(",");
      const escapedSiteRoot = ctx.siteRoot.replace(/'/g, "'\\''");
      const escapedReportDir = reportDir.replace(/'/g, "'\\''");
      await ctx.exec(
        `node '${jscpdBin}' '${escapedSiteRoot}' --reporters json --output '${escapedReportDir}' --silent --min-lines ${MIN_LINES} --min-tokens ${MIN_TOKENS} --format "${SOURCE_FORMATS}" --ignore "${ignore}"`
      );
      const reportPath = path.join(reportDir, "jscpd-report.json");
      if (!ctx.fileExists(reportPath)) {
        ctx.skip("jscpd did not produce a report — it may have failed to run");
      }
      let report: JscpdReport = {};
      try {
        report = JSON.parse(ctx.readFile(reportPath));
      } catch (error) {
        ctx.skip(`jscpd produced an unreadable report: ${(error as Error).message}`);
      }
      const duplicates = report.duplicates ?? [];
      ctx.detail({ label: "Duplicate code blocks found", value: String(duplicates.length) });
      return duplicates.slice(0, MAX_FINDINGS).map((dup) =>
        ctx.finding({
          message: `Duplicate code (${dup.lines} lines) between "${formatFileRef(dup.firstFile)}" and "${formatFileRef(dup.secondFile)}"`,
          file: stripFormatSuffix(dup.firstFile?.name),
        })
      );
    } finally {
      await rm(reportDir, { recursive: true, force: true }).catch(() => {});
    }
  },
});

function stripFormatSuffix(name: string | undefined): string | undefined {
  return name?.replace(/:[a-z]+$/, "");
}

function formatFileRef(ref: JscpdFileRef | undefined): string {
  const name = stripFormatSuffix(ref?.name) ?? "?";
  return ref?.start && ref?.end ? `${name}:${ref.start}-${ref.end}` : name;
}
