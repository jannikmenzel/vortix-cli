import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { CONFIG_DIR, getConfigPath } from "@core/config.js";
import { t } from "@core/messages.js";
import type { VortixConfig } from "@core/types.js";
import pc from "picocolors";
import { runPrompts } from "./init.js";

export async function configCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = getConfigPath(cwd);

  p.intro(pc.bold(t("config.intro")));

  let existing: VortixConfig | null = null;
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      p.log.warn(t("config.corrupt"));
    }
  } else {
    p.log.warn(t("config.noConfig"));
  }

  const result = await runPrompts(cwd, existing);
  if (result === undefined) return;

  mkdirSync(path.join(cwd, CONFIG_DIR), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
  p.outro(pc.green(t("config.done")));
}
