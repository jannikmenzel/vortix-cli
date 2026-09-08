import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUILT_IN_ADAPTERS, detectAdapter } from "@adapters/index.js";
import * as p from "@clack/prompts";
import { CONFIG_DIR, getConfigPath } from "@core/config.js";
import { t } from "@core/messages.js";
import type { Category, Severity, VortixConfig } from "@core/types.js";
import { CATEGORIES } from "@core/types.js";
import { buildGithubWorkflowYaml, getGithubWorkflowPath } from "@utils/github-workflow.js";
import { detectPackageManager } from "@utils/package-manager.js";
import pc from "picocolors";

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bold(t("init.intro")));

  const configPath = getConfigPath(cwd);
  if (existsSync(configPath)) {
    const overwrite = await p.confirm({ message: t("init.configExists"), initialValue: false });
    if (p.isCancel(overwrite) || !overwrite) return abort(t("init.abortedKept"));
  }

  const result = await runPrompts(cwd, null);
  if (result === undefined) return;

  mkdirSync(path.join(cwd, CONFIG_DIR), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

  await promptGithubWorkflow(cwd);

  p.outro(pc.green(t("init.done", { cmd: pc.bold("npx vortix check") })));
}

async function promptGithubWorkflow(cwd: string): Promise<void> {
  const setup = await p.confirm({ message: t("init.pickGithubWorkflow"), initialValue: true });
  if (p.isCancel(setup) || !setup) return;

  const workflowPath = getGithubWorkflowPath(cwd);
  const relativePath = path.relative(cwd, workflowPath);
  if (existsSync(workflowPath)) {
    const overwrite = await p.confirm({ message: t("init.githubWorkflowExists", { path: relativePath }), initialValue: false });
    if (p.isCancel(overwrite) || !overwrite) {
      p.log.info(t("init.githubWorkflowSkipped"));
      return;
    }
  }

  mkdirSync(path.dirname(workflowPath), { recursive: true });
  writeFileSync(workflowPath, buildGithubWorkflowYaml(detectPackageManager(cwd)), "utf-8");
  p.log.success(t("init.githubWorkflowDone", { path: relativePath }));
}

export async function runPrompts(cwd: string, existing: VortixConfig | null): Promise<VortixConfig | undefined> {
  const adapterName = await resolveAdapterChoice(cwd, existing?.target?.adapter);
  if (adapterName === undefined) return undefined;

  const initialCategories = existing?.categories ? CATEGORIES.filter((c) => existing.categories?.[c] !== false) : [...CATEGORIES];

  const categories = await p.multiselect<Category>({
    message: t("init.pickCategories"),
    options: CATEGORIES.map((category) => ({ value: category, label: category })),
    initialValues: initialCategories,
  });
  if (p.isCancel(categories)) return abort();

  const failOn = await p.select<Severity>({
    message: t("init.pickFailOn"),
    options: [
      { value: "error", label: t("init.failOnRecommended") },
      { value: "warn", label: "warn" },
      { value: "info", label: "info" },
    ],
    initialValue: existing?.failOn ?? "error",
  });
  if (p.isCancel(failOn)) return abort();

  const isKnownAdapter = BUILT_IN_ADAPTERS.some((a) => a.name === adapterName);
  return {
    ...existing,
    target: isKnownAdapter
      ? { adapter: adapterName }
      : {
          buildCommand: existing?.target?.buildCommand ?? "<your build command>",
          outputDir: existing?.target?.outputDir ?? "<your output folder>",
        },
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, categories.includes(c)])) as Record<Category, boolean>,
    failOn,
  };
}

async function resolveAdapterChoice(cwd: string, currentAdapter?: string): Promise<string | undefined> {
  const detected = detectAdapter(cwd);

  if (detected && !currentAdapter) {
    const useDetected = await p.confirm({ message: t("init.detectedStack", { name: detected.name }), initialValue: true });
    if (p.isCancel(useDetected)) return undefined;
    if (useDetected) return detected.name;
  } else if (currentAdapter) {
    return currentAdapter;
  } else {
    p.log.warn(t("init.noGeneratorDetected"));
  }

  const choice = await p.select<string>({
    message: t("init.pickStack"),
    options: [
      ...BUILT_IN_ADAPTERS.map((adapter) => ({ value: adapter.name, label: adapter.name })),
      { value: "manual", label: t("init.manualOption") },
    ],
  });
  if (p.isCancel(choice)) return undefined;
  return choice;
}

function abort(message: string = t("init.aborted")): undefined {
  p.cancel(message);
  process.exitCode = 1;
  return undefined;
}
