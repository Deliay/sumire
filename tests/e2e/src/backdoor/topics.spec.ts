import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

/** 本地时区 datetime-local 格式（YYYY-MM-DDTHH:mm）。 */
function dtLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe("backdoor 棉花糖（主题管理）", () => {
  test("marshmallow-core: 后台建主题→公开页投递→详情页采用→幻灯片展示", async ({ page }) => {
    test.setTimeout(90_000);
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.goto(`${BASE}/backdoor/topics`);
    await expect(page.getByRole("heading", { name: "棉花糖", exact: true })).toBeVisible();

    const run = Date.now().toString(36);
    const title = `e2e棉花糖_${run}`;
    const desc = `e2e描述 ${run}`;
    const content = `e2e内容 ${run}`;

    // 1. 新建主题（开始=现在、结束=明天，关闭 AI 前置审核以避开审核覆盖层）
    await page.getByRole("button", { name: "新建主题" }).click();
    const dlg = page.locator("div.fixed.inset-0.z-50");
    await expect(dlg).toBeVisible();
    await dlg.locator('label:has-text("标题") + input').fill(title);
    await dlg.locator("textarea").first().fill(desc);
    await dlg.locator('label:has-text("开始日期") + input').fill(dtLocal(new Date()));
    await dlg
      .locator('label:has-text("结束日期") + input')
      .fill(dtLocal(new Date(Date.now() + 86_400_000)));
    await dlg.locator('label:has-text("字数限制") + input').fill("1000");
    const aiCheckbox = dlg.locator('label:has-text("启用AI前置审核") input[type="checkbox"]');
    if (await aiCheckbox.isChecked()) await aiCheckbox.uncheck();
    await dlg.getByRole("button", { name: "创建" }).click();
    await expect(page.getByText(title)).toBeVisible();

    // 2. 进入详情页，取主题 ID
    await page.getByText(title).first().click();
    await expect(page).toHaveURL(/\/backdoor\/topics\/detail\?id=[0-9a-f]{24}$/, { timeout: 20_000 });
    const id = new URL(page.url()).searchParams.get("id")!;
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "幻灯片" })).toBeVisible();

    // 3. 公开收集页投递一条棉花糖
    await page.goto(`${BASE}/topics?id=${id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.locator("textarea").first().fill(content);
    await page.getByRole("button", { name: "投递棉花糖" }).click();
    await page.getByRole("button", { name: "确认投递" }).click();
    await expect(page.getByText("提交成功，感谢你的棉花糖")).toBeVisible();

    // 4. 回详情页采用该条
    await page.goto(`${BASE}/backdoor/topics/detail?id=${id}`);
    await expect(page.getByText(content)).toBeVisible();
    await page.getByRole("button", { name: "采用" }).click();
    await expect(page.getByText("已采用")).toBeVisible();

    // 5. 幻灯片页展示已采用条目（首次引导遮盖层点「知道了」）
    await page.goto(`${BASE}/backdoor/topics/presentation?id=${id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const guide = page.getByRole("button", { name: "知道了" });
    if (await guide.isVisible().catch(() => false)) await guide.click();
    await expect(page.getByText(content)).toBeVisible();

    // 6. 字号预设档位真实生效（回归：prose 自带 font-size:1rem 曾覆盖容器继承导致点击无效果）
    const prose = page.locator("div.prose", { hasText: content }).first();
    await expect(prose).toBeVisible();
    await expect(prose).toHaveCSS("font-size", "16px"); // 默认「中」
    await expect(prose).toHaveCSS("text-align", "left"); // 容器居中、条目内文本左对齐
    const itemBox = prose.locator(".."); // 条目限宽容器
    await expect(itemBox).toHaveClass(/max-w-\[50%\]/);
    await page.getByRole("button", { name: "大" }).click();
    await expect(prose).toHaveCSS("font-size", "20px");
    await expect(page.getByRole("button", { name: "大" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "小" }).click();
    await expect(prose).toHaveCSS("font-size", "14px");
    await expect(page.getByRole("button", { name: "小" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "中" }).click();
    await expect(prose).toHaveCSS("font-size", "16px");

    // 7. 页头标题衬线字体 + 页头/放映区明线分割
    await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCSS(
      "font-family",
      /Noto Serif SC|serif/,
    );
    await expect(page.locator("div.border-t.border-vine").first()).toBeVisible();
  });
});