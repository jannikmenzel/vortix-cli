import type { Writable } from "node:stream";
import * as p from "@clack/prompts";
import { t } from "@core/messages.js";
import type { OnProgress, ProgressEvent } from "@core/runner.js";

// clack's spinner erases the previous frame by re-wrapping it to the terminal width. Once a
// message is long enough to wrap, that erase calculation no longer matches what is on screen
// and stale frames accumulate instead of being cleared, which appears as duplicated progress
// bars. Keeping every message on a single line avoids the problem entirely. The bar itself
// (`size: 30`) plus its icon, spacing and timer suffix consume a roughly constant part of the
// line, so reserve that budget and truncate whatever variable text remains.
const PROGRESS_BAR_OVERHEAD = 50;
const MIN_TEXT_WIDTH = 20;
const DEFAULT_COLUMNS = 80;

function truncateForLine(text: string, prefixLength: number, output?: Writable): string {
  const columns =
    output && "columns" in output && typeof output.columns === "number" ? output.columns : (process.stdout.columns ?? DEFAULT_COLUMNS);
  const available = Math.max(MIN_TEXT_WIDTH, columns - PROGRESS_BAR_OVERHEAD - prefixLength);
  return text.length > available ? `${text.slice(0, available - 1)}…` : text;
}

export function createProgressHandler(output?: Writable): OnProgress {
  const spin = p.spinner({ output, indicator: "timer" });
  let bar: ReturnType<typeof p.progress> | undefined;

  return (event: ProgressEvent) => {
    switch (event.type) {
      case "build-start":
        spin.start(t("progress.building"));
        break;
      case "build-done":
        spin.stop(t("progress.buildDone"));
        break;
      case "static-start":
        if (event.total > 0) spin.start(t("progress.staticStart", { total: event.total }));
        break;
      case "static-check":
        spin.message(t("progress.staticRunning", { index: event.index, total: event.total, name: event.check.name }));
        break;
      case "static-done":
        if (event.total > 0) spin.stop(t("progress.staticDone", { total: event.total }));
        break;
      case "dynamic-start":
        bar = p.progress({ max: event.total, size: 30, output, indicator: "timer" });
        bar.start(t("progress.dynamicStart", { total: event.total }));
        break;
      case "dynamic-page-start": {
        const prefix = t("progress.dynamicPageRunning", { index: event.index, total: event.total, urlPath: "" });
        const urlPath = truncateForLine(event.pageInfo.urlPath, prefix.length, output);
        bar?.message(t("progress.dynamicPageRunning", { index: event.index, total: event.total, urlPath }));
        break;
      }
      case "dynamic-page-done":
        bar?.advance(1, t("progress.dynamicPageDone", { index: event.index, total: event.total }));
        break;
      case "dynamic-done":
        bar?.stop(t("progress.dynamicDone", { total: event.total }));
        break;
      case "live-start":
        if (event.total > 0) spin.start(t("progress.liveStart", { url: event.url, total: event.total }));
        break;
      case "live-check":
        spin.message(t("progress.liveRunning", { index: event.index, total: event.total, name: event.check.name }));
        break;
      case "live-done":
        if (event.total > 0) spin.stop(t("progress.liveDone", { total: event.total }));
        break;
      case "aborted":
        spin.error(t("progress.aborted"));
        bar?.error(t("progress.aborted"));
        break;
    }
  };
}
