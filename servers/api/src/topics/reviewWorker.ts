import type { ReviewJob, ReviewQueue } from "./reviewQueue";
import type { MarshmallowDoc } from "../db/marshmallows";
import { MarshmallowModel, writeReviewResult } from "../db/marshmallows";
import { TopicModel } from "../db/topics";
import { REVIEW_SYSTEM_PROMPT } from "./reviewPrompt";
import { config } from "../config";

export interface AiClient {
  chat(content: string): Promise<{ filtered: boolean; filteredReason: string }>;
}

async function createOpenAiClient(): Promise<AiClient> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.reviewAiApiKey,
    baseURL: config.reviewAiEndpoint,
  });
  return {
    async chat(content: string) {
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: REVIEW_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      });
      const text = resp.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(text);
        return {
          filtered: Boolean(parsed.filtered),
          filteredReason: typeof parsed.filteredReason === "string" ? parsed.filteredReason : "",
        };
      } catch {
        return { filtered: true, filteredReason: "AI 返回格式异常，请管理员人工确认" };
      }
    },
  };
}

async function createClaudeClient(): Promise<AiClient> {
  // Dynamic import with error handling for optional dependency
  // @ts-ignore - optional dependency may not be installed
  const AnthropicModule = await import("@anthropic-ai/sdk").catch(() => null);
  if (!AnthropicModule?.default) {
    throw new Error("@anthropic-ai/sdk 未安装，请运行 pnpm add @anthropic-ai/sdk");
  }
  const Anthropic = AnthropicModule.default;
  const client = new Anthropic({
    apiKey: config.reviewAiApiKey,
    baseURL: config.reviewAiEndpoint,
  });
  return {
    async chat(content: string) {
      const resp = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });
      const text = resp.content?.[0]?.text ?? "{}";
      try {
        const parsed = JSON.parse(text);
        return {
          filtered: Boolean(parsed.filtered),
          filteredReason: typeof parsed.filteredReason === "string" ? parsed.filteredReason : "",
        };
      } catch {
        return { filtered: true, filteredReason: "AI 返回格式异常，请管理员人工确认" };
      }
    },
  };
}

async function createAiClient(): Promise<AiClient> {
  const type = config.reviewAiType;
  if (type === "claude") return createClaudeClient();
  return createOpenAiClient();
}

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 5000]; // 退避 1s / 5s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 启动审核 worker（BRPOP 消费循环）
 * @param queue 队列实例
 * @param aiClient AI 客户端（可注入 mock）
 */
export async function startReviewWorker(
  queue: ReviewQueue,
  aiClient?: AiClient,
): Promise<() => void> {
  const client = aiClient ?? await createAiClient();
  let stopped = false;

  async function processJob(job: ReviewJob): Promise<void> {
    const marsh = await MarshmallowModel.findById(job.marshmallowId).lean() as MarshmallowDoc | null;
    if (!marsh || marsh.aiReview?.status !== "pending") return; // 幂等跳过

    const topic = await TopicModel.findById(marsh.topicId).lean();
    if (!topic) return;

    let lastError: Error | null = null;
    let result: { filtered: boolean; filteredReason: string } | null = null;

    // 只重试 AI 调用
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await client.chat(marsh.content);
        break; // AI 调用成功，跳出重试循环
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }

    if (result) {
      // AI 调用成功，写入结果（DB 写入失败不重试 AI）
      try {
        if (result.filtered) {
          await writeReviewResult(marsh._id.toString(), "rejected", result.filteredReason);
        } else {
          await writeReviewResult(marsh._id.toString(), "approved");
        }
      } catch (dbErr) {
        console.error(`[reviewWorker] DB 回写失败 ${job.marshmallowId}:`, dbErr);
      }
    } else {
      // 最终失败兜底
      try {
        await writeReviewResult(
          marsh._id.toString(),
          "rejected",
          "审核服务暂时不可用，请管理员人工确认",
        );
      } catch {
        // ignore
      }
      console.error(`[reviewWorker] 最终失败 ${job.marshmallowId}:`, lastError?.message);
    }
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      try {
        const job = await queue.dequeue();
        if (job) {
          await processJob(job);
        }
      } catch (err) {
        console.error("[reviewWorker] 消费异常:", err);
        await sleep(1000);
      }
    }
  }

  loop().catch((err) => {
    console.error("[reviewWorker] 循环异常退出:", err);
  });

  return () => {
    stopped = true;
  };
}
