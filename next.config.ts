import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出到 GitHub Pages
  output: "export",
  // GitHub Pages 项目站点需要子路径前缀；本地构建不设置
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // 静态导出不支持服务端图片优化（展示图均为构建期预生成的 webp）
  images: { unoptimized: true },
};

export default nextConfig;
