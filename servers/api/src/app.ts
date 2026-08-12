import express, { type Application, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import type { SessionStore } from "./session/store";
import type { RateLimiter } from "./auth/rateLimit";
import { sessionMiddleware } from "./auth/session";
import { createAuthRouter } from "./routes/auth";
import { createUsersRouter } from "./routes/users";
import { config } from "./config";

export interface AppDeps {
  sessionStore: SessionStore;
  rateLimiter: RateLimiter;
}

export function createApp(deps: AppDeps): Application {
  const app = express();

  // CORS：白名单精确来源 + 放行凭证（禁用 *）
  const origins = config.corsOrigins;
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
