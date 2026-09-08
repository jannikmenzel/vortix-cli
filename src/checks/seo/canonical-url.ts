import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

export default defineCheck({
  id: "seo.canonical-url",
  name: "Canonical URL",
  category: "seo",
  mode: "static",
  severity: "warn",
  description: "Checks for missing or duplicate canonical URLs.",
  async run(ctx) {
    const findings: Finding[] = [];
    const seen = new Map<string, string>();

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");

      if (!canonical) {
        findings.push(
          ctx.finding({
            message: "Missing canonical URL",
            file: page.relativeFile,
          })
        );
        continue;
      }

      ctx.detail({ label: "Canonical URL", value: canonical, url: page.urlPath });

      const existing = seen.get(canonical);
      if (existing && existing !== page.relativeFile) {
        findings.push(
          ctx.finding({
            message: `Duplicate canonical URL "${canonical}" used by "${existing}"`,
            file: page.relativeFile,
            severity: "warn",
          })
        );
      } else {
        seen.set(canonical, page.relativeFile);
      }
    }

    return findings;
  },
});
