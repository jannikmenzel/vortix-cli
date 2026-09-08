import { glob } from "tinyglobby";

export async function globFiles(pattern: string, options: { cwd: string }): Promise<string[]> {
  return glob(pattern, { cwd: options.cwd, absolute: true });
}
