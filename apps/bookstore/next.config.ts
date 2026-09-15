import type { NextConfig } from "next";
import { RECORDINGS_PROXY_PREFIX } from "./features/recordings/proxy";

const DEFAULT_RECORDINGS_TARGET = "http://vtuber.internal.fffdan.com";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // 静态导出到 GitHub Pages（dev 下不设，避免与本地录播代理 rewrites 冲突）
  ...(isDev ? {} : { output: "export" as const }),
  // GitHub Pages 项目站点需要子路径前缀；本地构建不设置
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // 静态导出不支持服务端图片优化（展示图均为构建期预生成的 webp）
  images: { unoptimized: true },
};

// 本地 dev 才挂载 rewrites：将同源代理前缀转发到录播服务内网地址（规避浏览器跨域）。
if (isDev) {
  const target = (process.env.NEXT_PUBLIC_RECORDINGS_BASE_URL || DEFAULT_RECORDINGS_TARGET).replace(/\/+$/, "");
  nextConfig.rewrites = async () => [
    { source: `${RECORDINGS_PROXY_PREFIX}/:path*`, destination: `${target}/:path*` },
  ];
}

export default nextConfig;
