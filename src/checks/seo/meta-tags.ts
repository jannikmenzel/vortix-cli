import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

const OG_PROPERTIES = ["og:title", "og:description", "og:image"];

const TITLE_TRUNCATION_LENGTH = 70;

export default defineCheck({
  id: "seo.meta-tags",
  name: "Meta/Title/OG Tags",
  category: "seo",
  mode: "static",
  severity: "warn",
  description: "Checks title, meta description, and Open Graph tags per page.",
  async run(ctx) {
    const findings: Finding[] = [];

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);

      const title = root.querySelector("title")?.text?.trim();
      if (!title) {
        findings.push(ctx.finding({ message: "Missing <title>", file: page.relativeFile }));
      } else {
        ctx.detail({ label: "Title", value: `"${title}" (${title.length} chars)`, url: page.urlPath });
        if (title.length > TITLE_TRUNCATION_LENGTH) {
          findings.push(
            ctx.finding({
              message: `Title is ${title.length} characters long — likely truncated in search results (~${TITLE_TRUNCATION_LENGTH}+ chars)`,
              file: page.relativeFile,
            })
          );
        }
      }

      const description = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim();
      if (!description) {
        findings.push(ctx.finding({ message: 'Missing <meta name="description">', file: page.relativeFile }));
      } else {
        ctx.detail({ label: "Meta description", value: `"${description}" (${description.length} chars)`, url: page.urlPath });
      }

      const foundOg = OG_PROPERTIES.filter((property) => root.querySelector(`meta[property="${property}"]`)?.getAttribute("content"));
      ctx.detail({ label: "Open Graph tags found", value: foundOg.length > 0 ? foundOg.join(", ") : "(none)", url: page.urlPath });
      const missingOg = OG_PROPERTIES.filter((property) => !foundOg.includes(property));
      if (missingOg.length > 0) {
        findings.push(
          ctx.finding({
            message: `Missing Open Graph tag${missingOg.length > 1 ? "s" : ""}: ${missingOg.join(", ")}`,
            file: page.relativeFile,
          })
        );
      }
    }

    return findings;
  },
});
