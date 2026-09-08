import type { CheckDefinition, Finding, FindingInput, Severity } from "./types.js";

export function createFindingFactory(check: CheckDefinition, configuredSeverity: Severity | undefined) {
  return (input: FindingInput): Finding => ({
    checkId: check.id,
    category: check.category,
    severity: configuredSeverity ?? input.severity ?? check.severity ?? "warn",
    message: input.message,
    file: input.file,
    url: input.url,
  });
}
