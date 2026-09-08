import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runVortix } from "@core/runner.js";
import { describe, expect, it, vi } from "vitest";
import { buildConfig, findingsFor, fixturePath } from "./support.js";

const FAKE_AUDIT = {
  vulnerabilities: {
    "vulnerable-pkg": { severity: "critical", via: [{ title: "Prototype Pollution" }] },
  },
};

const FAKE_OUTDATED = {
  "vulnerable-pkg": { current: "1.0.0", latest: "2.0.0" },
};

// npm audit and npm outdated need a real registry round trip, which a hermetic e2e run must
// not depend on, so exec is mocked for those two commands. jscpd, the other ctx.exec consumer,
// is not needed here (see disabledChecks below), so no passthrough is required.
vi.mock("@utils/exec.js", () => ({
  exec: vi.fn(async (command: string) => {
    if (command.startsWith("npm audit")) return JSON.stringify(FAKE_AUDIT);
    if (command.startsWith("npm outdated")) return JSON.stringify(FAKE_OUTDATED);
    throw new Error(`unexpected exec call in astro-dependencies.test.ts: ${command}`);
  }),
}));

describe("astro fixture — dependency-aware checks (package.json + node_modules present)", () => {
  it("reports a vulnerable, outdated, and copyleft-licensed dependency", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-astro-deps-"));
    cpSync(fixturePath("astro"), tmpDir, { recursive: true });

    writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify(
        {
          name: "astro-fixture-with-deps",
          version: "0.0.0",
          dependencies: { "vulnerable-pkg": "^1.0.0", "copyleft-lib": "^1.0.0" },
        },
        null,
        2
      )
    );
    writeFileSync(path.join(tmpDir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));

    mkdirSync(path.join(tmpDir, "node_modules", "vulnerable-pkg"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "node_modules", "vulnerable-pkg", "package.json"),
      JSON.stringify({ name: "vulnerable-pkg", version: "1.0.0", license: "MIT" })
    );
    mkdirSync(path.join(tmpDir, "node_modules", "copyleft-lib"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "node_modules", "copyleft-lib", "package.json"),
      JSON.stringify({ name: "copyleft-lib", version: "1.0.0", license: "GPL-3.0" })
    );

    try {
      const result = await runVortix(
        buildConfig(tmpDir, {
          categories: {
            security: true,
            maintainability: true,
            performance: false,
            accessibility: false,
            bugs: false,
            seo: false,
            privacy: false,
          },
          disabledChecks: ["maintainability.duplication", "maintainability.dead-css"],
        })
      );

      expect(result.adapterName).toBe("astro");

      const audit = findingsFor(result.findings, "security.dependency-vulnerabilities");
      expect(audit.length).toBe(1);
      expect(audit[0].message).toContain("vulnerable-pkg");
      expect(audit[0].message).toContain("critical");
      expect(audit[0].severity).toBe("error");

      const outdated = findingsFor(result.findings, "maintainability.outdated-dependencies");
      expect(outdated.length).toBe(1);
      expect(outdated[0].message).toBe("vulnerable-pkg: current 1.0.0, latest 2.0.0");

      const license = findingsFor(result.findings, "maintainability.license-check");
      expect(license.some((f) => f.message.includes("copyleft-lib") && f.message.includes("GPL-3.0"))).toBe(true);
      expect(license.some((f) => f.message.includes("vulnerable-pkg"))).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30000);
});
