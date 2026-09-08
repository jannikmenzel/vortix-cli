import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

const DISCLOSURE_HEADERS = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"];

const VERSION_PATTERN = /\d+\.\d+/;

export default defineCheck({
  id: "security.server-info-disclosure",
  name: "Server Info Disclosure",
  category: "security",
  mode: "live",
  severity: "info",
  description: "Flags response headers (Server, X-Powered-By, ...) that disclose server software or version numbers to attackers.",
  run(ctx) {
    const findings: Finding[] = [];

    for (const header of DISCLOSURE_HEADERS) {
      const value = ctx.headers[header];
      ctx.detail({ label: header, value: value ?? "(not sent)" });
      if (!value) continue;

      const revealsVersion = VERSION_PATTERN.test(value);
      findings.push(
        ctx.finding({
          message: `"${header}" header discloses ${revealsVersion ? "a specific software version" : "server software"}: "${value}"`,
          severity: revealsVersion ? "warn" : "info",
        })
      );
    }

    return findings;
  },
});
