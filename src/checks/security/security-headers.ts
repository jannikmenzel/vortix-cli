import { defineCheck } from "@core/define-check.js";
import type { Finding, Severity } from "@core/types.js";

interface HeaderRule {
  header: string;
  severity: Severity;
  message: string;
  httpsOnly?: boolean;
}

const HEADER_RULES: HeaderRule[] = [
  {
    header: "strict-transport-security",
    severity: "warn",
    message: "Missing Strict-Transport-Security header — browsers can't be told to always use HTTPS for this site",
    httpsOnly: true,
  },
  {
    header: "content-security-policy",
    severity: "warn",
    message: "Missing Content-Security-Policy header — no baseline defense against XSS/data-injection attacks",
  },
  {
    header: "x-content-type-options",
    severity: "warn",
    message: "Missing X-Content-Type-Options header — browsers may MIME-sniff responses into an unintended content type",
  },
  {
    header: "referrer-policy",
    severity: "info",
    message: "Missing Referrer-Policy header — full URLs (query strings included) may leak to third parties via the Referer header",
  },
  {
    header: "permissions-policy",
    severity: "info",
    message: "Missing Permissions-Policy header — no explicit restriction on powerful browser features (camera, geolocation, ...)",
  },
];

export default defineCheck({
  id: "security.security-headers",
  name: "Security Headers",
  category: "security",
  mode: "live",
  severity: "warn",
  description:
    "Checks the live response for standard security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options/frame-ancestors).",
  run(ctx) {
    const findings: Finding[] = [];
    const isHttps = ctx.isHttps;
    const csp = ctx.headers["content-security-policy"];

    for (const rule of HEADER_RULES) {
      if (rule.httpsOnly && !isHttps) continue;
      const value = ctx.headers[rule.header];
      ctx.detail({ label: rule.header, value: value ?? "(missing)" });
      if (!value) {
        findings.push(ctx.finding({ message: rule.message, severity: rule.severity }));
      }
    }

    const hasFrameAncestors = csp?.toLowerCase().includes("frame-ancestors") ?? false;
    ctx.detail({
      label: "x-frame-options",
      value: ctx.headers["x-frame-options"] ?? (hasFrameAncestors ? "(covered by CSP frame-ancestors)" : "(missing)"),
    });
    if (!ctx.headers["x-frame-options"] && !hasFrameAncestors) {
      findings.push(
        ctx.finding({
          message: "Missing X-Frame-Options header (and no CSP frame-ancestors directive) — page can be embedded in a clickjacking iframe",
          severity: "warn",
        })
      );
    }

    return findings;
  },
});
