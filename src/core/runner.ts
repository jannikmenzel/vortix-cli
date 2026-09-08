import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resolveAdapter } from "@adapters/index.js";
import { startStaticServer } from "@dynamic/serve.js";
import { attachCapture } from "@dynamic/session.js";
import { exec } from "@utils/exec.js";
import { globFiles } from "@utils/glob.js";
import { humanizeCheckId } from "@utils/humanize.js";
import { collectPages } from "@utils/pages.js";
import { chromium, type Page } from "playwright";
import { createDetailFactory } from "./detail.js";
import { createFindingFactory } from "./finding.js";
import { loadChecks } from "./load-checks.js";
import { t } from "./messages.js";
import { SEVERITY_RANK } from "./score.js";
import type {
  CheckDefinition,
  CheckDetail,
  CheckSummary,
  DynamicCheckContext,
  Finding,
  LiveCheckContext,
  PageInfo,
  ResolvedConfig,
  Severity,
  StaticCheckContext,
} from "./types.js";

const BUILD_TIMEOUT_MS = 10 * 60_000;
const CHECK_EXEC_TIMEOUT_MS = 3 * 60_000;
const PAGE_NAV_TIMEOUT_MS = 15_000;
const LIVE_FETCH_TIMEOUT_MS = 15_000;

export interface RunResult {
  findings: Finding[];
  details: CheckDetail[];
  checks: CheckSummary[];
  skipped: Record<string, string>;
  adapterName: string;
  outputDir: string;
  pagesChecked: number;
  totalPages: number;
  liveUrl?: string;
  exitCode: number;
  /** Custom check modules from config.checks[] that failed to load. Never fatal to the run. */
  configErrors: string[];
}

class CheckSkipped extends Error {}

export type ProgressEvent =
  | { type: "build-start" }
  | { type: "build-done" }
  | { type: "static-start"; index: number; total: number }
  | { type: "static-check"; check: CheckSummary; index: number; total: number }
  | { type: "static-done"; total: number }
  | { type: "dynamic-start"; index: number; total: number }
  | { type: "dynamic-page-start"; pageInfo: PageInfo; index: number; total: number }
  | { type: "dynamic-page-done"; pageInfo: PageInfo; index: number; total: number }
  | { type: "dynamic-done"; total: number }
  | { type: "live-start"; url: string; index: number; total: number }
  | { type: "live-check"; check: CheckSummary; index: number; total: number }
  | { type: "live-done"; total: number }
  | { type: "aborted" };

export type OnProgress = (event: ProgressEvent) => void;

function computeExitCode(findings: Finding[], config: ResolvedConfig): number {
  return findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[config.failOn]) ? 1 : 0;
}

export async function runVortix(config: ResolvedConfig, onProgress: OnProgress = () => {}, liveUrl?: string): Promise<RunResult> {
  try {
    return await runVortixUnsafe(config, onProgress, liveUrl);
  } catch (error) {
    onProgress({ type: "aborted" });
    throw error;
  }
}

