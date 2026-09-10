import { readdirSync } from "node:fs";
import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Finding, StaticCheckContext } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";

function isInternal(href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("//")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

// macOS and Windows filesystems are case-insensitive, so a plain existsSync would miss a
// wrong-case reference that breaks once deployed to a case-sensitive host.
function existsExactCase(fullPath: string): boolean {
  const segments = fullPath.split(path.sep).filter(Boolean);
  let current = path.parse(fullPath).root || path.sep;
  for (const segment of segments) {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

function targetExists(target: string, ctx: StaticCheckContext): boolean {
  const candidates = [target, path.join(target, "index.html"), `${target}.html`];
  return candidates.some((candidate) => ctx.fileExists(candidate) && existsExactCase(candidate));
}

const REFERENCE_ATTRIBUTES: { selector: string; attr: string; label: string }[] = [
  { selector: "a[href]", attr: "href", label: "link" },
  { selector: "img[src]", attr: "src", label: "image" },
  { selector: "link[href]", attr: "href", label: "stylesheet/link" },
  { selector: "script[src]", attr: "src", label: "script" },
];

export default defineCheck({
  id: "bugs.broken-links",
  name: "Broken Links & Assets",
  category: "bugs",
  mode: "static",
  severity: "error",
  description: "Checks that internal links, images, stylesheets, and scripts in the built output resolve to existing files.",
  async run(ctx) {
    const findings: Finding[] = [];
    let checked = 0;

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);

      for (const { selector, attr, label } of REFERENCE_ATTRIBUTES) {
        for (const el of root.querySelectorAll(selector)) {
          const value = el.getAttribute(attr) ?? "";
          if (!isInternal(value)) continue;

          const cleanValue = value.split(/[?#]/)[0];
          if (!cleanValue) continue;

          checked++;
          const target = cleanValue.startsWith("/") ? path.join(ctx.outputDir, cleanValue) : path.join(path.dirname(page.file), cleanValue);

          if (!targetExists(target, ctx)) {
            findings.push(ctx.finding({ message: `Broken internal ${label} reference "${value}"`, file: page.relativeFile }));
          }
        }
      }
    }

    ctx.detail({ label: "Internal references checked", value: String(checked) });

    return findings;
  },
});
