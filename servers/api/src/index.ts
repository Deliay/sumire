import { Redis } from "ioredis";
import { createApp } from "./app";
import { RedisSessionStore } from "./session/store";
import { RedisRateLimiter } from "./auth/rateLimit";
import { RedisLiveHistoryCache } from "./infra/liveHistoryCache";
import { RedisLiveStatusCache } from "./infra/liveStatusCache";
import { RedisMarshRateLimiter } from "./topics/rateLimit";
import { RedisReviewQueue } from "./topics/reviewQueue";
import { startReviewWorker } from "./topics/reviewWorker";
import { connectMongo, seedSuperadmin } from "./db/users";
import { config } from "./config";

async function main(): Promise<void> {
  await connectMongo(config.mongodbUrl);
  console.log("MongoDB connected");

  const seeded = await seedSuperadmin(
    config.backdoorUsername,
    config.backdoorPasswordHash,
  );
  console.log(seeded ? `已种子超管 ${config.backdoorUsername}` : "超管已存在，跳过种子");

  const redis = new Redis(config.redisUrl);
  const sessionStore = new RedisSessionStore(redis);
  const rateLimiter = new RedisRateLimiter(redis);
  const liveHistoryCache = new RedisLiveHistoryCache(redis);
  const liveStatusCache = new RedisLiveStatusCache(redis);
  const marshRateLimiter = new RedisMarshRateLimiter(redis);
  const reviewQueue = new RedisReviewQueue(redis);

  // fail-fast 校验 AI 审核配置：任一缺失则启动失败
  const hasAiConfig = config.reviewAiType || config.reviewAiEndpoint || config.reviewAiApiKey;
  if (hasAiConfig) {
    if (!config.reviewAiType) {
      throw new Error("SUMIRE_REVIEW_AI_TYPE 未配置（SUMIRE_REVIEW_AI_* 任一缺失即启动失败）");
    }
    if (config.reviewAiType !== "openai" && config.reviewAiType !== "claude") {
      throw new Error(`SUMIRE_REVIEW_AI_TYPE 必须为 openai 或 claude，当前值: ${config.reviewAiType}`);
    }
    if (!config.reviewAiEndpoint) {
      throw new Error("SUMIRE_REVIEW_AI_ENDPOINT 未配置（SUMIRE_REVIEW_AI_* 任一缺失即启动失败）");
    }
    if (!config.reviewAiApiKey) {
      throw new Error("SUMIRE_REVIEW_AI_API_KEY 未配置（SUMIRE_REVIEW_AI_* 任一缺失即启动失败）");
    }
  }

  const app = createApp({
    sessionStore,
    rateLimiter,
    liveHistoryCache,
    liveStatusCache,
    marshRateLimiter,
    reviewQueue,
    aiReviewEnabled: !!(config.reviewAiType && config.reviewAiEndpoint && config.reviewAiApiKey),
  });

  // 启动 AI 审核 worker
  if (config.reviewAiType && config.reviewAiEndpoint && config.reviewAiApiKey) {
    await startReviewWorker(reviewQueue);
    console.log(`[reviewWorker] 已启动 (${config.reviewAiType})`);
  } else {
    console.log("[reviewWorker] 未配置 AI 审核，跳过启动");
  }

  app.listen(config.port, () => {
    console.log(`sumire api listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
