import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { getAccounts } from "../tools/accounts";

const baseURL = process.env.BOOKSTORE_BASE_URL!;

/**
 * 弹幕投票 e2e 测试。
 * SSE 以 addInitScript 注入 FakeEventSource 替身，不依赖真实流；
 * 计票正确性由 hook 单测保证，e2e 覆盖主流程与持久化。
 */
async function stubSSE(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface FakeES {
      readyState: number;
      onopen: (() => void) | null;
      onmessage: ((msg: { data: string }) => void) | null;
      onerror: (() => void) | null;
      addEventListener: (type: string, listener: (event: { data: string }) => void) => void;
      removeEventListener: (type: string, listener: (event: { data: string }) => void) => void;
      close: () => void;
    }
    const instances = new Set<FakeES>();
    class FakeEventSource implements FakeES {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readyState = 0;
      onopen: (() => void) | null = null;
      onmessage: ((msg: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      private listeners = new Map<string, Set<(event: { data: string }) => void>>();
      constructor(
        public readonly url: string,
        _opts?: unknown,
      ) {
        instances.add(this);
        setTimeout(() => {
          if (this.readyState === 0) {
            this.readyState = 1;
            this.onopen?.();
          }
        }, 0);
      }
      addEventListener(type: string, listener: (event: { data: string }) => void) {
        if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);
      }
      removeEventListener(type: string, listener: (event: { data: string }) => void) {
        this.listeners.get(type)?.delete(listener);
      }
      close() {
        this.readyState = 2;
        instances.delete(this);
      }
    }
    const w = window as unknown as {
      EventSource: unknown;
      __pushLiveEvent: (event: unknown) => void;
    };
    w.__pushLiveEvent = (event: unknown) => {
      for (const es of instances) {
        if (es.readyState === 1) es.onmessage?.({ data: JSON.stringify(event) });
      }
    };
    w.EventSource = FakeEventSource;
  });
}

test.describe("弹幕投票", () => {
  test("导航入口 → 卡片跳转 → 添加选项 → 投票 → 统计 → 刷新保留 → 清空", async ({ page }) => {
    const account = getAccounts().member;
    await stubSSE(page);
    await loginViaUi(page, account, baseURL);

    // 1. 导航出现「弹幕工具」
    const nav = page.getByRole("navigation", { name: "后台导航" });
    await expect(nav.getByText("弹幕工具")).toBeVisible();

    // 2. 点击导航进入工具列表页
    await nav.getByText("弹幕工具").click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku-tools$/);
    await expect(page.getByRole("heading", { name: "弹幕工具" })).toBeVisible();

    // 3. 卡片跳转 vote 页
    await expect(page.getByText("弹幕投票")).toBeVisible();
    await page.getByText("弹幕投票").click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku-tools\/vote$/);
    await expect(page.getByRole("heading", { name: "弹幕投票" })).toBeVisible();

    // 4. 添加两个选项
    await page.getByPlaceholder("名称").fill("唱歌");
    await page.getByPlaceholder("匹配关键字").fill("唱歌");
    await page.getByRole("button", { name: "添加选项" }).click();

    await page.getByPlaceholder("名称").fill("游戏");
    await page.getByPlaceholder("匹配关键字").fill("游戏");
    await page.getByRole("button", { name: "添加选项" }).click();

    // 断言选项已添加
    await expect(page.getByText("唱歌")).toBeVisible();
    await expect(page.getByText("游戏")).toBeVisible();

    // 5. 冲突拒绝：尝试添加与已有选项关键字冲突的选项
    await page.getByPlaceholder("名称").fill("唱歌跳舞");
    await page.getByPlaceholder("匹配关键字").fill("唱歌");
    await page.getByRole("button", { name: "添加选项" }).click();
    await expect(page.getByRole("alert")).toContainText("关键字与已有选项冲突");

    // 6. 开始投票
    await page.getByRole("button", { name: "开始投票" }).click();
    await expect(page.getByRole("button", { name: "停止投票" })).toBeVisible();

    // 7. 推送伪造弹幕（单命中）
    await page.evaluate(() => {
      (window as any).__pushLiveEvent({
        eventId: "e2e:1",
        type: "danmaku",
        occurredAt: new Date().toISOString(),
        sender: { uid: 2001, name: "用户1", nameRomaji: null, face: null, medal: null, guardLevel: null },
        content: "大家来唱歌吧",
        read: false,
      });
    });

    // 断言统计更新
    await expect(page.getByText("已处理 1 条弹幕，其中 1 条匹配")).toBeVisible();

    // 推送重复 uid 弹幕（仅 processed 增加）
    await page.evaluate(() => {
      (window as any).__pushLiveEvent({
        eventId: "e2e:2",
        type: "danmaku",
        occurredAt: new Date().toISOString(),
        sender: { uid: 2001, name: "用户1", nameRomaji: null, face: null, medal: null, guardLevel: null },
        content: "再唱一次",
        read: false,
      });
    });
    await expect(page.getByText("已处理 2 条弹幕，其中 1 条匹配")).toBeVisible();

    // 推送无 content 表情弹幕
    await page.evaluate(() => {
      (window as any).__pushLiveEvent({
        eventId: "e2e:3",
        type: "danmaku",
        occurredAt: new Date().toISOString(),
        sender: { uid: 2002, name: "用户2", nameRomaji: null, face: null, medal: null, guardLevel: null },
        read: false,
      });
    });
    await expect(page.getByText("已处理 3 条弹幕，其中 1 条匹配")).toBeVisible();

    // 8. 停止投票
    await page.getByRole("button", { name: "停止投票" }).click();
    await expect(page.getByRole("button", { name: "开始投票" })).toBeVisible();

    // 9. 刷新页面断言数据保留
    await page.reload();
    await expect(page.getByText("已处理 3 条弹幕，其中 1 条匹配")).toBeVisible();
    await expect(page.getByText("唱歌")).toBeVisible();
    await expect(page.getByText("游戏")).toBeVisible();

    // 10. 清空投票：先取消断言无变化
    await page.getByRole("button", { name: "清空投票" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("将清空当前所有投票数据")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByText("已处理 3 条弹幕，其中 1 条匹配")).toBeVisible();

    // 11. 确认清空断言回到空态
    await page.getByRole("button", { name: "清空投票" }).click();
    await page.getByRole("button", { name: "确认清空" }).click();
    await expect(page.getByText("已处理 0 条弹幕，其中 0 条匹配")).toBeVisible();
    await expect(page.getByText("唱歌")).toHaveCount(0);
    await expect(page.getByText("游戏")).toHaveCount(0);
  });
});
