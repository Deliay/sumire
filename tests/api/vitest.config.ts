import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 限速用例等有全局副作用，串行执行避免端口/计数互相影响
    fileParallelism: false,
    testTimeout: 30000,
  },
});