async function runVortixUnsafe(config: ResolvedConfig, onProgress: OnProgress, liveUrl?: string): Promise<RunResult> {
  const adapter = resolveAdapter(config.cwd, config.target, config.build);
  const declaredOutputDir = path.resolve(config.cwd, adapter.outputDir);

  if (config.build) {
    onProgress({ type: "build-start" });
    try {
      await exec(adapter.buildCommand, { cwd: config.cwd, timeoutMs: BUILD_TIMEOUT_MS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(t("errors.buildFailed", { command: adapter.buildCommand, message }));
    }
    onProgress({ type: "build-done" });
  }
  if (!existsSync(declaredOutputDir)) {
    throw new Error(t("errors.outputDirMissing", { dir: declaredOutputDir }));
  }
  const outputDir = adapter.resolveServeDir?.(declaredOutputDir) ?? declaredOutputDir;

  const { checks, loadErrors } = await loadChecks(config);
  const configErrors = loadErrors.map((e) => `${e.specifier}: ${e.message}`);
  const staticChecks = checks.filter((c) => c.mode === "static");
  const dynamicChecks = checks.filter((c) => c.mode === "dynamic");
  const liveChecks = checks.filter((c) => c.mode === "live");
  const checkSummaries = new Map<string, CheckSummary>(checks.map((c) => [c.id, toSummary(c)]));

  const pages = await collectPages(outputDir);
  if (pages.length === 0) {
    throw new Error(t("errors.noPagesFound", { dir: outputDir }));
  }

  const findings: Finding[] = [];
  const details: CheckDetail[] = [];
  const skipped = new Map<string, string>();

  const skip = (reason: string): never => {
    throw new CheckSkipped(reason);
  };

  const baseHelpers = {
    siteRoot: config.cwd,
    outputDir,
    config,
    exec: (command: string) => exec(command, { cwd: config.cwd, timeoutMs: CHECK_EXEC_TIMEOUT_MS, allowNonZeroExit: true }),
    glob: (pattern: string, options?: { cwd?: string }) => globFiles(pattern, { cwd: options?.cwd ?? config.cwd }),
    readFile: (filePath: string) => {
      const ext = filePath.split(".").pop()?.toLowerCase();
      if (
        ext &&
        [
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
          "avif",
          "svg",
          "ico",
          "woff",
          "woff2",
          "ttf",
          "eot",
          "otf",
          "pdf",
          "zip",
          "gz",
          "mp3",
          "mp4",
          "webm",
        ].includes(ext)
      ) {
        throw new Error(`Cannot read binary file: ${filePath}`);
      }
      return readFileSync(filePath, "utf-8");
    },
    fileExists: (filePath: string) => {
      try {
        return statSync(filePath).isFile();
      } catch {
        return false;
      }
    },
    skip,
  };

  onProgress({ type: "static-start", index: 0, total: staticChecks.length });
  for (const [index, check] of staticChecks.entries()) {
    onProgress({ type: "static-check", check: toSummary(check), index: index + 1, total: staticChecks.length });
    const ctx: StaticCheckContext = {
      ...baseHelpers,
      mode: "static",
      pages,
      finding: createFindingFactory(check, config.severity[check.id]),
      detail: createDetailFactory(check, (d) => details.push(d)),
    };
    const result = await safeRun(check, ctx, config);
    findings.push(...result.findings);
    if (result.skipped) skipped.set(check.id, result.skipped);
  }
  onProgress({ type: "static-done", total: staticChecks.length });

  let pagesChecked = 0;
  if (dynamicChecks.length > 0 && pages.length > 0) {
    onProgress({ type: "dynamic-start", index: 0, total: pages.length });
    const server = await startStaticServer(outputDir);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      // Missing browser binaries disable dynamic checks only. Static and live checks need no
      // browser at all and must still run below.
      for (const check of dynamicChecks) skipped.set(check.id, t("progress.playwrightMissing"));
    }

    if (browser) {
      try {
        const browserContext = await browser.newContext();
        try {
          for (const [index, pageInfo] of pages.entries()) {
            onProgress({ type: "dynamic-page-start", pageInfo, index: index + 1, total: pages.length });
            let page: Page | undefined;
            let capture: ReturnType<typeof attachCapture> | undefined;
            try {
              // newPage() and attachCapture belong inside this try: if a crashed browser
              // context fails to open a page, the failure must stay scoped to this page
              // rather than abort the run.
              page = await browserContext.newPage();
              capture = attachCapture(page);
              try {
                await page.goto(server.url + pageInfo.urlPath, { waitUntil: "networkidle", timeout: PAGE_NAV_TIMEOUT_MS });
              } catch {
                // Pages with long polling, websockets or slow third-party embeds may never
                // reach networkidle. Retry with a plain load before giving up on the page.
                await page.goto(server.url + pageInfo.urlPath, { waitUntil: "load", timeout: PAGE_NAV_TIMEOUT_MS });
              }
              pagesChecked++;
              for (const check of dynamicChecks) {
                const ctx: DynamicCheckContext = {
                  ...baseHelpers,
                  mode: "dynamic",
                  page,
                  pageInfo,
                  consoleMessages: capture.consoleMessages,
                  networkRequests: capture.networkRequests,
                  finding: createFindingFactory(check, config.severity[check.id]),
                  detail: createDetailFactory(check, (d) => details.push(d)),
                };
                const result = await safeRun(check, ctx, config);
                findings.push(...result.findings);
                if (result.skipped) skipped.set(check.id, result.skipped);
              }
            } catch (error) {
              // Isolate a single unreachable or broken page so it cannot abort dynamic checks
              // for the rest of the site. The failure is reported as a finding on every dynamic
              // check instead.
              const message = t("errors.pageCrashed", {
                url: pageInfo.urlPath,
                message: error instanceof Error ? error.message : String(error),
              });
              for (const check of dynamicChecks) {
                findings.push({
                  checkId: check.id,
                  category: check.category,
                  severity: resolveSeverity(check, config),
                  message,
                  url: pageInfo.urlPath,
                });
              }
            } finally {
              capture?.detach();
              await page?.close().catch(() => {});
            }
            onProgress({ type: "dynamic-page-done", pageInfo, index: index + 1, total: pages.length });
          }
        } finally {
          await browserContext.close();
        }
      } finally {
        await browser.close();
      }
    }
    await server.close();
    onProgress({ type: "dynamic-done", total: browser ? pages.length : 0 });
  }

  if (liveChecks.length > 0) {
    if (!liveUrl) {
      for (const check of liveChecks) skipped.set(check.id, t("progress.liveNoUrl"));
    } else {
      onProgress({ type: "live-start", url: liveUrl, index: 0, total: liveChecks.length });
      try {
        const response = await fetch(liveUrl, { signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS) });
        const html = await response.text();
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

        const parsedUrl = new URL(liveUrl);
        const isHttps = new URL(response.url).protocol === "https:";
        for (const [index, check] of liveChecks.entries()) {
          onProgress({ type: "live-check", check: toSummary(check), index: index + 1, total: liveChecks.length });
          const ctx: LiveCheckContext = {
            url: liveUrl,
            parsedUrl,
            headers,
            setCookieHeaders,
            status: response.status,
            redirected: response.redirected,
            finalUrl: response.url,
            isHttps,
            html,
            config,
            finding: createFindingFactory(check, config.severity[check.id]),
            detail: createDetailFactory(check, (d) => details.push(d)),
            skip,
          };
          const result = await safeRun(check, ctx, config);
          findings.push(...result.findings);
          if (result.skipped) skipped.set(check.id, result.skipped);
        }
      } catch (error) {
        const message = t("errors.checkCrashed", { message: error instanceof Error ? error.message : String(error) });
        for (const check of liveChecks) {
          findings.push({ checkId: check.id, category: check.category, severity: resolveSeverity(check, config), message });
          skipped.set(check.id, message);
        }
      }
      onProgress({ type: "live-done", total: liveChecks.length });
    }
  }

  const exitCode = computeExitCode(findings, config);

  return {
    findings,
    details,
    checks: [...checkSummaries.values()],
    skipped: Object.fromEntries(skipped),
    adapterName: adapter.name,
    outputDir,
    pagesChecked,
    totalPages: pages.length,
    liveUrl,
    exitCode,
    configErrors,
  };
}

