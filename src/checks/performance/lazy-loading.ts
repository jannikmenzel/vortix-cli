import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

interface ImageGeometry {
  src: string;
  loading: string | null;
  top: number;
  width: number;
  height: number;
}

export default defineCheck({
  id: "performance.lazy-loading",
  name: "Lazy Loading",
  category: "performance",
  mode: "dynamic",
  severity: "info",
  description:
    'Checks that images below the fold use loading="lazy", and flags the opposite mistake: an image visible without scrolling marked loading="lazy", which delays it and can hurt LCP. Needs real layout, so this runs in a browser rather than scanning the HTML.',
  async run(ctx) {
    const viewportHeight = ctx.page.viewportSize()?.height ?? 720;

    const images: ImageGeometry[] = await ctx.page.$$eval("img[src]", (elements) =>
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          src: el.getAttribute("src") ?? "",
          loading: el.getAttribute("loading"),
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      })
    );

    const eligible = images.filter((img) => img.width > 0 && img.height > 0);
    const lazyCount = eligible.filter((img) => img.loading === "lazy").length;
    ctx.detail({ label: "Images checked / marked lazy", value: `${eligible.length} / ${lazyCount}`, url: ctx.pageInfo.urlPath });

    const findings: Finding[] = [];
    for (const img of images) {
      if (img.width === 0 || img.height === 0) continue;

      const isAboveTheFold = img.top < viewportHeight;

      if (isAboveTheFold && img.loading === "lazy") {
        findings.push(
          ctx.finding({
            message: `Image "${img.src}" is visible without scrolling but marked loading="lazy" — delays it behind the loading queue and can hurt LCP`,
            url: ctx.pageInfo.urlPath,
            severity: "warn",
          })
        );
      } else if (!isAboveTheFold && img.loading !== "lazy") {
        findings.push(
          ctx.finding({
            message: `Image "${img.src}" is below the fold but missing loading="lazy"`,
            url: ctx.pageInfo.urlPath,
          })
        );
      }
    }

    return findings;
  },
});
