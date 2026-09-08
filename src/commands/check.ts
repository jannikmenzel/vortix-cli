import * as p from "@clack/prompts";
import { loadConfig } from "@core/config.js";
import { t } from "@core/messages.js";
import { buildFullReport, printReport } from "@core/report.js";
import { runVortix } from "@core/runner.js";
import { copyToClipboard } from "@utils/clipboard.js";
import { runInteractiveReport } from "./detail-ui.js";
import { createProgressHandler } from "./progress-ui.js";

interface CheckOptions {
  url?: string;
}

export async function checkCommand(options: CheckOptions = {}): Promise<void> {
  const config = loadConfig(process.cwd());

  const result = await runVortix(config, createProgressHandler(), options.url);

  if (process.stdout.isTTY) {
    await runInteractiveReport(result);

    const shouldCopy = await p.confirm({ message: t("report.copyPrompt"), initialValue: true });
    if (!p.isCancel(shouldCopy) && shouldCopy) {
      const copied = copyToClipboard(buildFullReport(result));
      if (copied) {
        p.log.success(t("report.copied"));
      } else {
        p.log.error(t("report.copyFailed"));
      }
    }
  } else {
    printReport(result);
  }

  process.exitCode = result.exitCode;
}
