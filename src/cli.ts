#!/usr/bin/env node
import { checkCommand } from "@commands/check";
import { ciCommand } from "@commands/ci";
import { configCommand } from "@commands/config";
import { hookInstallCommand, hookUninstallCommand } from "@commands/hook";
import { initCommand } from "@commands/init";
import { t } from "@core/messages.js";
import { Command } from "commander";
import pc from "picocolors";

const program = new Command();

program.name("vortix").description(t("cli.description")).version("0.1.0");

program
  .command("init")
  .description(t("cli.init.description"))
  .action(async () => {
    await initCommand();
  });

program
  .command("config")
  .description(t("cli.config.description"))
  .action(async () => {
    await configCommand();
  });

program
  .command("check")
  .description(t("cli.check.description"))
  .argument("[url]", "Optional live URL to check against")
  .option("--static", t("cli.staticOption"))
  .option("--no-interactive", t("cli.check.noInteractiveOption"))
  .action(async (url: string | undefined, options: { static?: boolean; interactive: boolean }) => {
    await checkCommand({ url, staticOnly: options.static, interactive: options.interactive });
  });

program
  .command("ci")
  .description(t("cli.ci.description"))
  .argument("[url]", "Optional live URL to check against")
  .option("--static", t("cli.staticOption"))
  .action(async (url: string | undefined, options: { static?: boolean }) => {
    await ciCommand({ url, staticOnly: options.static });
  });

const hook = program.command("hook").description(t("cli.hook.description"));

hook
  .command("install")
  .description(t("cli.hook.installDescription"))
  .option("--full", t("cli.hook.fullOption"))
  .action((options: { full?: boolean }) => {
    hookInstallCommand({ mode: options.full ? "full" : "static" });
  });

hook
  .command("uninstall")
  .description(t("cli.hook.uninstallDescription"))
  .action(() => {
    hookUninstallCommand();
  });

program.parseAsync(process.argv).catch((error: Error) => {
  process.exitCode = 1;
  process.stderr.write(pc.red(`\n${error.message}\n`), () => process.exit(1));
});
