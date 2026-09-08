import { type ExecException, exec as execCallback } from "node:child_process";

export interface ExecOptions {
  cwd: string;
  /** Kill the process and reject if it runs longer than this. Default: 5 minutes. */
  timeoutMs?: number;
  /**
   * Some CLIs (npm audit, npm outdated, jscpd) use a non-zero exit code to report "found
   * something" rather than "crashed". When enabled, such an exit resolves with stdout or
   * stderr instead of rejecting. Disabled by default so that genuine failures, such as a
   * site's build command, surface as errors instead of being silently swallowed.
   */
  allowNonZeroExit?: boolean;
}

export interface ExecError extends Error {
  stdout: string;
  stderr: string;
  code: number | string | null;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export function exec(command: string, options: ExecOptions): Promise<string> {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, allowNonZeroExit = false } = options;

  return new Promise((resolve, reject) => {
    execCallback(command, { cwd, maxBuffer: 1024 * 1024 * 20, timeout: timeoutMs, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      if (error) {
        if (allowNonZeroExit && (stdout || stderr)) {
          resolve(stdout || stderr || "");
          return;
        }
        const execException = error as ExecException;
        const timedOut = execException.killed === true && execException.signal === "SIGKILL";
        const reason = timedOut ? `timed out after ${Math.round(timeoutMs / 1000)}s` : stderr.trim() || stdout.trim() || error.message;
        const execError = new Error(`Command "${command}" failed: ${reason}`) as ExecError;
        execError.stdout = stdout ?? "";
        execError.stderr = stderr ?? "";
        execError.code = execException.code ?? null;
        reject(execError);
        return;
      }
      resolve(stdout || stderr || "");
    });
  });
}
