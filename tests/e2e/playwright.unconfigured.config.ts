import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.STATIC_PORT ?? 4200);

// 注入 spec 所需的静态伺服基址（与 webServer 端口保持一致；worker 子进程继承该环境变量）
process.env.BOOKSTORE_STATIC_BASE_URL ??= `http://localhost:${PORT}`;

/**
 * 未配置形态 e2e：不依赖 Aspire/API，仅对静态导出产物 `apps/bookstore/out`
 * （未设置 NEXT_PUBLIC_API_BASE_URL 的构建）做 404 断言。
 * 运行前需先 `pnpm -C apps/bookstore build`（未配置形态），再 `pnpm test:unconfigured`。
 */
export default defineConfig({
  testDir: "./src/backdoor",
  testMatch: "unconfigured.spec.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `node scripts/serve-static.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
