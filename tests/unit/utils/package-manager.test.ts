import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectPackageManager } from "@utils/package-manager.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-pm-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("detectPackageManager", () => {
  it("defaults to npm when no lockfile is present", () => {
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", () => {
    writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("yarn");
  });

  it("detects bun from bun.lockb", () => {
    writeFileSync(path.join(tmpDir, "bun.lockb"), "");
    expect(detectPackageManager(tmpDir)).toBe("bun");
  });

  it("detects bun from bun.lock (the newer text lockfile format)", () => {
    writeFileSync(path.join(tmpDir, "bun.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("bun");
  });

  it("prefers pnpm over yarn when both lockfiles are somehow present", () => {
    writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });
});
