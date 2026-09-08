export interface Adapter {
  name: string;
  detect(cwd: string): boolean;
  buildCommand: string;
  outputDir: string;
  /**
   * Resolves the directory that is actually scanned and served, for build tools that nest the
   * servable output in a subfolder of `outputDir` (e.g. Astro's SSR adapters split it into
   * `dist/client` and `dist/server`). Called after the build with the resolved absolute
   * `outputDir` and returns an absolute path. Defaults to `outputDir` when omitted.
   */
  resolveServeDir?(outputDir: string): string;
}
