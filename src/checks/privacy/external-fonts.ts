import { defineCheck } from "@core/define-check.js";
import { uniqueUrlsMatchingDomains } from "./match-domains.js";

const EXTERNAL_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "use.typekit.net", "fonts.adobe.com"];

export default defineCheck({
  id: "privacy.external-fonts",
  name: "External Fonts/APIs",
  category: "privacy",
  mode: "dynamic",
  severity: "info",
  description: "Detects externally loaded fonts/APIs (a GDPR consideration — self-hosting is recommended).",
  async run(ctx) {
    const uniqueUrls = uniqueUrlsMatchingDomains(ctx.networkRequests, EXTERNAL_FONT_HOSTS);
    ctx.detail({ label: "Externally loaded fonts/APIs", value: String(uniqueUrls.length), url: ctx.pageInfo.urlPath });
    return uniqueUrls.map((url) => ctx.finding({ message: `Externally loaded resource "${url}"`, url: ctx.pageInfo.urlPath }));
  },
});
