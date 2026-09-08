import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { IMPACT_SEVERITY, runAxe } from "./run-axe.js";

export default defineCheck({
  id: "accessibility.color-contrast",
  name: "Color Contrast",
  category: "accessibility",
  mode: "dynamic",
  severity: "warn",
  description: "Checks color contrast ratios using axe-core.",
  async run(ctx) {
    const findings: Finding[] = [];
    const results = await runAxe(ctx.page);

    let elementsChecked = 0;
    let elementsFailed = 0;
    for (const violation of results.violations) {
      if (violation.id === "color-contrast") {
        elementsFailed += violation.nodes.length;
        for (const node of violation.nodes) {
          findings.push(
            ctx.finding({
              message: `Color contrast: ${node.html.substring(0, 100)}`,
              url: ctx.pageInfo.urlPath,
              severity: IMPACT_SEVERITY[violation.impact ?? "moderate"] ?? "warn",
            })
          );
        }
      }
    }
    for (const pass of results.passes) {
      if (pass.id === "color-contrast") elementsChecked += pass.nodes.length;
    }
    elementsChecked += elementsFailed;

    ctx.detail({
      label: "Elements checked / failing contrast",
      value: `${elementsChecked} / ${elementsFailed}`,
      url: ctx.pageInfo.urlPath,
    });

    return findings;
  },
});
