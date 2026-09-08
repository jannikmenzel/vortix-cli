import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { globFiles } from "@utils/glob.js";
import { parseHtmlFile } from "@utils/html.js";

const MAX_FINDINGS = 20;

const SOURCE_EXTENSIONS = "html,htm,js,jsx,mjs,cjs,ts,tsx,vue,svelte,astro,mdx,php,twig,liquid,njk,hbs,handlebars,ejs,pug";

const IGNORE_MARKERS = ["node_modules", "/.astro/", "/.vercel/", "/.netlify/", "/.cache/", ".min.js"];

const CLASS_SELECTOR_PATTERN = /\.([a-zA-Z_-][\w-]*)/g;
const WORD_PATTERN = /[a-zA-Z_][\w-]*/g;

function stripCssNoise(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/url\([^)]*\)/gi, " ")
    .replace(/(['"])(?:(?!\1)[^\\]|\\.)*\1/g, " ");
}

export default defineCheck({
  id: "maintainability.dead-css",
  name: "Dead CSS",
  category: "maintainability",
  mode: "static",
  severity: "info",
  description:
    "Finds CSS classes defined in stylesheets that show up neither in the built pages nor anywhere in the project's own source files (templates, scripts, components) — a good signal they're safe to delete. Classes assembled purely from dynamic strings at runtime can still slip through undetected.",
  async run(ctx) {
    const cssFiles = (await globFiles("**/*.{css,scss,less}", { cwd: ctx.siteRoot })).filter(
      (file) => !file.includes("node_modules") && !file.endsWith(".min.css")
    );
    if (cssFiles.length === 0) {
      ctx.detail({ label: "CSS files scanned", value: "0" });
      return [];
    }

    const definedClasses = new Map<string, string>();
    for (const cssFile of cssFiles) {
      let content: string;
      try {
        content = ctx.readFile(cssFile);
      } catch {
        continue;
      }

      const cleaned = stripCssNoise(content);
      for (const match of cleaned.matchAll(CLASS_SELECTOR_PATTERN)) {
        const nextChar = cleaned[match.index + match[0].length];
        if (nextChar === "#" || nextChar === "$" || nextChar === "@") continue;

        if (!definedClasses.has(match[1])) {
          definedClasses.set(match[1], path.relative(ctx.siteRoot, cssFile));
        }
      }
    }
    if (definedClasses.size === 0) {
      ctx.detail({ label: "CSS classes defined", value: "0" });
      return [];
    }

    const usedClasses = new Set<string>();
    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);
      for (const el of root.querySelectorAll("[class]")) {
        for (const cls of el.getAttribute("class")?.split(/\s+/) ?? []) {
          if (cls) usedClasses.add(cls);
        }
      }
    }

    const unresolved = [...definedClasses.keys()].filter((cls) => !usedClasses.has(cls));
    if (unresolved.length === 0) {
      ctx.detail({ label: "CSS classes defined", value: String(definedClasses.size) });
      return [];
    }

    const sourceFiles = (await globFiles(`**/*.{${SOURCE_EXTENSIONS}}`, { cwd: ctx.siteRoot })).filter(
      (file) => !IGNORE_MARKERS.some((marker) => file.includes(marker))
    );

    const sourceTokens = new Set<string>();
    for (const file of sourceFiles) {
      let content: string;
      try {
        content = ctx.readFile(file);
      } catch {
        continue;
      }
      for (const match of content.matchAll(WORD_PATTERN)) {
        sourceTokens.add(match[0]);
      }
    }

    const findings: Finding[] = [];
    for (const className of unresolved) {
      if (sourceTokens.has(className)) continue;
      findings.push(
        ctx.finding({
          message: `CSS class ".${className}" in "${definedClasses.get(className)}" not used in HTML or source`,
          file: definedClasses.get(className),
          severity: "info",
        })
      );
    }

    ctx.detail({ label: "CSS classes defined / unused", value: `${definedClasses.size} / ${unresolved.length}` });

    return findings.slice(0, MAX_FINDINGS);
  },
});
