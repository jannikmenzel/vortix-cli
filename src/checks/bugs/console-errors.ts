import { defineCheck } from "@core/define-check.js";

export default defineCheck({
  id: "bugs.console-errors",
  name: "Console Errors",
  category: "bugs",
  mode: "dynamic",
  severity: "error",
  description: "Reports console errors that occur while the page loads.",
  async run(ctx) {
    ctx.detail({ label: "Console messages captured", value: String(ctx.consoleMessages.length), url: ctx.pageInfo.urlPath });

    return ctx.consoleMessages
      .filter((msg) => msg.type === "error" || msg.type === "pageerror")
      .map((msg) =>
        ctx.finding({
          message: msg.type === "pageerror" ? `Uncaught exception: ${msg.text}` : `Console error: ${msg.text}`,
          url: ctx.pageInfo.urlPath,
        })
      );
  },
});
