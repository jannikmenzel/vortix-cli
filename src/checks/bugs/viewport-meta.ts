import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

export default defineCheck({
  id: "bugs.viewport-meta",
  name: "Viewport Meta Tag",
  category: "bugs",
  mode: "static",
  severity: "warn",
  description: 'Checks that every page declares <meta name="viewport">, required for mobile-responsive rendering.',
  async run(ctx) {
    const findings: Finding[] = [];

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const viewport = root.querySelector('meta[name="viewport"]')?.getAttribute("content");
      if (!viewport) {
        findings.push(
          ctx.finding({
            message: 'Missing <meta name="viewport"> — page may not render correctly on mobile devices',
            file: page.relativeFile,
          })
        );
      } else {
        ctx.detail({ label: "viewport content", value: viewport, url: page.urlPath });
      }
    }

    return findings;
  },
});
