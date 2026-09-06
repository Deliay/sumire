import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import type { SessionStore } from "./session/store";
import type { RateLimiter } from "./auth/rateLimit";
import { sessionMiddleware } from "./auth/session";
import { createAuthRouter } from "./routes/auth";
import { createUsersRouter } from "./routes/users";
import { createStreamPlansRouter } from "./routes/streamPlans";
import { createLiveHistoryRouter } from "./routes/liveHistory";
import { createLiveEventsRouter } from "./routes/liveEvents";
import { createLiveStatusRouter } from "./routes/liveStatus";
import { createBiliCoverRouter } from "./routes/biliCover";
import { createLiveEventsUpstream, type LiveEventsUpstream } from "./liveEvents/upstream";
import { createMemoryLiveHistoryCache, type LiveHistoryCache } from "./infra/liveHistoryCache";
import { createMemoryLiveStatusCache, type LiveStatusCache } from "./infra/liveStatusCache";
import { createTopicsRouter, type TopicsRouterDeps } from "./routes/topics";
import { createMemoryMarshRateLimiter, type MarshRateLimiter } from "./topics/rateLimit";
import { MemoryReviewQueue, type ReviewQueue } from "./topics/reviewQueue";
import { config } from "./config";

export interface AppDeps {
  sessionStore: SessionStore;
  rateLimiter: RateLimiter;
  /** 历史直播缓存（缺省内存实现，生产由 index.ts 注入 Redis 实现）。 */
  liveHistoryCache?: LiveHistoryCache;
  /** 直播状态缓存（缺省内存实现，生产由 index.ts 注入 Redis 实现）。 */
  liveStatusCache?: LiveStatusCache;
  /** 直播事件上游客户端（可注入 stub 便于测试，缺省按 config.liveEventsUpstreamUrl 创建）。 */
  liveEventsUpstream?: LiveEventsUpstream;
  /** 文本罗马音标注（缺省 kuroshiro 全文转换；单测可注入恒 null 避免加载字典）。 */
  toRomajiFn?: (text: string) => Promise<string | null>;
  /** 棉花糖投递限速器 */
  marshRateLimiter?: MarshRateLimiter;
  /** AI 审核队列 */
  reviewQueue?: ReviewQueue;
}

export function createApp(deps: AppDeps): Application {
  const app = express();
  app.set("trust proxy", true);

  // CORS：白名单精确来源 + 放行凭证（禁用 *）
  const origins = config.corsOrigins;
  console.log(`[cors] 允许的 origin 白名单: ${origins.length === 0 ? "(未配置，放行全部)" : origins.join(", ")}`);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.length === 0 || origins.includes(origin)) {
          callback(null, origin ?? false);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(sessionMiddleware(deps.sessionStore));

  const api = express.Router();
  const authRouter = createAuthRouter(deps.sessionStore, deps.rateLimiter);

  api.use("/auth", authRouter);
  api.use("/users", createUsersRouter());
  api.use("/stream-plans", createStreamPlansRouter());
  api.use(
    "/live-history",
    createLiveHistoryRouter({
      upstreamUrl: config.liveHistoryUpstreamUrl,
      cache: deps.liveHistoryCache ?? createMemoryLiveHistoryCache(),
    }),
  );
  api.use(
    "/live/status",
    createLiveStatusRouter({
      upstreamUrl: config.liveStatusUpstreamUrl,
      cache: deps.liveStatusCache ?? createMemoryLiveStatusCache(),
    }),
  );
  api.use(
    "/live-events",
    createLiveEventsRouter({
      upstream: deps.liveEventsUpstream ?? createLiveEventsUpstream(config.liveEventsUpstreamUrl),
      toRomajiFn: deps.toRomajiFn,
    }),
  );
  api.use(
    "/bilibili/cover",
    createBiliCoverRouter({ upstreamUrl: config.biliCoverUpstreamUrl }),
  );

  // topics 域：管理端点需 admin+；公开端点在路由内部单独挂载中间件
  api.use(
    "/topics",
    createTopicsRouter({
      marshRateLimiter: deps.marshRateLimiter ?? createMemoryMarshRateLimiter(),
      reviewQueue: deps.reviewQueue ?? new MemoryReviewQueue(),
    }),
  );
  api.use(
    "/marshmallows",
    createTopicsRouter({
      marshRateLimiter: deps.marshRateLimiter ?? createMemoryMarshRateLimiter(),
      reviewQueue: deps.reviewQueue ?? new MemoryReviewQueue(),
    }),
  );

  app.use("/api", api);

  // 非 /api 路径一律 404（纯 API 服务，不托管页面）
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "未找到" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "服务器内部错误" });
  });

  return app;
}
