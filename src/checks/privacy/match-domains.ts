import type { CapturedNetworkRequest } from "@core/types.js";

export function uniqueUrlsMatchingDomains(requests: CapturedNetworkRequest[], domains: string[]): string[] {
  const matches = requests.filter((r) => {
    try {
      const host = new URL(r.url).hostname;
      return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  });
  return [...new Set(matches.map((r) => r.url))];
}
