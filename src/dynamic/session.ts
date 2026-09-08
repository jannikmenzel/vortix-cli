import type { CapturedConsoleMessage, CapturedNetworkRequest } from "@core/types.js";
import type { ConsoleMessage, Page, Response } from "playwright";

export interface Capture {
  consoleMessages: CapturedConsoleMessage[];
  networkRequests: CapturedNetworkRequest[];
  detach(): void;
}

export function attachCapture(page: Page): Capture {
  const consoleMessages: CapturedConsoleMessage[] = [];
  const networkRequests: CapturedNetworkRequest[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  };

  const onPageError = (error: Error) => {
    consoleMessages.push({ type: "pageerror", text: error.message });
  };

  const onResponse = async (response: Response) => {
    try {
      const headers = await response.allHeaders();
      let bodySize = Number(headers["content-length"] ?? 0);
      if (!bodySize) {
        try {
          bodySize = (await response.body()).length;
        } catch {}
      }
      const request = response.request();
      networkRequests.push({
        url: response.url(),
        status: response.status(),
        contentType: headers["content-type"] ?? null,
        bodySize,
        isMainFrame: request.frame() === page.mainFrame(),
        resourceType: request.resourceType(),
      });
    } catch {}
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  return {
    consoleMessages,
    networkRequests,
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
    },
  };
}
