import type { CheckDefinition, CheckDetail, DetailInput } from "./types.js";

export function createDetailFactory(check: CheckDefinition, push: (detail: CheckDetail) => void) {
  return (input: DetailInput): void => {
    push({
      checkId: check.id,
      category: check.category,
      label: input.label,
      value: input.value,
      url: input.url,
    });
  };
}
