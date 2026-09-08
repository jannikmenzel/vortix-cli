import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

export default defineCheck({
  id: "seo.structured-data",
  name: "Structured Data",
  category: "seo",
  mode: "static",
  severity: "info",
  description: "Validates JSON-LD structured data exists and has basic structure.",
  async run(ctx) {
    const findings: Finding[] = [];

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const scripts = root.querySelectorAll('script[type="application/ld+json"]');

      if (scripts.length === 0) {
        ctx.detail({ label: "JSON-LD blocks found", value: "0", url: page.urlPath });
        findings.push(
          ctx.finding({
            message: "No JSON-LD structured data found",
            file: page.relativeFile,
            severity: "info",
          })
        );
        continue;
      }

      const types: string[] = [];
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent ?? "");
          if (data["@type"]) types.push(String(data["@type"]));
          if (!data["@type"]) {
            findings.push(
              ctx.finding({
                message: "JSON-LD missing @type property",
                file: page.relativeFile,
                severity: "warn",
              })
            );
          }
        } catch {
          findings.push(
            ctx.finding({
              message: "Invalid JSON-LD syntax",
              file: page.relativeFile,
              severity: "warn",
            })
          );
        }
      }

      ctx.detail({
        label: "JSON-LD blocks / @types found",
        value: `${scripts.length} / ${types.length > 0 ? types.join(", ") : "(none)"}`,
        url: page.urlPath,
      });
    }

    return findings;
  },
});
