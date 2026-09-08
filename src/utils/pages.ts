import path from "node:path";
import type { PageInfo } from "@core/types.js";
import { globFiles } from "./glob.js";

export async function collectPages(outputDir: string): Promise<PageInfo[]> {
  const files = await globFiles("**/*.html", { cwd: outputDir });
  return files
    .map((file) => {
      const relativeFile = path.relative(outputDir, file);
      return { file, relativeFile, urlPath: toUrlPath(relativeFile) };
    })
    .sort((a, b) => a.urlPath.localeCompare(b.urlPath));
}

function toUrlPath(relativeFile: string): string {
  const posix = relativeFile.split(path.sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return `/${posix.slice(0, -"index.html".length)}`;
  return `/${posix}`;
}
