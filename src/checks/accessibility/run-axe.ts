import { AxeBuilder } from "@axe-core/playwright";
import type { Severity } from "@core/types.js";
import type { Page } from "playwright";

export type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;

export const IMPACT_SEVERITY: Record<string, Severity> = {
  critical: "error",
  serious: "error",
  moderate: "warn",
  minor: "info",
};

const cache = new WeakMap<Page, Promise<AxeResults>>();

export function runAxe(page: Page): Promise<AxeResults> {
  let results = cache.get(page);
  if (!results) {
    results = new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Third-party iframes such as widgets and embeds are not the site owner's markup to
      // fix, so scanning into them would misattribute their violations. Passing
      // `.options({ iframes: false })` is not a valid alternative: AxeBuilder#options()
      // replaces the entire options object instead of merging, which would silently drop the
      // withTags() runOnly filter above.
      .exclude("iframe")
      .analyze();
    cache.set(page, results);
  }
  return results;
}
