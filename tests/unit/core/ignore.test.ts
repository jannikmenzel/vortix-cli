import { applyIgnoreRules } from "@core/ignore.js";
import type { Finding, IgnoreRule } from "@core/types.js";
import { describe, expect, it } from "vitest";

const TODAY = new Date("2026-11-18T12:00:00Z");

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    checkId: "security.dependency-vulnerabilities",
    category: "security",
    severity: "error",
    message: "picomatch: high severity vulnerability",
    ...overrides,
  };
}

function apply(findings: Finding[], rules: IgnoreRule[]) {
  return applyIgnoreRules(findings, rules, TODAY);
}

describe("applyIgnoreRules", () => {
  it("keeps everything when there are no rules", () => {
    const result = apply([finding()], []);
    expect(result.kept).toHaveLength(1);
    expect(result.ignored).toHaveLength(0);
    expect(result.warnings).toEqual([]);
  });

  it("ignores all findings of a check", () => {
    const result = apply([finding(), finding({ checkId: "seo.title" })], [{ check: "security.dependency-vulnerabilities" }]);
    expect(result.kept.map((f) => f.checkId)).toEqual(["seo.title"]);
    expect(result.ignored).toHaveLength(1);
  });

  it("supports a trailing wildcard in check", () => {
    const result = apply([finding(), finding({ checkId: "seo.title" })], [{ check: "security.*" }]);
    expect(result.kept.map((f) => f.checkId)).toEqual(["seo.title"]);
  });

  it("matches message substrings", () => {
    const result = apply([finding(), finding({ message: "vite: high" })], [{ match: "picomatch" }]);
    expect(result.kept.map((f) => f.message)).toEqual(["vite: high"]);
  });

  it("matches message regexes written as /pattern/flags", () => {
    const result = apply([finding(), finding({ message: "VITE: high" })], [{ match: "/^vite:/i" }]);
    expect(result.kept.map((f) => f.message)).toEqual(["picomatch: high severity vulnerability"]);
  });

  it("requires every given field to match", () => {
    const result = apply([finding({ checkId: "seo.title", message: "picomatch" })], [{ check: "security.*", match: "picomatch" }]);
    expect(result.kept).toHaveLength(1);
  });

  it("matches file and url by substring", () => {
    const findings = [
      finding({ file: "dist/en/legacy/index.html" }),
      finding({ url: "/blog/post/" }),
      finding({ file: "dist/index.html" }),
    ];
    const result = apply(findings, [{ file: "/legacy/" }, { url: "/blog/" }]);
    expect(result.kept.map((f) => f.file)).toEqual(["dist/index.html"]);
  });

  it("ignores a finding by advisory id", () => {
    const result = apply([finding({ ids: ["GHSA-fc5q-39xc-vjpf"] })], [{ id: "GHSA-fc5q-39xc-vjpf" }]);
    expect(result.ignored).toHaveLength(1);
  });

  it("compares ids case-insensitively", () => {
    const result = apply([finding({ ids: ["GHSA-FC5Q-39XC-VJPF"] })], [{ id: "ghsa-fc5q-39xc-vjpf" }]);
    expect(result.ignored).toHaveLength(1);
  });

  it("keeps a finding while one of its ids is not ignored", () => {
    const result = apply([finding({ ids: ["GHSA-aaaa-aaaa-aaaa", "GHSA-bbbb-bbbb-bbbb"] })], [{ id: "GHSA-aaaa-aaaa-aaaa" }]);
    expect(result.kept).toHaveLength(1);
  });

  it("ignores a finding once all of its ids are covered across rules", () => {
    const result = apply(
      [finding({ ids: ["GHSA-aaaa-aaaa-aaaa", "GHSA-bbbb-bbbb-bbbb"] })],
      [{ id: "GHSA-aaaa-aaaa-aaaa" }, { id: "GHSA-bbbb-bbbb-bbbb" }]
    );
    expect(result.ignored).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("does not match id rules against findings without ids", () => {
    const result = apply([finding()], [{ id: "GHSA-fc5q-39xc-vjpf" }]);
    expect(result.kept).toHaveLength(1);
  });

  it("attaches the reason to ignored findings", () => {
    const result = apply([finding()], [{ match: "picomatch", reason: "no fix yet" }]);
    expect(result.ignored[0].ignoreReason).toBe("no fix yet");
  });

  it("stays active through the until date", () => {
    const result = apply([finding()], [{ match: "picomatch", until: "2026-11-18" }]);
    expect(result.ignored).toHaveLength(1);
  });

  it("stops applying after the until date and warns", () => {
    const result = apply([finding()], [{ match: "picomatch", until: "2026-11-17" }]);
    expect(result.kept).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("2026-11-17");
  });

  it("warns about rules that match nothing", () => {
    const result = apply([finding()], [{ match: "nothing-like-this" }]);
    expect(result.warnings).toHaveLength(1);
  });

  it("warns about rules without any matcher and ignores nothing", () => {
    const result = apply([finding()], [{ reason: "oops" }]);
    expect(result.kept).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("warns about invalid until dates and regexes", () => {
    const result = apply([finding()], [{ match: "picomatch", until: "soon" }, { match: "/[/" }]);
    expect(result.kept).toHaveLength(1);
    expect(result.warnings).toHaveLength(2);
  });

  it("matches every finding with a global regex", () => {
    const result = apply([finding(), finding()], [{ match: "/picomatch/g" }]);
    expect(result.ignored).toHaveLength(2);
  });

  it("skips rules with non-string fields instead of crashing", () => {
    const rules = [{ check: 5 }, { id: 123 }, { match: "picomatch", file: true }] as unknown as IgnoreRule[];
    const result = apply([finding({ ids: ["GHSA-x"] })], rules);
    expect(result.kept).toHaveLength(1);
    expect(result.warnings).toHaveLength(3);
  });

  it("does not report rules as unused when their check did not run", () => {
    const result = applyIgnoreRules([finding()], [{ check: "performance.*" }, { match: "nothing" }], TODAY, {
      ranCheckIds: ["security.dependency-vulnerabilities"],
      partial: true,
    });
    expect(result.warnings).toEqual([]);
  });

  it("still reports unused rules for checks that ran", () => {
    const result = applyIgnoreRules([finding()], [{ check: "security.*", match: "nothing" }], TODAY, {
      ranCheckIds: ["security.dependency-vulnerabilities"],
      partial: true,
    });
    expect(result.warnings).toHaveLength(1);
  });
});
