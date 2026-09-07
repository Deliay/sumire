const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`缺少必需环境变量: ${key}`);
  }
  return value;
};

const envOr = (key: string): string | undefined => {
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
};

export const config = {
  port: Number(getEnv("PORT", "3001")),
  // Aspire 通过类型化属性 REDIS_URI / ConnectionStrings__redis 注入 Redis，MongoDB 走 ConnectionStrings__mongodb
  redisUrl: envOr("REDIS_URL") ?? envOr("REDIS_URI") ?? envOr("ConnectionStrings__redis") ?? "redis://localhost:6379",
  mongodbUrl: envOr("MONGODB_URL") ?? envOr("SUMIRE_URI") ?? envOr("ConnectionStrings__sumire") ?? envOr("ConnectionStrings__mongodb") ?? "mongodb://localhost:27017/sumire",
  cookieSecure: getEnv("COOKIE_SECURE", "false") === "true",
  corsOrigins: (getEnv("CORS_ORIGINS", "") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  backdoorUsername: getEnv("BACKDOOR_USERNAME", "supersumire"),
  backdoorPasswordHash: getEnv("BACKDOOR_PASSWORD_HASH", ""),
  // 历史直播上游地址：未配置时必须回退到 PRD 给定内网地址（内置缺省值，非必填、不得抛错）
  liveHistoryUpstreamUrl: getEnv(
    "LIVE_HISTORY_UPSTREAM_URL",
    "http://vtuber.internal.fffdan.com/api/b/live/1727076670/history",
  ),
  // 直播事件上游 base URL：端点路径由 liveEvents/upstream.ts 拼接（内置缺省值，不得抛错）
  liveEventsUpstreamUrl: getEnv(
    "LIVE_EVENTS_UPSTREAM_URL",
    "http://vtuber.internal.fffdan.com",
  ),
  // 直播状态上游地址：未配置时必须回退到 PRD 给定内网地址（内置缺省值，非必填、不得抛错）
  liveStatusUpstreamUrl: getEnv(
    "LIVE_STATUS_UPSTREAM_URL",
    "http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current",
  ),
  // 同期直播状态上游 base URL：端点路径由 livePeerStatus.ts 拼接（内置缺省值，不得抛错）
  livePeerStatusUpstreamUrl: getEnv(
    "LIVE_PEER_STATUS_UPSTREAM_URL",
    "http://vtuber.internal.fffdan.com",
  ),
  // B 站视频封面上游地址（内置缺省值，不得抛错）
  biliCoverUpstreamUrl: getEnv(
    "BILI_COVER_UPSTREAM_URL",
    "http://ayelet-tools.internal.fffdan.com/api/v1/bilibili/cover",
  ),
  // AI 审核配置（fail-fast 校验在 index.ts 启动时执行）
  reviewAiType: envOr("SUMIRE_REVIEW_AI_TYPE"), // "openai" | "claude"
  reviewAiEndpoint: envOr("SUMIRE_REVIEW_AI_ENDPOINT"),
  reviewAiApiKey: envOr("SUMIRE_REVIEW_AI_API_KEY"),
  // 可选：指定 AI 审核模型；不设置时用各分支默认（openai→gpt-4o-mini、claude→claude-3-haiku-20240307）
  reviewAiModel: envOr("SUMIRE_REVIEW_AI_MODEL"),
};

export const COOKIE_NAME = "sumire_sid";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天
export const LOGIN_RATE_LIMIT = 5; // 5 次/分钟/IP
