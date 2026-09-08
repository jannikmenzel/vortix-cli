import type { Severity } from "@core/types.js";

export function severityForOverage(actual: number, budget: number): Severity {
  if (budget <= 0) return "error";
  return actual >= budget * 1.5 ? "error" : "warn";
}
