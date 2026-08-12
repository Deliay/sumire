import { Redis } from "ioredis";
import { createApp } from "./app";
import { RedisSessionStore } from "./session/store";
import { RedisRateLimiter } from "./auth/rateLimit";
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

  const app = createApp({ sessionStore, rateLimiter });
  app.listen(config.port, () => {
    console.log(`sumire api listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
