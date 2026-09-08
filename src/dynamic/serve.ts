import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

export interface StaticServer {
  url: string;
  close(): Promise<void>;
}

export function startStaticServer(root: string): Promise<StaticServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      let urlPath: string;
      try {
        urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      } catch {
        res.statusCode = 400;
        res.end("Bad request");
        return;
      }
      const resolved = path.resolve(root, `.${urlPath}`);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
      let filePath = resolved;

      if (urlPath.endsWith("/") || !path.extname(filePath)) {
        const indexCandidate = path.join(filePath, "index.html");
        filePath = existsSync(indexCandidate) ? indexCandidate : `${filePath}.html`;
      }

      try {
        const data = await readFile(filePath);
        res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream");
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end("Not found");
      }
    });

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}
