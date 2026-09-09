import { loadConfig } from "@core/config.js";
import { runVortix } from "@core/runner.js";
import { createProgressHandler } from "./progress-ui.js";

interface CiOptions {
  url?: string;
}

export async function ciCommand(options: CiOptions = {}): Promise<void> {
  const config = loadConfig(process.cwd());

  const result = await runVortix(config, createProgressHandler(process.stderr), options.url);

  console.log(
    JSON.stringify(
      {
        adapter: result.adapterName,
        pagesChecked: result.pagesChecked,
        pagesCached: result.pagesCached,
        totalPages: result.totalPages,
        liveUrl: result.liveUrl,
        checks: result.checks,
        findings: result.findings,
        details: result.details,
        skipped: result.skipped,
        configErrors: result.configErrors,
      },
      null,
      2
    )
  );
  process.exitCode = result.exitCode;
}
