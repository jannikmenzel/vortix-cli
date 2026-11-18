import { describeVulnerabilities } from "@checks/security/dependency-vulnerabilities.js";
import { describe, expect, it } from "vitest";

const PICOMATCH = {
  source: 1,
  name: "picomatch",
  title: "picomatch vulnerable to ReDoS through single-branch repeated extglobs",
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
  severity: "high",
};

describe("describeVulnerabilities", () => {
  it("attaches the advisory id of a direct vulnerability", () => {
    const [entry] = describeVulnerabilities({ vulnerabilities: { picomatch: { severity: "high", via: [PICOMATCH] } } });
    expect(entry.ids).toEqual(["GHSA-fc5q-39xc-vjpf"]);
    expect(entry.message).toBe(`picomatch: high severity vulnerability (${PICOMATCH.title}) [GHSA-fc5q-39xc-vjpf]`);
    expect(entry.severity).toBe("high");
  });

  it("follows transitive via chains to the root advisories", () => {
    const entries = describeVulnerabilities({
      vulnerabilities: {
        picomatch: { severity: "high", via: [PICOMATCH] },
        tinyglobby: { severity: "high", via: ["picomatch"] },
        astro: { severity: "high", via: ["tinyglobby", "picomatch"] },
      },
    });
    const astro = entries.find((e) => e.name === "astro");
    expect(astro?.ids).toEqual(["GHSA-fc5q-39xc-vjpf"]);
    expect(astro?.message).toBe("astro: high severity vulnerability via picomatch, tinyglobby [GHSA-fc5q-39xc-vjpf]");
  });

  it("collects every distinct advisory and survives cycles", () => {
    const entries = describeVulnerabilities({
      vulnerabilities: {
        a: { severity: "high", via: ["b", { source: 2, url: "https://github.com/advisories/GHSA-aaaa-aaaa-aaaa" }] },
        b: { severity: "moderate", via: ["a", { source: 3, url: "https://github.com/advisories/GHSA-bbbb-bbbb-bbbb" }] },
      },
    });
    expect(entries.find((e) => e.name === "a")?.ids).toEqual(["GHSA-aaaa-aaaa-aaaa", "GHSA-bbbb-bbbb-bbbb"]);
  });

  it("keeps the old message when no advisory url is known", () => {
    const [entry] = describeVulnerabilities({
      vulnerabilities: { pkg: { severity: "critical", via: [{ title: "Prototype Pollution" }] } },
    });
    expect(entry.ids).toEqual([]);
    expect(entry.message).toBe("pkg: critical severity vulnerability (Prototype Pollution)");
  });
});
