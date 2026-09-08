import path from "node:path";
import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

function isBlanketDisallow(content: string): boolean {
  let currentAgentIsWildcard = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^user-agent\s*:/i.test(line)) {
      currentAgentIsWildcard = line.split(":")[1]?.trim() === "*";
      continue;
    }
    if (currentAgentIsWildcard && /^disallow\s*:\s*\/\s*$/i.test(line)) return true;
  }
  return false;
}

function extractSitemapUrls(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim());
}

export default defineCheck({
  id: "seo.robots-sitemap",
  name: "robots.txt & Sitemap",
  category: "seo",
  mode: "static",
  severity: "error",
  description: "Flags an accidental site-wide crawl block in robots.txt and Sitemap references that don't resolve.",
  async run(ctx) {
    const findings: Finding[] = [];
    const robotsPath = path.join(ctx.outputDir, "robots.txt");
    if (!ctx.fileExists(robotsPath)) {
      ctx.detail({ label: "robots.txt found", value: "no" });
      return findings;
    }

    const content = ctx.readFile(robotsPath);
    const sitemapUrls = extractSitemapUrls(content);
    ctx.detail({ label: "Sitemap references in robots.txt", value: sitemapUrls.length > 0 ? sitemapUrls.join(", ") : "(none)" });

    if (isBlanketDisallow(content)) {
      findings.push(
        ctx.finding({
          message: 'robots.txt blocks all crawlers ("User-agent: *" + "Disallow: /") — the site is invisible to search engines',
          file: "robots.txt",
        })
      );
    }

    for (const sitemapUrl of sitemapUrls) {
      let sitemapPath: string;
      try {
        sitemapPath = new URL(sitemapUrl).pathname;
      } catch {
        sitemapPath = sitemapUrl;
      }
      if (!ctx.fileExists(path.join(ctx.outputDir, sitemapPath))) {
        findings.push(
          ctx.finding({
            message: `robots.txt references a Sitemap that doesn't exist in the build output: "${sitemapUrl}"`,
            file: "robots.txt",
            severity: "warn",
          })
        );
      }
    }

    return findings;
  },
});
