import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

function cookieName(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0]?.split("=")[0]?.trim() || "(unnamed)";
}

function hasAttribute(setCookieHeader: string, attribute: string): boolean {
  return setCookieHeader
    .split(";")
    .slice(1)
    .some((part) => part.trim().toLowerCase().startsWith(attribute));
}

export default defineCheck({
  id: "security.cookie-security",
  name: "Cookie Security",
  category: "security",
  mode: "live",
  severity: "warn",
  description: "Checks Set-Cookie headers on the live response for missing Secure, HttpOnly, and SameSite attributes.",
  run(ctx) {
    ctx.detail({ label: "Cookies set", value: String(ctx.setCookieHeaders.length) });
    if (ctx.setCookieHeaders.length === 0) return [];

    const isHttps = ctx.isHttps;
    const findings: Finding[] = [];

    for (const setCookie of ctx.setCookieHeaders) {
      const name = cookieName(setCookie);
      ctx.detail({
        label: name,
        value: `Secure: ${hasAttribute(setCookie, "secure")}, HttpOnly: ${hasAttribute(setCookie, "httponly")}, SameSite: ${hasAttribute(setCookie, "samesite")}`,
      });

      if (isHttps && !hasAttribute(setCookie, "secure")) {
        findings.push(
          ctx.finding({ message: `Cookie "${name}" is missing the Secure attribute — it can be sent over an unencrypted connection` })
        );
      }
      if (!hasAttribute(setCookie, "httponly")) {
        findings.push(
          ctx.finding({
            message: `Cookie "${name}" is missing the HttpOnly attribute — it's readable from JavaScript, widening the blast radius of an XSS bug`,
          })
        );
      }
      if (!hasAttribute(setCookie, "samesite")) {
        findings.push(
          ctx.finding({
            message: `Cookie "${name}" is missing the SameSite attribute — it defaults to a lax policy that still allows some cross-site requests`,
            severity: "info",
          })
        );
      }
    }

    return findings;
  },
});
