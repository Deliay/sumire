import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 静态伺服 bookstore 的 `output: "export"` 产物 `apps/bookstore/out`，
 * 模拟 GitHub Pages 的 clean-url 行为：`/foo` → `foo.html`、`/foo/` → `foo/index.html`，
 * 未命中回退到 `404.html`。供「未配置形态」e2e（`playwright.unconfigured.config.ts`）使用。
 */
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/bookstore/out",
);
const PORT = Number(process.argv[2] ?? process.env.STATIC_PORT ?? 4200);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

function resolve(reqPath) {
  const clean = reqPath.endsWith("/") ? `${reqPath}index.html` : `${reqPath}.html`;
  const candidates = [clean, reqPath].map((p) => path.join(OUT_DIR, p));
  return candidates.find((c) => c.startsWith(OUT_DIR) && existsSync(c));
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(pathname === "/" ? "/index.html" : pathname) ?? path.join(OUT_DIR, "404.html");
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`[serve-static] serving ${OUT_DIR} at http://localhost:${PORT}`);
});
