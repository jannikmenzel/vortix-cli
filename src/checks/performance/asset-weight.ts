import { defineCheck } from "@core/define-check.js";
import type { CapturedNetworkRequest, Finding } from "@core/types.js";
import { severityForOverage } from "@utils/budget.js";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

function assetPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function isImageRequest(req: CapturedNetworkRequest): boolean {
  return req.contentType ? IMAGE_TYPES.includes(req.contentType.split(";")[0].trim()) : false;
}

export default defineCheck({
  id: "performance.asset-weight",
  name: "Asset Weight & Image Sizes",
  category: "performance",
  mode: "dynamic",
  severity: "warn",
  description: "Checks total page weight and individual oversized images.",
  async run(ctx) {
    const budgets = ctx.config.performance.budgets;
    const findings: Finding[] = [];

    const totalKb = ctx.networkRequests.reduce((sum, r) => sum + r.bodySize, 0) / 1024;
    ctx.detail({
      label: "Page weight",
      value: `${Math.round(totalKb)}KB (budget: ${budgets.maxPageWeightKb}KB)`,
      url: ctx.pageInfo.urlPath,
    });

    const images = ctx.networkRequests.filter(isImageRequest);
    if (images.length > 0) {
      const largestKb = Math.max(...images.map((r) => r.bodySize)) / 1024;
      ctx.detail({
        label: "Largest image",
        value: `${Math.round(largestKb)}KB (budget: ${budgets.maxImageKb}KB)`,
        url: ctx.pageInfo.urlPath,
      });
    }

    if (totalKb > budgets.maxPageWeightKb) {
      findings.push(
        ctx.finding({
          message: `Page weight ${Math.round(totalKb)}KB exceeds budget of ${budgets.maxPageWeightKb}KB`,
          url: ctx.pageInfo.urlPath,
          severity: severityForOverage(totalKb, budgets.maxPageWeightKb),
        })
      );
    }

    for (const req of images) {
      const sizeKb = req.bodySize / 1024;
      if (sizeKb > budgets.maxImageKb) {
        findings.push(
          ctx.finding({
            message: `Image "${assetPath(req.url)}" is ${Math.round(sizeKb)}KB (budget: ${budgets.maxImageKb}KB)`,
            url: ctx.pageInfo.urlPath,
            severity: severityForOverage(sizeKb, budgets.maxImageKb),
          })
        );
      }
    }

    return findings;
  },
});
