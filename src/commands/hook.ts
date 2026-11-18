import * as p from "@clack/prompts";
import { t } from "@core/messages.js";
import { type HookMode, installHook, uninstallHook } from "@utils/git-hook.js";
import { detectPackageManager } from "@utils/package-manager.js";

export function hookInstallCommand(options: { mode: HookMode }, cwd: string = process.cwd()): void {
  const result = installHook(cwd, { mode: options.mode, pm: detectPackageManager(cwd) });
  const params = { path: result.path, command: result.command };
  if (result.status === "installed" || result.status === "updated") {
    p.log.success(t(`hook.${result.status}`, params));
    return;
  }
  p.log.warn(t(`hook.${result.status}`, params));
}

export function hookUninstallCommand(cwd: string = process.cwd()): void {
  const result = uninstallHook(cwd);
  const params = { path: result.path };
  if (result.status === "removed") p.log.success(t("hook.removed", params));
  else if (result.status === "missing") p.log.info(t("hook.missing", params));
  else if (result.status === "foreign") p.log.warn(t("hook.foreignUninstall", params));
  else p.log.warn(t("hook.huskyUninstall", params));
}
