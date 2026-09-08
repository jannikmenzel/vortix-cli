#!/usr/bin/env node
import { checkCommand } from "@commands/check";
import { ciCommand } from "@commands/ci";
import { configCommand } from "@commands/config";
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
  .action(async (url?: string) => {
    await checkCommand({ url });
  });

program
  .command("ci")
  .description(t("cli.ci.description"))
  .argument("[url]", "Optional live URL to check against")
  .action(async (url?: string) => {
    await ciCommand({ url });
  });

program.parseAsync(process.argv).catch((error: Error) => {
  process.exitCode = 1;
  process.stderr.write(pc.red(`\n${error.message}\n`), () => process.exit(1));
});
