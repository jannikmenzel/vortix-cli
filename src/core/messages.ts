import en from "../messages/en.json" with { type: "json" };

type Params = Record<string, string | number>;

function resolve(key: string): string {
  const value = key.split(".").reduce<unknown>((node, segment) => (node as Record<string, unknown>)?.[segment], en);
  if (typeof value !== "string") throw new Error(`Unknown message key: "${key}"`);
  return value;
}

export function t(key: string, params?: Params): string {
  const template = resolve(key);
  if (!params) return template;
  return template.replace(/{(\w+)}/g, (match, name) => (name in params ? String(params[name]) : match));
}
