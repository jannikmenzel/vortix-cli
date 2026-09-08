import os from "node:os";
import { type ExecError, exec } from "@utils/exec.js";
import { describe, expect, it } from "vitest";

describe("exec", () => {
  it("resolves with stdout on success", async () => {
    const output = await exec("node -e \"console.log('hi')\"", { cwd: os.tmpdir() });
    expect(output.trim()).toBe("hi");
  });

  it("rejects on a non-zero exit by default (build-command semantics)", async () => {
    await expect(exec('node -e "process.exit(1)"', { cwd: os.tmpdir() })).rejects.toThrow();
  });

  it("includes stderr output in the rejection so build failures are actionable", async () => {
    try {
      await exec("node -e \"console.error('boom'); process.exit(1)\"", { cwd: os.tmpdir() });
      expect.unreachable("expected exec to reject");
    } catch (error) {
      const execError = error as ExecError;
      expect(execError.stderr).toContain("boom");
      expect(execError.message).toContain("boom");
    }
  });

  it("resolves on non-zero exit when allowNonZeroExit is set (npm audit / npm outdated semantics)", async () => {
    const output = await exec("node -e \"console.log('partial'); process.exit(1)\"", {
      cwd: os.tmpdir(),
      allowNonZeroExit: true,
    });
    expect(output.trim()).toBe("partial");
  });

  it("kills a hung command after the configured timeout instead of hanging forever", async () => {
    await expect(exec('node -e "setTimeout(() => {}, 60000)"', { cwd: os.tmpdir(), timeoutMs: 200 })).rejects.toThrow(/timed out/);
  }, 5000);
});
