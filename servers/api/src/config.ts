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
};

export const COOKIE_NAME = "sumire_sid";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天
export const LOGIN_RATE_LIMIT = 5; // 5 次/分钟/IP
