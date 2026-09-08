import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

export default defineCheck({
  id: "performance.third-party-impact",
  name: "Third-Party Impact",
  category: "performance",
  mode: "dynamic",
  severity: "warn",
  description: "Detects render-blocking third-party resources that may impact performance.",
  async run(ctx) {
    const findings: Finding[] = [];

    const firstPartyHost = new URL(ctx.page.url()).hostname;
    const thirdPartyRequests = ctx.networkRequests.filter((req) => {
      // Requests from a child frame, such as a third-party iframe widget, cannot block this
      // page's own render, regardless of content type.
      if (!req.isMainFrame) return false;
      try {
        const host = new URL(req.url).hostname;
        return host !== firstPartyHost && !host.endsWith(`.${firstPartyHost}`);
      } catch {
        return false;
      }
    });

    // `<script async>` and `<script defer>` are explicitly non-render-blocking.
    const nonBlockingScriptUrls = new Set(
      await ctx.page.$$eval("script[src][async], script[src][defer]", (els) => els.map((el) => (el as HTMLScriptElement).src))
    );

    const blockingTypes = ["text/html", "text/css", "application/javascript", "text/javascript"];
    const blockingRequests = thirdPartyRequests.filter((req) => {
      const contentType = req.contentType?.split(";")[0]?.trim() ?? "";
      if (!blockingTypes.includes(contentType)) return false;
      if (req.resourceType === "script" && nonBlockingScriptUrls.has(req.url)) return false;
      return true;
    });

    for (const req of blockingRequests) {
      findings.push(
        ctx.finding({
          message: `Third-party blocking resource: "${req.url}"`,
          url: ctx.pageInfo.urlPath,
        })
      );
    }

    ctx.detail({
      label: "Third-party requests / render-blocking",
      value: `${thirdPartyRequests.length} / ${blockingRequests.length}`,
      url: ctx.pageInfo.urlPath,
    });

    return findings;
  },
});
