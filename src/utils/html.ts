import { readFileSync } from "node:fs";
import { type HTMLElement, parse } from "node-html-parser";

const cache = new Map<string, HTMLElement>();

export function parseHtmlFile(filePath: string): HTMLElement {
  let root = cache.get(filePath);
  if (!root) {
    root = parse(readFileSync(filePath, "utf-8"));
    cache.set(filePath, root);
  }
  return root;
}