function toSummary(check: CheckDefinition): CheckSummary {
  return {
    id: check.id,
    name: check.name ?? humanizeCheckId(check.id),
    category: check.category,
    mode: check.mode,
    description: check.description,
  };
}

function resolveSeverity(check: CheckDefinition, config: ResolvedConfig): Severity {
  return config.severity[check.id] ?? check.severity ?? "warn";
}

interface SafeRunResult {
  findings: Finding[];
  skipped?: string;
}

async function safeRun(
  check: CheckDefinition,
  ctx: StaticCheckContext | DynamicCheckContext | LiveCheckContext,
  config: ResolvedConfig
): Promise<SafeRunResult> {
  try {
    const result = await (check.run as (c: StaticCheckContext & DynamicCheckContext & LiveCheckContext) => Promise<Finding[] | undefined>)(
      ctx as StaticCheckContext & DynamicCheckContext & LiveCheckContext
    );
    return { findings: result ?? [] };
  } catch (error) {
    if (error instanceof CheckSkipped) {
      return { findings: [], skipped: error.message };
    }
    const message = t("errors.checkCrashed", { message: error instanceof Error ? error.message : String(error) });
    return {
      findings: [{ checkId: check.id, category: check.category, severity: resolveSeverity(check, config), message }],
      skipped: message,
    };
  }
}
