import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

export function resolvePackageBin(pkgName: string, binRelativePath: string): string {
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
  return path.join(path.dirname(pkgJsonPath), binRelativePath);
}
