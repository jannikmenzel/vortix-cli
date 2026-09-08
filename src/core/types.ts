import type { Page } from "playwright";

export type Category = "performance" | "security" | "accessibility" | "bugs" | "seo" | "maintainability" | "privacy";

export const CATEGORIES: Category[] = ["performance", "security", "accessibility", "bugs", "seo", "maintainability", "privacy"];

export type Severity = "error" | "warn" | "info";

export interface Finding {
  checkId: string;
  category: Category;
  severity: Severity;
  message: string;
  file?: string;
  url?: string;
}

export interface FindingInput {
  message: string;
  file?: string;
  url?: string;
  severity?: Severity;
}

export type CheckMode = "static" | "dynamic" | "live";

export interface DetailInput {
  label: string;
  value: string;
  url?: string;
}

export interface CheckDetail extends DetailInput {
  checkId: string;
  category: Category;
}

export interface PageInfo {
  file: string;
  relativeFile: string;
  urlPath: string;
}

export interface CapturedConsoleMessage {
  type: string;
  text: string;
}

export interface CapturedNetworkRequest {
  url: string;
  status: number;
  contentType: string | null;
  bodySize: number;
  isMainFrame: boolean;
  resourceType: string;
}

export interface LiveCheckContext {
  url: string;
  parsedUrl: URL;
  headers: Record<string, string>;
  setCookieHeaders: string[];
  status: number;
  redirected: boolean;
  finalUrl: string;
  isHttps: boolean;
  html: string;
  config: ResolvedConfig;
  finding(input: FindingInput): Finding;
  detail(input: DetailInput): void;
  skip(reason: string): never;
}

export interface VortixConfig {
  target?: {
    adapter?: string;
    outputDir?: string;
    buildCommand?: string;
  };
  build?: boolean;
  categories?: Partial<Record<Category, boolean>>;
  checks?: string[];
  disabledChecks?: string[];
  severity?: Record<string, Severity>;
  failOn?: Severity;
  performance?: {
    budgets?: {
      lcpMs?: number;
      cls?: number;
      maxPageWeightKb?: number;
      maxImageKb?: number;
    };
  };
  privacy?: {
    trackerDomains?: string[];
  };
}

export interface ResolvedConfig {
  cwd: string;
  build: boolean;
  failOn: Severity;
  target: NonNullable<VortixConfig["target"]>;
  categories: Record<Category, boolean>;
  checks: string[];
  disabledChecks: string[];
  severity: Record<string, Severity>;
  performance: {
    budgets: {
      lcpMs: number;
      cls: number;
      maxPageWeightKb: number;
      maxImageKb: number;
    };
  };
  privacy: { trackerDomains: string[] };
}

export interface BaseCheckContext {
  siteRoot: string;
  outputDir: string;
  config: ResolvedConfig;
  exec(command: string): Promise<string>;
  glob(pattern: string, options?: { cwd?: string }): Promise<string[]>;
  readFile(filePath: string): string;
  fileExists(filePath: string): boolean;
  finding(input: FindingInput): Finding;
  detail(input: DetailInput): void;
  skip(reason: string): never;
}

export interface StaticCheckContext extends BaseCheckContext {
  mode: "static";
  pages: PageInfo[];
}

export interface DynamicCheckContext extends BaseCheckContext {
  mode: "dynamic";
  page: Page;
  pageInfo: PageInfo;
  consoleMessages: CapturedConsoleMessage[];
  networkRequests: CapturedNetworkRequest[];
}

export type CheckDefinition =
  | {
      id: string;
      name?: string;
      category: Category;
      mode: "static";
      severity?: Severity;
      description?: string;
      run(ctx: StaticCheckContext): Promise<Finding[] | undefined> | Finding[] | undefined;
    }
  | {
      id: string;
      name?: string;
      category: Category;
      mode: "dynamic";
      severity?: Severity;
      description?: string;
      run(ctx: DynamicCheckContext): Promise<Finding[] | undefined> | Finding[] | undefined;
    }
  | {
      id: string;
      name?: string;
      category: Category;
      mode: "live";
      severity?: Severity;
      description?: string;
      run(ctx: LiveCheckContext): Promise<Finding[] | undefined> | Finding[] | undefined;
    };

export interface CheckSummary {
  id: string;
  name: string;
  category: Category;
  mode: CheckMode;
  description?: string;
}
