import { defineCheck } from "@core/define-check.js";
import type { Finding } from "@core/types.js";
import { parseHtmlFile } from "@utils/html.js";
import { HTMLElement } from "node-html-parser";

const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

const INLINE_ELEMENTS = "span, em, strong, b, i, u, small, sub, sup";

const INTERACTIVE_ELEMENTS = new Set(["a", "button", "input", "select", "textarea", "label", "details", "audio", "video", "iframe"]);

export default defineCheck({
  id: "bugs.nested-block-elements",
  name: "Nested Block Elements",
  category: "bugs",
  mode: "static",
  severity: "info",
  description: "Detects invalid nesting: block elements inside genuinely inline elements, and interactive elements nested inside an <a>.",
  async run(ctx) {
    const findings: Finding[] = [];
    let elementsChecked = 0;

    for (const page of ctx.pages) {
      const root = parseHtmlFile(page.file);

      for (const el of root.querySelectorAll(INLINE_ELEMENTS)) {
        elementsChecked++;
        for (const child of el.childNodes) {
          if (child.nodeType === 1 && child instanceof HTMLElement) {
            const tagName = child.tagName.toLowerCase();
            if (BLOCK_ELEMENTS.has(tagName)) {
              findings.push(
                ctx.finding({
                  message: `Block element "<${child.tagName}>" nested inside inline "<${el.tagName}>"`,
                  file: page.relativeFile,
                  severity: "info",
                })
              );
            }
          }
        }
      }

      // Block elements are valid inside <a> under HTML5's transparent content model, so only
      // interactive descendants and nested anchors are checked here.
      for (const anchor of root.querySelectorAll("a")) {
        elementsChecked++;
        for (const descendant of anchor.querySelectorAll([...INTERACTIVE_ELEMENTS].filter((tag) => tag !== "a").join(", "))) {
          findings.push(
            ctx.finding({
              message: `Interactive element "<${descendant.tagName}>" nested inside "<a>" — invalid, and most browsers will break the outer link`,
              file: page.relativeFile,
              severity: "warn",
            })
          );
        }
        for (const _nestedAnchor of anchor.querySelectorAll("a")) {
          findings.push(
            ctx.finding({
              message: `Nested "<a>" inside another "<a>" — invalid, and most browsers will break the outer link`,
              file: page.relativeFile,
              severity: "warn",
            })
          );
        }
      }
    }

    ctx.detail({ label: "Elements checked", value: String(elementsChecked) });

    return findings;
  },
});
