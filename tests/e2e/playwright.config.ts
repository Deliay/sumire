import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  globalSetup: "./global-setup.ts",
  // 服务由 Aspire 统一管理，不使用 webServer
  use: {
    baseURL: process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000",
  },
  timeout: 30_000,
});
