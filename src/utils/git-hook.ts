import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { t } from "@core/messages.js";
import type { PackageManager } from "./package-manager.js";

export type HookMode = "static" | "full";

export const HOOK_MARKER = "# vortix-managed-hook";

export interface InstallResult {
  status: "installed" | "updated" | "foreign" | "husky";
  path: string;
  command: string;
}

export interface UninstallResult {
  status: "removed" | "missing" | "foreign" | "husky";
  path: string;
}

export function buildHookCommand(pm: PackageManager, mode: HookMode): string {
  const runner = pm === "bun" ? "bunx" : "npx";
  return `${runner} vortix check${mode === "static" ? " --static" : ""} --no-interactive`;
}

export function buildHookScript(pm: PackageManager, mode: HookMode, projectDir = ""): string {
  const cd = projectDir ? `cd "${projectDir}" && ` : "";
  return `#!/bin/sh\n${HOOK_MARKER}\n${cd}exec ${buildHookCommand(pm, mode)}\n`;
}

export function installHook(cwd: string, options: { mode: HookMode; pm: PackageManager }): InstallResult {
  const command = buildHookCommand(options.pm, options.mode);
  const hooksDir = resolveHooksDir(cwd);
  const huskyDir = findHuskyDir(hooksDir);
  if (huskyDir) return { status: "husky", path: path.join(huskyDir, "pre-commit"), command };

  const hookPath = path.join(hooksDir, "pre-commit");
  const existed = existsSync(hookPath);
  if (existed && !isManaged(hookPath)) return { status: "foreign", path: hookPath, command };

  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(hookPath, buildHookScript(options.pm, options.mode, git(cwd, ["rev-parse", "--show-prefix"]).replace(/\/$/, "")), "utf-8");
  chmodSync(hookPath, 0o755);
  return { status: existed ? "updated" : "installed", path: hookPath, command };
}

export function uninstallHook(cwd: string): UninstallResult {
  const hooksDir = resolveHooksDir(cwd);
  const huskyDir = findHuskyDir(hooksDir);
  if (huskyDir) return { status: "husky", path: path.join(huskyDir, "pre-commit") };

  const hookPath = path.join(hooksDir, "pre-commit");
  if (!existsSync(hookPath)) return { status: "missing", path: hookPath };
  if (!isManaged(hookPath)) return { status: "foreign", path: hookPath };
  rmSync(hookPath);
  return { status: "removed", path: hookPath };
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    throw new Error(t("hook.notGitRepo"));
  }
}

function resolveHooksDir(cwd: string): string {
  return path.resolve(cwd, git(cwd, ["rev-parse", "--git-path", "hooks"]));
}

function findHuskyDir(hooksDir: string): string | undefined {
  const segments = hooksDir.split(path.sep);
  const index = segments.lastIndexOf(".husky");
  return index > 0 ? segments.slice(0, index + 1).join(path.sep) : undefined;
}

function isManaged(hookPath: string): boolean {
  return readFileSync(hookPath, "utf-8").includes(HOOK_MARKER);
}
