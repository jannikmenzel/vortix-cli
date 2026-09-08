import { packChunks, renderBox, visibleLength, wrapPlainText } from "@utils/box.js";
import { describe, expect, it } from "vitest";

describe("visibleLength", () => {
  it("ignores ANSI color codes when measuring width", () => {
    const colored = "\x1b[31mred text\x1b[39m";
    expect(visibleLength(colored)).toBe("red text".length);
  });
});

describe("wrapPlainText", () => {
  it("returns the text unchanged when it already fits", () => {
    expect(wrapPlainText("short line", 40)).toEqual(["short line"]);
  });

  it("wraps a long sentence onto multiple lines without exceeding maxWidth", () => {
    const long = "live checks (security headers, HTTPS, cookies, ...) were skipped — pass a URL to include them";
    const lines = wrapPlainText(long, 30);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(30);
    // No words were lost or reordered.
    expect(lines.join(" ")).toBe(long);
  });
});

describe("packChunks", () => {
  it("packs multiple chunks onto one line when they fit", () => {
    expect(packChunks(["a", "b", "c"], 20)).toEqual(["a   b   c"]);
  });

  it("wraps onto a new line instead of exceeding maxWidth — regression: this used to stretch the whole scorecard box to the single longest line", () => {
    const chunks = ["✖ performance", "⊘ security", "✖ accessibility", "✖ bugs", "✖ seo", "⚠ maintainability", "⚠ privacy"];
    const lines = packChunks(chunks, 64);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(64);
    // Every chunk still appears intact; none was split across lines.
    for (const chunk of chunks) expect(lines.some((l) => l.includes(chunk))).toBe(true);
  });

  it("never splits a single chunk even if it alone exceeds maxWidth", () => {
    const longChunk = "a".repeat(80);
    expect(packChunks([longChunk], 20)).toEqual([longChunk]);
  });
});

describe("renderBox", () => {
  it("draws a border sized to the content, ignoring ANSI codes in width calculations", () => {
    const box = renderBox(["\x1b[32mgreen\x1b[39m", "plain"], { padding: 1 });
    const rows = box.split("\n");
    // Every row (top border, content rows, bottom border) has the same visible width.
    const widths = new Set(rows.map(visibleLength));
    expect(widths.size).toBe(1);
  });

  it("includes a title in the top border without breaking row alignment", () => {
    const box = renderBox(["one line"], { title: "MY TITLE" });
    const rows = box.split("\n");
    expect(rows[0]).toContain("MY TITLE");
    const widths = new Set(rows.map(visibleLength));
    expect(widths.size).toBe(1);
  });
});
