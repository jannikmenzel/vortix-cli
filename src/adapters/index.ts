import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { t } from "@core/messages.js";
import type { ResolvedConfig } from "@core/types.js";
import type { Adapter } from "./types.js";

function hasAny(cwd: string, files: string[]): boolean {
  return files.some((f) => existsSync(path.join(cwd, f)));
}

function hasDir(cwd: string, dirs: string[]): boolean {
  return dirs.some((d) => {
    try {
      return statSync(path.join(cwd, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * Reads the first readable file among `files` (relative to `cwd`), truncated to `maxBytes`,
 * for cheap content sniffing. Returns an empty string when no candidate exists or none can be
 * read; callers must treat that as "no signal" rather than as an error.
 */
function readFirst(cwd: string, files: string[], maxBytes = 8192): string {
  for (const f of files) {
    const full = path.join(cwd, f);
    try {
      if (!statSync(full).isFile()) continue;
      const content = readFileSync(full, "utf-8");
      return content.slice(0, maxBytes);
    } catch {
      // Missing, unreadable, or a directory: try the next candidate.
    }
  }
  return "";
}

function hasPackageDependency(cwd: string, names: string[]): boolean {
  try {
    const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf-8"));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return names.some((n) => n in all);
  } catch {
    return false;
  }
}

/** Common output-folder names, most specific first, for the generic fallback adapter. */
const COMMON_OUTPUT_DIRS = ["dist", "build", "public", "_site", "output", "out", ".output/public", "site", "www"];

function findExistingOutputDir(cwd: string): string | undefined {
  return COMMON_OUTPUT_DIRS.find((dir) => {
    try {
      return statSync(path.join(cwd, dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

const astro: Adapter = {
  name: "astro",
  detect: (cwd) => hasAny(cwd, ["astro.config.mjs", "astro.config.ts", "astro.config.js", "astro.config.cjs"]),
  buildCommand: "npx astro build",
  outputDir: "dist",
  resolveServeDir: (outputDir) => {
    // SSR and hybrid adapters (e.g. @astrojs/node) split the build into `<outputDir>/client`
    // (the static assets) and `<outputDir>/server` (the SSR entry). Static output mode has no
    // such split.
    const clientDir = path.join(outputDir, "client");
    const serverDir = path.join(outputDir, "server");
    if (existsSync(clientDir) && existsSync(serverDir)) return clientDir;
    return outputDir;
  },
};

const eleventy: Adapter = {
  name: "eleventy",
  detect: (cwd) => hasAny(cwd, [".eleventy.js", ".eleventy.cjs", "eleventy.config.js", "eleventy.config.mjs", "eleventy.config.cjs"]),
  buildCommand: "npx @11ty/eleventy",
  outputDir: "_site",
};

const nextjs: Adapter = {
  name: "nextjs",
  // Static export only (`output: "export"` in next.config.*) produces servable HTML in `out/`;
  // a default Next.js build is server-rendered and out of scope for this tool.
  detect: (cwd) => {
    if (!hasAny(cwd, ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"])) return false;
    const content = readFirst(cwd, ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"]);
    return /output\s*:\s*["']export["']/.test(content);
  },
  buildCommand: "npx next build",
  outputDir: "out",
};

const nuxt: Adapter = {
  name: "nuxt",
  detect: (cwd) => hasAny(cwd, ["nuxt.config.js", "nuxt.config.ts", "nuxt.config.mjs"]),
  buildCommand: "npx nuxi generate",
  outputDir: ".output/public",
  resolveServeDir: (outputDir) => {
    // Nuxt 2's `nuxt generate` writes to `dist` instead of Nuxt 3's `.output/public`.
    if (!existsSync(outputDir) && existsSync(path.join(path.dirname(path.dirname(outputDir)), "dist"))) {
      return path.join(path.dirname(path.dirname(outputDir)), "dist");
    }
    return outputDir;
  },
};

const sveltekit: Adapter = {
  name: "sveltekit",
  // A static build requires @sveltejs/adapter-static. That cannot be verified from the config
  // alone, so a missing outputDir is reported as an explicit error later on.
  detect: (cwd) =>
    hasAny(cwd, ["svelte.config.js", "svelte.config.mjs", "svelte.config.ts"]) && hasPackageDependency(cwd, ["@sveltejs/adapter-static"]),
  buildCommand: "npx vite build",
  outputDir: "build",
};

const gatsby: Adapter = {
  name: "gatsby",
  detect: (cwd) => hasAny(cwd, ["gatsby-config.js", "gatsby-config.ts", "gatsby-config.mjs"]),
  buildCommand: "npx gatsby build",
  outputDir: "public",
};

const docusaurus: Adapter = {
  name: "docusaurus",
  detect: (cwd) => hasAny(cwd, ["docusaurus.config.js", "docusaurus.config.ts"]),
  buildCommand: "npx docusaurus build",
  outputDir: "build",
};

const vuepress: Adapter = {
  name: "vuepress",
  detect: (cwd) =>
    hasAny(cwd, ["docs/.vuepress/config.js", "docs/.vuepress/config.ts", "docs/.vuepress/config.mjs"]) ||
    hasAny(cwd, [".vuepress/config.js", ".vuepress/config.ts", ".vuepress/config.mjs"]),
  buildCommand: "npx vuepress build docs",
  outputDir: "docs/.vuepress/dist",
  resolveServeDir: (outputDir) => {
    // Root-level docs (`.vuepress/` at cwd instead of `docs/.vuepress/`) build into
    // `.vuepress/dist`. outputDir is always "<cwd>/docs/.vuepress/dist" here, so three levels
    // up resolves to cwd itself.
    if (!existsSync(outputDir)) {
      const root = path.join(path.dirname(path.dirname(path.dirname(outputDir))), ".vuepress", "dist");
      if (existsSync(root)) return root;
    }
    return outputDir;
  },
};

const gridsome: Adapter = {
  name: "gridsome",
  detect: (cwd) => hasAny(cwd, ["gridsome.config.js"]),
  buildCommand: "npx gridsome build",
  outputDir: "dist",
};

const mkdocs: Adapter = {
  name: "mkdocs",
  detect: (cwd) => hasAny(cwd, ["mkdocs.yml", "mkdocs.yaml"]),
  buildCommand: "mkdocs build",
  outputDir: "site",
};

const zola: Adapter = {
  name: "zola",
  // Zola's config.toml uses `base_url` (snake_case), Hugo's uses `baseURL` (camelCase). That
  // distinction is what separates the two on their shared generic filename.
  detect: (cwd) => /base_url\s*=/.test(readFirst(cwd, ["config.toml"])),
  buildCommand: "zola build",
  outputDir: "public",
};

const hugo: Adapter = {
  name: "hugo",
  detect: (cwd) => {
    if (hasAny(cwd, ["hugo.toml", "hugo.yaml", "hugo.yml"])) return true;
    // Generic `config.{toml,yaml,yml}` is a common filename across many non-Hugo tools, so
    // trust it only when the content actually looks like a Hugo config.
    const content = readFirst(cwd, ["config.toml", "config.yaml", "config.yml"]);
    return /\bbaseURL\s*[:=]/.test(content) || /\blanguageCode\s*[:=]/.test(content);
  },
  buildCommand: "hugo",
  outputDir: "public",
};

const hexo: Adapter = {
  name: "hexo",
  // Hexo defaults to `_config.yml` just like Jekyll. package.json, or the `scaffolds/`
  // convention, is the reliable disambiguator, so hexo must precede jekyll in
  // BUILT_IN_ADAPTERS.
  detect: (cwd) => hasAny(cwd, ["_config.yml"]) && (hasPackageDependency(cwd, ["hexo", "hexo-cli"]) || hasDir(cwd, ["scaffolds"])),
  buildCommand: "npx hexo generate",
  outputDir: "public",
};

const jekyll: Adapter = {
  name: "jekyll",
  detect: (cwd) => hasAny(cwd, ["_config.yml"]),
  buildCommand: "bundle exec jekyll build",
  outputDir: "_site",
};

const vite: Adapter = {
  name: "vite",
  detect: (cwd) => hasAny(cwd, ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"]),
  buildCommand: "npx vite build",
  outputDir: "dist",
};

// Order matters: detectAdapter returns the first match, so tools with an unambiguous,
// tool-named config file come first, and adapters sharing a generic filename with another
// tool (hexo/jekyll on _config.yml, zola/hugo on config.toml) put the stricter detector first.
export const BUILT_IN_ADAPTERS: Adapter[] = [
  astro,
  eleventy,
  nextjs,
  nuxt,
  sveltekit,
  gatsby,
  docusaurus,
  vuepress,
  gridsome,
  vite,
  mkdocs,
  zola,
  hugo,
  hexo,
  jekyll,
];

export function detectAdapter(cwd: string): Adapter | undefined {
  return BUILT_IN_ADAPTERS.find((a) => a.detect(cwd));
}

export function resolveAdapter(cwd: string, target: ResolvedConfig["target"], build: boolean): Adapter {
  let base: Adapter | undefined;

  if (target.adapter) {
    base = BUILT_IN_ADAPTERS.find((a) => a.name === target.adapter);
    if (!base) {
      throw new Error(t("errors.unknownAdapter", { name: target.adapter, available: BUILT_IN_ADAPTERS.map((a) => a.name).join(", ") }));
    }
  } else {
    base = detectAdapter(cwd);
  }

  // No known generator, no build requested and no explicit outputDir: fall back to whichever
  // common output folder already exists on disk instead of requiring manual configuration.
  // This is what lets unlisted site generators run without any config.
  let fallbackOutputDir: string | undefined;
  if (!base && !build && !target.outputDir) {
    fallbackOutputDir = findExistingOutputDir(cwd);
  }

  const resolvedOutputDir = target.outputDir ?? base?.outputDir ?? fallbackOutputDir;
  if (!resolvedOutputDir) {
    throw new Error(t("errors.noGeneratorOutputDir"));
  }
  if (!base && build && !target.buildCommand) {
    throw new Error(t("errors.noGeneratorBuildCommand"));
  }

  return {
    name: base?.name ?? (fallbackOutputDir ? "static" : "manual"),
    detect: () => true,
    buildCommand: target.buildCommand ?? base?.buildCommand ?? "",
    outputDir: resolvedOutputDir,
    // Apply the adapter's own output-layout heuristic only while its declared outputDir is in
    // play. An explicit target.outputDir override takes precedence over the heuristic.
    resolveServeDir: target.outputDir ? undefined : base?.resolveServeDir,
  };
}
