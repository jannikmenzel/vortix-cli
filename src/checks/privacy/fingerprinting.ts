import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";

const FINGERPRINTING_APIS = [
  "canvas.toDataURL",
  "canvas.toBlob",
  "canvas.getContext('webgl')",
  "canvas.getContext('experimental-webgl')",
  "webgl.getParameter",
  "audioContext.createOscillator",
  "AudioContext",
  "OfflineAudioContext",
];

export default defineCheck({
  id: "privacy.fingerprinting",
  name: "Fingerprinting",
  category: "privacy",
  mode: "dynamic",
  severity: "warn",
  description: "Detects browser fingerprinting APIs (Canvas, WebGL, Audio).",
  async run(ctx) {
    const findings: Finding[] = [];

    const scripts = await ctx.page.$$eval("script:not([src])", (els) => els.map((el) => el.textContent ?? "").join("\n"));

    for (const api of FINGERPRINTING_APIS) {
      if (scripts.includes(api)) {
        findings.push(
          ctx.finding({
            message: `Potential fingerprinting API detected: "${api}"`,
            url: ctx.pageInfo.urlPath,
          })
        );
      }
    }

    ctx.detail({
      label: "Fingerprinting APIs checked / found",
      value: `${FINGERPRINTING_APIS.length} / ${findings.length}`,
      url: ctx.pageInfo.urlPath,
    });

    return findings;
  },
});
