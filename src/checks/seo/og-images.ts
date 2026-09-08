import { existsSync } from "node:fs";
import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

export default defineCheck({
  id: "seo.og-images",
  name: "Open Graph Images",
  category: "seo",
  mode: "static",
  severity: "info",
  description: "Validates Open Graph images exist and are accessible.",
  async run(ctx) {
    const findings: Finding[] = [];

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content");

      if (!ogImage) {
        findings.push(
          ctx.finding({
            message: "Missing og:image tag",
            file: page.relativeFile,
            severity: "info",
          })
        );
        continue;
      }

      ctx.detail({ label: "og:image", value: ogImage, url: page.urlPath });

      if (ogImage.startsWith("http")) continue;

      const imagePath = path.join(path.dirname(page.file), ogImage);
      if (!existsSync(imagePath)) {
        findings.push(
          ctx.finding({
            message: `og:image "${ogImage}" not found`,
            file: page.relativeFile,
          })
        );
      }
    }

    return findings;
  },
});
