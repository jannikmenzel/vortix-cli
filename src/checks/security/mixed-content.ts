import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parse } from "node-html-parser";

const RESOURCE_ATTRS: [selector: string, attribute: string][] = [
  ["img[src]", "src"],
  ["script[src]", "src"],
  ["iframe[src]", "src"],
  ["source[src]", "src"],
  ["video[src]", "src"],
  ["audio[src]", "src"],
  ["embed[src]", "src"],
  ["object[data]", "data"],
  ['link[rel="stylesheet"][href]', "href"],
];

const CSS_URL_PATTERN = /url\(\s*['"]?(http:\/\/[^)'"]+)['"]?\s*\)/gi;

export default defineCheck({
  id: "security.mixed-content",
  name: "Mixed Content",
  category: "security",
  mode: "live",
  severity: "warn",
  description:
    "Scans the fetched HTML of an HTTPS page for hardcoded HTTP resource references (img/script/iframe/stylesheet/etc., and url(http://...) in CSS). Resources injected by client-side JavaScript after load aren't visible here.",
  run(ctx) {
    if (!ctx.isHttps) {
      ctx.skip("Mixed content only applies to HTTPS pages — this URL is HTTP");
    }

    const root = parse(ctx.html);
    const findings: Finding[] = [];
    let checked = 0;

    for (const [selector, attribute] of RESOURCE_ATTRS) {
      for (const el of root.querySelectorAll(selector)) {
        const url = el.getAttribute(attribute);
        if (!url) continue;
        checked++;
        if (/^http:\/\//i.test(url)) {
          findings.push(ctx.finding({ message: `Mixed content: HTTP resource "${url}" referenced on an HTTPS page` }));
        }
      }
    }

    for (const styleEl of root.querySelectorAll("style")) {
      for (const match of styleEl.text.matchAll(CSS_URL_PATTERN)) {
        checked++;
        findings.push(ctx.finding({ message: `Mixed content: HTTP resource "${match[1]}" referenced in an inline <style> block` }));
      }
    }
    for (const el of root.querySelectorAll("[style]")) {
      for (const match of (el.getAttribute("style") ?? "").matchAll(CSS_URL_PATTERN)) {
        checked++;
        findings.push(ctx.finding({ message: `Mixed content: HTTP resource "${match[1]}" referenced in a style attribute` }));
      }
    }

    ctx.detail({ label: "Resource references checked", value: String(checked) });

    return findings;
  },
});
