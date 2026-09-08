import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, getConfigPath, loadConfig } from "@core/config.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(config: object): void {
  const configDir = path.join(tmpDir, ".vortix");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path.join(configDir, "config.json"), JSON.stringify(config));
}

describe("getConfigPath", () => {
  it("returns .vortix/config.json path", () => {
    expect(getConfigPath("/project")).toBe("/project/.vortix/config.json");
  });
});

describe("loadConfig", () => {
  it("returns defaults when no config exists", () => {
    const config = loadConfig(tmpDir);
    expect(config.build).toBe(true);
    expect(config.failOn).toBe("error");
    expect(config.categories.performance).toBe(true);
    expect(config.performance.budgets.lcpMs).toBe(2500);
  });

  it("merges user config over defaults", () => {
    writeConfig({ build: false, failOn: "warn" });
    const config = loadConfig(tmpDir);
    expect(config.build).toBe(false);
    expect(config.failOn).toBe("warn");
    expect(config.categories.performance).toBe(true);
  });

  it("overrides specific categories while keeping others", () => {
    writeConfig({ categories: { performance: false, security: true } });
    const config = loadConfig(tmpDir);
    expect(config.categories.performance).toBe(false);
    expect(config.categories.security).toBe(true);
    expect(config.categories.accessibility).toBe(true);
  });

  it("merges performance budgets", () => {
    writeConfig({ performance: { budgets: { lcpMs: 3000 } } });
    const config = loadConfig(tmpDir);
    expect(config.performance.budgets.lcpMs).toBe(3000);
    expect(config.performance.budgets.cls).toBe(0.1);
  });

  it("appends tracker domains", () => {
    writeConfig({ privacy: { trackerDomains: ["example.com"] } });
    const config = loadConfig(tmpDir);
    expect(config.privacy.trackerDomains).toContain("example.com");
  });

  it("sets cwd to the provided path", () => {
    const config = loadConfig(tmpDir);
    expect(config.cwd).toBe(tmpDir);
  });

  it("throws on invalid JSON", () => {
    const configDir = path.join(tmpDir, ".vortix");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(path.join(configDir, "config.json"), "{invalid json");
    expect(() => loadConfig(tmpDir)).toThrow();
  });
});

describe("defineConfig", () => {
  it("returns config unchanged", () => {
    const input = { build: false };
    expect(defineConfig(input)).toBe(input);
  });
});
