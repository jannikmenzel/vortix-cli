import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

const MODERN_FORMATS = new Set(["webp", "avif", "svg"]);

export default defineCheck({
  id: "performance.image-format",
  name: "Image Format",
  category: "performance",
  mode: "static",
  severity: "info",
  description: "Checks if images use modern formats (WebP/AVIF) instead of legacy formats.",
  async run(ctx) {
    const findings: Finding[] = [];
    let total = 0;
    let modern = 0;

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const images = root.querySelectorAll("img[src]");

      for (const img of images) {
        const src = img.getAttribute("src") ?? "";
        const ext = src.split(".").pop()?.split("?")[0]?.toLowerCase();
        if (!ext) continue;
        total++;
        if (MODERN_FORMATS.has(ext)) modern++;

        if (!MODERN_FORMATS.has(ext) && ["jpg", "jpeg", "png", "gif"].includes(ext)) {
          findings.push(
            ctx.finding({
              message: `Image "${src}" uses legacy format "${ext}" — consider WebP or AVIF`,
              file: page.relativeFile,
            })
          );
        }
      }
    }

    ctx.detail({ label: "Images using a modern format", value: `${modern} / ${total}` });

    return findings;
  },
});
