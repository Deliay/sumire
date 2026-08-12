const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`缺少必需环境变量: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(getEnv("PORT", "3001")),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  mongodbUrl: getEnv("MONGODB_URL", "mongodb://localhost:27017/sumire"),
  sessionSecret: getEnv("SESSION_SECRET", "dev-secret"),
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
