import { defineCheck } from "@core/define-check.js";

export default defineCheck({
  id: "security.https-enforced",
  name: "HTTPS Enforced",
  category: "security",
  mode: "live",
  severity: "error",
  description: "Checks that the site is served over HTTPS, or at least redirects HTTP requests to HTTPS.",
  run(ctx) {
    ctx.detail({ label: "Protocol", value: ctx.parsedUrl.protocol.replace(":", "") });
    ctx.detail({ label: "Final URL", value: ctx.finalUrl });

    if (ctx.parsedUrl.protocol === "https:") return [];

    if (ctx.redirected && ctx.finalUrl.startsWith("https://")) {
      return [
        ctx.finding({
          message: `HTTP requests redirect to HTTPS (ended up at "${ctx.finalUrl}"), but the initial connection is still unencrypted — link directly to the HTTPS URL and add a Strict-Transport-Security header`,
          severity: "info",
        }),
      ];
    }

    return [
      ctx.finding({
        message:
          "Site is served over plain HTTP and does not redirect to HTTPS — traffic (including any credentials) can be intercepted or modified in transit",
        severity: "error",
      }),
    ];
  },
});
