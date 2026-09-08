import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectAdapter, resolveAdapter } from "@adapters/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "vortix-adapter-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function write(relPath: string, content = ""): void {
  const full = path.join(tmpDir, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

describe("detectAdapter — new generators", () => {
  it("detects Next.js only when static export is configured", () => {
    write("next.config.js", "module.exports = { reactStrictMode: true };");
    expect(detectAdapter(tmpDir)?.name).toBeUndefined();

    write("next.config.js", 'module.exports = { output: "export" };');
    expect(detectAdapter(tmpDir)?.name).toBe("nextjs");
  });

  it("detects Nuxt via nuxt.config.ts", () => {
    write("nuxt.config.ts", "export default defineNuxtConfig({})");
    expect(detectAdapter(tmpDir)?.name).toBe("nuxt");
  });

  it("detects SvelteKit only with @sveltejs/adapter-static installed", () => {
    write("svelte.config.js", "export default {}");
    write("package.json", JSON.stringify({ devDependencies: {} }));
    expect(detectAdapter(tmpDir)?.name).toBeUndefined();

    write("package.json", JSON.stringify({ devDependencies: { "@sveltejs/adapter-static": "^3.0.0" } }));
    expect(detectAdapter(tmpDir)?.name).toBe("sveltekit");
  });

  it("detects Gatsby, Docusaurus, Gridsome, and MkDocs by their config files", () => {
    write("gatsby-config.js");
    expect(detectAdapter(tmpDir)?.name).toBe("gatsby");
  });
});

describe("detectAdapter — disambiguating shared filenames", () => {
  it("picks hexo over jekyll for _config.yml when hexo is a dependency", () => {
    write("_config.yml", "title: My blog");
    expect(detectAdapter(tmpDir)?.name).toBe("jekyll");

    write("package.json", JSON.stringify({ dependencies: { hexo: "^7.0.0" } }));
    expect(detectAdapter(tmpDir)?.name).toBe("hexo");
  });

  it("picks hexo over jekyll for _config.yml when a scaffolds/ folder exists", () => {
    write("_config.yml", "title: My blog");
    write("scaffolds/post.md", "---\n---");
    expect(detectAdapter(tmpDir)?.name).toBe("hexo");
  });

  it("does not misdetect an unrelated project with a generic config.yml as Hugo", () => {
    write("config.yml", "some: unrelated-tool-setting\nversion: 2");
    expect(detectAdapter(tmpDir)).toBeUndefined();
  });

  it("distinguishes Zola (base_url) from Hugo (baseURL) on the shared config.toml filename", () => {
    write("config.toml", 'base_url = "https://example.com"\ntitle = "Zola site"');
    expect(detectAdapter(tmpDir)?.name).toBe("zola");

    rmSync(path.join(tmpDir, "config.toml"));
    write("config.toml", 'baseURL = "https://example.com"\nlanguageCode = "en-us"');
    expect(detectAdapter(tmpDir)?.name).toBe("hugo");
  });

  it("still detects Hugo unambiguously via hugo.toml regardless of content", () => {
    write("hugo.toml", "");
    expect(detectAdapter(tmpDir)?.name).toBe("hugo");
  });
});

describe("resolveServeDir — layout fallbacks for multi-convention generators", () => {
  it("nuxt falls back from .output/public to dist (Nuxt 2 nuxt generate layout)", () => {
    write("nuxt.config.ts", "export default defineNuxtConfig({})");
    write("dist/index.html", "<html></html>");
    const adapter = resolveAdapter(tmpDir, {}, false);
    expect(adapter.name).toBe("nuxt");
    const declaredOutputDir = path.resolve(tmpDir, adapter.outputDir);
    const serveDir = adapter.resolveServeDir?.(declaredOutputDir) ?? declaredOutputDir;
    expect(serveDir).toBe(path.join(tmpDir, "dist"));
  });

  it("vuepress falls back from docs/.vuepress/dist to root .vuepress/dist", () => {
    write(".vuepress/config.js", "module.exports = {}");
    write(".vuepress/dist/index.html", "<html></html>");
    const adapter = resolveAdapter(tmpDir, {}, false);
    expect(adapter.name).toBe("vuepress");
    const declaredOutputDir = path.resolve(tmpDir, adapter.outputDir);
    const serveDir = adapter.resolveServeDir?.(declaredOutputDir) ?? declaredOutputDir;
    expect(serveDir).toBe(path.join(tmpDir, ".vuepress", "dist"));
  });
});

describe("resolveAdapter — generic fallback for unlisted generators", () => {
  it("falls back to an existing common output folder when no build is requested and no adapter matches", () => {
    write("dist/index.html", "<html></html>");
    const adapter = resolveAdapter(tmpDir, {}, false);
    expect(adapter.name).toBe("static");
    expect(adapter.outputDir).toBe("dist");
  });

  it("still throws a clear error when nothing can be detected and no output folder exists either", () => {
    expect(() => resolveAdapter(tmpDir, {}, false)).toThrow(/No static site generator detected/);
  });

  it("still throws when a build is requested but no generator or buildCommand is known", () => {
    expect(() => resolveAdapter(tmpDir, {}, true)).toThrow(/No static site generator detected|buildCommand/);
  });

  it("an explicit target.outputDir always wins over auto-detection", () => {
    write("astro.config.mjs", "");
    write("custom-out/index.html", "<html></html>");
    const adapter = resolveAdapter(tmpDir, { outputDir: "custom-out" }, false);
    expect(adapter.name).toBe("astro");
    expect(adapter.outputDir).toBe("custom-out");
  });
});
