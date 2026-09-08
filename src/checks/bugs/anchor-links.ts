import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

export default defineCheck({
  id: "bugs.anchor-links",
  name: "Anchor Links",
  category: "bugs",
  mode: "static",
  severity: "warn",
  description: "Validates internal anchor links (#id) point to existing elements.",
  async run(ctx) {
    const findings: Finding[] = [];
    let checked = 0;

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      const links = root.querySelectorAll("a[href^='#']");

      for (const link of links) {
        const href = link.getAttribute("href") ?? "";
        const id = href.slice(1);
        if (!id) continue;

        checked++;
        // Match on the attribute value rather than `#id`: an id containing a CSS-special
        // character such as "." would otherwise be parsed as a compound id and class
        // selector and never match, even when the element exists.
        const target = root.querySelector(`[id="${id}"]`);
        if (!target) {
          findings.push(
            ctx.finding({
              message: `Anchor "${href}" points to non-existent element`,
              file: page.relativeFile,
            })
          );
        }
      }
    }

    ctx.detail({ label: "Anchor links checked", value: String(checked) });

    return findings;
  },
});
