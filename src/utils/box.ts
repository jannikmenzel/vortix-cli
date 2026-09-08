// biome-ignore lint/suspicious/noControlCharactersInRegex: matches the ESC control character that starts every ANSI color code, not accidental input.
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function visibleLength(str: string): number {
  return str.replace(ANSI_PATTERN, "").length;
}

/** Right-pads pre-formatted (possibly ANSI-colored) text with spaces to a minimum visible width, for aligning grid columns. */
export function padVisible(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - visibleLength(str)));
}

/** Word-wraps plain, uncolored text to a maximum visible width. Callers color the result. */
export function wrapPlainText(text: string, maxWidth: number): string[] {
  if (visibleLength(text) <= maxWidth) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && visibleLength(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Packs pre-formatted, indivisible chunks (e.g. a colored "✔ category" badge) onto as few
 * lines as fit within `maxWidth`, never splitting a chunk's own text across lines.
 */
export function packChunks(chunks: string[], maxWidth: number, separator = "   "): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let currentWidth = 0;

  for (const chunk of chunks) {
    const chunkWidth = visibleLength(chunk);
    const addedWidth = current.length === 0 ? chunkWidth : currentWidth + visibleLength(separator) + chunkWidth;
    if (current.length > 0 && addedWidth > maxWidth) {
      lines.push(current.join(separator));
      current = [chunk];
      currentWidth = chunkWidth;
    } else {
      current.push(chunk);
      currentWidth = addedWidth;
    }
  }
  if (current.length > 0) lines.push(current.join(separator));
  return lines;
}

export interface RenderBoxOptions {
  title?: string;
  padding?: number;
  minWidth?: number;
}

/** Draws a box-drawing border around pre-formatted, possibly ANSI-colored, lines. */
export function renderBox(lines: string[], options: RenderBoxOptions = {}): string {
  const padding = options.padding ?? 1;
  const contentWidth = Math.max(options.minWidth ?? 0, ...lines.map(visibleLength), options.title ? visibleLength(options.title) + 2 : 0);
  const innerWidth = contentWidth + padding * 2;

  const top = options.title
    ? `┌─ ${options.title} ${"─".repeat(Math.max(1, innerWidth - visibleLength(options.title) - 3))}┐`
    : `┌${"─".repeat(innerWidth)}┐`;
  const bottom = `└${"─".repeat(innerWidth)}┘`;

  const body = lines.map((line) => {
    const fill = " ".repeat(Math.max(0, contentWidth - visibleLength(line)));
    return `│${" ".repeat(padding)}${line}${fill}${" ".repeat(padding)}│`;
  });

  return [top, ...body, bottom].join("\n");
}

/** Renders a horizontal rule for sectioning long text, such as a check's detail view. */
export function divider(width = 44): string {
  return "─".repeat(width);
}
