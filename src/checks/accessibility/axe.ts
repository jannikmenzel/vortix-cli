import { defineCheck } from "@core/define-check.js";
import { IMPACT_SEVERITY, runAxe } from "./run-axe.js";

export default defineCheck({
  id: "accessibility.axe",
  name: "WCAG Accessibility (axe-core)",
  category: "accessibility",
  mode: "dynamic",
  severity: "warn",
  description: "WCAG 2.1 A/AA violations via axe-core.",
  async run(ctx) {
    const results = await runAxe(ctx.page);

    ctx.detail({
      label: "Rules checked / passed / violated",
      value: `${results.passes.length + results.violations.length} / ${results.passes.length} / ${results.violations.length}`,
      url: ctx.pageInfo.urlPath,
    });

    return results.violations.map((violation) =>
      ctx.finding({
        message: `${violation.help} (${violation.id}, affects ${violation.nodes.length} element(s))`,
        url: ctx.pageInfo.urlPath,
        severity: IMPACT_SEVERITY[violation.impact ?? "moderate"] ?? "warn",
      })
    );
  },
});
