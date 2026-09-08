import * as p from "@clack/prompts";
import { t } from "@core/messages.js";
import { buildCheckDetail, buildHeader, buildScoreCard, checkOptionLabel } from "@core/report.js";
import type { RunResult } from "@core/runner.js";
import pc from "picocolors";

const DONE = "__done__";

export async function runInteractiveReport(result: RunResult): Promise<void> {
  for (const message of result.configErrors) {
    console.log(pc.yellow(`⚠ ${t("report.configErrorPrefix")}: ${message}`));
  }

  console.log(`\n${pc.bold(buildHeader(result))}\n`);
  // Printed as soon as the checks finish, rather than behind the "Done" option below.
  console.log(buildScoreCard(result));
  console.log("");

  const findingsByCheck = groupByCheckId(result.findings);
  const detailsByCheck = groupByCheckId(result.details);

  for (;;) {
    const options = result.checks.map((check) => {
      const { label, hint } = checkOptionLabel(check, findingsByCheck.get(check.id) ?? [], result.skipped[check.id]);
      return { value: check.id, label, hint };
    });
    options.push({ value: DONE, label: t("report.detailDoneOption"), hint: "" });

    const selected = await p.select({ message: t("report.detailSelectPrompt"), options });
    if (p.isCancel(selected) || selected === DONE) break;

    const check = result.checks.find((c) => c.id === selected);
    if (!check) continue;

    const text = buildCheckDetail(check, findingsByCheck.get(check.id) ?? [], detailsByCheck.get(check.id) ?? [], result.skipped[check.id]);
    p.note(text, check.name);

    const goBack = await p.select({
      message: t("report.detailContinuePrompt"),
      options: [{ value: true, label: t("report.detailBackOption") }],
    });
    if (p.isCancel(goBack)) break;
  }
}

function groupByCheckId<T extends { checkId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.checkId) ?? [];
    list.push(item);
    map.set(item.checkId, list);
  }
  return map;
}
