import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { severityForOverage } from "@utils/budget.js";

export default defineCheck({
  id: "performance.core-web-vitals",
  name: "Core Web Vitals Budget",
  category: "performance",
  mode: "dynamic",
  severity: "warn",
  description: "Checks LCP and CLS against configured budgets.",
  async run(ctx) {
    const budgets = ctx.config.performance.budgets;

    const metrics = await ctx.page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number }>((resolve) => {
          let lcp = 0;
          let lastLcpAt = performance.now();
          const shifts: { value: number; startTime: number }[] = [];
          let lcpObserver: PerformanceObserver | undefined;
          let clsObserver: PerformanceObserver | undefined;

          try {
            lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const last = entries[entries.length - 1] as PerformanceEntry & {
                renderTime?: number;
                loadTime?: number;
              };
              if (last) {
                lcp = last.renderTime || last.loadTime || last.startTime;
                lastLcpAt = performance.now();
              }
            });
            lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

            clsObserver = new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              })[]) {
                if (!entry.hadRecentInput) shifts.push({ value: entry.value ?? 0, startTime: entry.startTime });
              }
            });
            clsObserver.observe({ type: "layout-shift", buffered: true });
          } catch {}

          function maxSessionWindowCls(entries: { value: number; startTime: number }[]): number {
            let maxSum = 0;
            let windowSum = 0;
            let windowStart = -1;
            let windowEnd = -1;
            for (const shift of [...entries].sort((a, b) => a.startTime - b.startTime)) {
              const startsNewWindow = windowStart === -1 || shift.startTime - windowEnd > 1000 || shift.startTime - windowStart > 5000;
              if (startsNewWindow) {
                windowStart = shift.startTime;
                windowSum = 0;
              }
              windowEnd = shift.startTime;
              windowSum += shift.value;
              maxSum = Math.max(maxSum, windowSum);
            }
            return maxSum;
          }

          const start = performance.now();
          const poll = () => {
            const now = performance.now();
            if (now - lastLcpAt >= 500 || now - start >= 3000) {
              lcpObserver?.disconnect();
              clsObserver?.disconnect();
              resolve({ lcp, cls: maxSessionWindowCls(shifts) });
              return;
            }
            setTimeout(poll, 100);
          };
          poll();
        })
    );

    const findings: Finding[] = [];

    ctx.detail({ label: "LCP", value: `${Math.round(metrics.lcp)}ms (budget: ${budgets.lcpMs}ms)`, url: ctx.pageInfo.urlPath });
    ctx.detail({ label: "CLS", value: `${metrics.cls.toFixed(3)} (budget: ${budgets.cls})`, url: ctx.pageInfo.urlPath });

    if (metrics.lcp > budgets.lcpMs) {
      findings.push(
        ctx.finding({
          message: `LCP ${Math.round(metrics.lcp)}ms exceeds budget of ${budgets.lcpMs}ms`,
          url: ctx.pageInfo.urlPath,
          severity: severityForOverage(metrics.lcp, budgets.lcpMs),
        })
      );
    }

    if (metrics.cls > budgets.cls) {
      findings.push(
        ctx.finding({
          message: `CLS ${metrics.cls.toFixed(3)} exceeds budget of ${budgets.cls}`,
          url: ctx.pageInfo.urlPath,
          severity: severityForOverage(metrics.cls, budgets.cls),
        })
      );
    }

    return findings;
  },
});
