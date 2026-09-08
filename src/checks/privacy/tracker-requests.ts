import { defineCheck } from "@core/define-check.js";
import { uniqueUrlsMatchingDomains } from "./match-domains.js";

const BUILT_IN_TRACKER_DOMAINS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "connect.facebook.net",
  "facebook.com/tr",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
  "analytics.tiktok.com",
];

const CONSENT_HINTS = ["cookieconsent", "cookiebot", "usercentrics", "klaro", "cookie-consent", "cmp"];

export default defineCheck({
  id: "privacy.tracker-requests",
  name: "Tracking Without Consent",
  category: "privacy",
  mode: "dynamic",
  severity: "warn",
  description: "Heuristic: tracking requests on initial load without a detectable consent mechanism.",
  async run(ctx) {
    const trackerDomains = [...BUILT_IN_TRACKER_DOMAINS, ...ctx.config.privacy.trackerDomains];
    const uniqueUrls = uniqueUrlsMatchingDomains(ctx.networkRequests, trackerDomains);
    if (uniqueUrls.length === 0) {
      ctx.detail({ label: "Tracker requests detected", value: "0", url: ctx.pageInfo.urlPath });
      return [];
    }

    const html = (await ctx.page.content()).toLowerCase();
    const hasConsentHint = CONSENT_HINTS.some((hint) => html.includes(hint));
    ctx.detail({
      label: "Tracker requests / consent mechanism detected",
      value: `${uniqueUrls.length} / ${hasConsentHint ? "yes" : "no"}`,
      url: ctx.pageInfo.urlPath,
    });
    if (hasConsentHint) return [];

    return uniqueUrls.map((url) =>
      ctx.finding({
        message: `Tracking request to "${url}" on load without a detectable consent mechanism (heuristic)`,
        url: ctx.pageInfo.urlPath,
      })
    );
  },
});
