# syntax=docker/dockerfile:1
# 构建基于 pnpm workspace（repo 根上下文）。运行：docker build -t <tag> -f servers/api/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /repo
ENV PNPM_HOME=/usr/local/bin

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY servers/api/package.json servers/api/package.json
RUN pnpm install --filter @sumire/api --frozen-lockfile
COPY servers/api ./servers/api
RUN pnpm --filter @sumire/api build

FROM base AS runtime
COPY --from=build /repo/servers/api/package.json /repo/servers/api/package.json
RUN pnpm --filter @sumire/api deploy --legacy /app
COPY --from=build /repo/servers/api/src /app/src
EXPOSE 3001
WORKDIR /app
# 该服务仅支持通过 tsx 运行（tsconfig moduleResolution=bundler，tsc 产物带无扩展名 ESM import，Node 原生无法解析）
CMD ["node", "--import", "tsx", "src/index.ts"]
