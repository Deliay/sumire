import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shiftDateStr(s: string, days: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 当月最后一天。 */
function lastDayOfMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/** 目标日期：尽量留在当月视图内（今天非月末则 +1，否则 -1）。 */
function moveTarget(): string {
  const now = new Date();
  const d = now.getDate() < lastDayOfMonth() ? now.getDate() + 1 : now.getDate() - 1;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

test.describe("backdoor 直播计划", () => {
  test("schedule-crud-loop: 点击某天→当日弹层增加(日期预填)→编辑改期→删除二次确认闭环", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "直播计划" })).toBeVisible();
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    const run = Date.now().toString(36);
    const title = `e2e计划_${run}`;
    const today = todayStr();

    // 点击今天 → 当日详细安排弹层
    const todayCell = page.locator(`[data-testid="calendar-day"][data-date="${today}"]`);
    await todayCell.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // 弹层内「增加计划」→ 日期预填所选日
    await page.getByRole("button", { name: /增加计划/ }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "增加直播计划" })).toBeVisible();
    await expect(page.getByLabel("日期")).toHaveValue(/\d+ 年 \d+ 月 \d+ 日/);

    const timeInput = page.getByLabel("开始时间");
    await timeInput.click();
    await timeInput.fill("20:00");
    await timeInput.blur();
    await page.getByLabel("直播主题").fill(title);
    await page.getByRole("button", { name: "确认" }).click();

    // 保存后当日弹层（列出全部计划）即时可见新计划
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();

    // 编辑改期到另一天
    await page.getByRole("button", { name: `编辑 ${title}` }).click();
    const target = moveTarget();
    await expect(page.getByRole("dialog").filter({ hasText: "编辑直播计划" })).toBeVisible();
    await expect(page.getByLabel("直播主题")).toHaveValue(title);
    const dateField = page.getByLabel("日期");
    await dateField.click();
    await dateField.fill(target);
    await dateField.blur();
    await page.getByRole("button", { name: "确认" }).click();

    // 移出所选日：原日弹层移除该条、提示已移至、目标日弹层出现该条
    await expect(page.getByRole("dialog").getByText(title)).toHaveCount(0);
    await expect(page.getByText(/已移至 \d+ 月 \d+ 日/)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();

    const targetCell = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await targetCell.click();
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();

    // 删除（二次确认）→ 从目标日弹层移除
    await page.getByRole("button", { name: `删除 ${title}` }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByRole("dialog").getByText(title)).toHaveCount(0);
  });

  test("schedule-member-readonly: member 可见日历与当日弹层，但无增加/编辑/删除入口", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("link", { name: "直播计划" })).toBeVisible();
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();
    await expect(page.getByTestId("calendar-day").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "增加直播计划" })).toHaveCount(0);

    // 点击今天 → 只读弹层，无管理操作
    const today = todayStr();
    await page.locator(`[data-testid="calendar-day"][data-date="${today}"]`).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /增加计划/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  });

  test("schedule-empty-submit: 日期/开始时间/主题未填全时提交按钮禁用", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await page.getByRole("button", { name: "增加直播计划" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // 空表单：确认按钮禁用
    await expect(page.getByRole("button", { name: "确认" })).toBeDisabled();
  });

  test("schedule-weekly-image: 生成周表图片弹层（周切换器 + 预览 PNG + 保存提示）", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    await page.getByRole("button", { name: "生成周表图片" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "生成周表图片" })).toBeVisible();
    await expect(dialog.getByText(/20\d\d 年第 \d+ 周/)).toBeVisible();
    await expect(dialog.getByText("长按保存图片，或右键另存为")).toBeVisible();

    // 预览 <img> src 为 PNG dataURL
    const img = dialog.locator("img[alt='周表图片']");
    await expect(img).toHaveAttribute("src", /^data:image\/png/);

    // 切换周标签变化
    const before = await dialog.getByText(/20\d\d 年第 \d+ 周/).textContent();
    await dialog.getByRole("button", { name: "下一周" }).click();
    const after = await dialog.getByText(/20\d\d 年第 \d+ 周/).textContent();
    expect(after).not.toBe(before);
  });

  test("schedule-member-generate: member 可用「生成周表图片」，历史记录只读", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    await page.getByRole("button", { name: "生成周表图片" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "生成周表图片" })).toBeVisible();
    await expect(dialog.getByText("长按保存图片，或右键另存为")).toBeVisible();
    await dialog.getByRole("button", { name: "关闭" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("backdoor 直播计划移动端周视图", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("schedule-mobile-week-view: 小宽度渲染周视图且点天弹层可用", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    await expect(page.getByTestId("calendar-day")).toHaveCount(7);
    const today = todayStr();
    await page.locator(`[data-testid="calendar-day"][data-date="${today}"]`).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("schedule-mobile-week-switch: 周切换后格子平移 7 天", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();
    await expect(page.getByTestId("calendar-day")).toHaveCount(7);

    const before = await page
      .getByTestId("calendar-day")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-date")));
    await page.getByRole("button", { name: "下一周" }).click();
    const after = await page
      .getByTestId("calendar-day")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-date")));
    for (let i = 0; i < 7; i++) {
      expect(after[i]).toBe(shiftDateStr(before[i]!, 7));
    }
  });
});

test.describe("backdoor 直播计划 timeType（时间待定/全天）", () => {
  test("schedule-timeType-tbd: 选「时间待定」→ 时间控件隐藏 → 保存成功 → 日历格子与当日详情显示 TBD 标识", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    const run = Date.now().toString(36);
    const title = `e2e_tbd_${run}`;
    const today = todayStr();

    // 点击今天 → 增加计划
    const todayCell = page.locator(`[data-testid="calendar-day"][data-date="${today}"]`);
    await todayCell.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /增加计划/ }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "增加直播计划" })).toBeVisible();

    // 选择「时间待定」
    await page.getByLabel("时间待定").click();
    // 时间控件应隐藏
    await expect(page.getByLabel("开始时间")).toHaveCount(0);
    // 填写主题
    await page.getByLabel("直播主题").fill(title);
    // 提交
    await page.getByRole("button", { name: "确认" }).click();

    // 保存后当日弹层可见新计划，显示 TBD 标识
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();
    await expect(page.getByRole("dialog").getByText("TBD")).toBeVisible();

    // 关闭弹层，检查日历格子摘要
    await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();
    await expect(page.getByTestId("calendar-day").filter({ hasText: "TBD" })).toBeVisible();

    // 点击打开当日详情，确认 TBD 标识
    await todayCell.click();
    await expect(page.getByRole("dialog").getByText("TBD")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();

    // 清理：删除
    await page.getByRole("button", { name: `删除 ${title}` }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByRole("dialog").getByText(title)).toHaveCount(0);
  });

  test("schedule-timeType-allday: 选「全天」→ 时间控件隐藏 → 保存成功 → 日历格子与当日详情显示全天标识", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    const run = Date.now().toString(36);
    const title = `e2e_allday_${run}`;
    const today = todayStr();

    // 点击今天 → 增加计划
    const todayCell = page.locator(`[data-testid="calendar-day"][data-date="${today}"]`);
    await todayCell.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /增加计划/ }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "增加直播计划" })).toBeVisible();

    // 选择「全天」
    await page.getByLabel("全天").click();
    // 时间控件应隐藏
    await expect(page.getByLabel("开始时间")).toHaveCount(0);
    // 填写主题
    await page.getByLabel("直播主题").fill(title);
    // 提交
    await page.getByRole("button", { name: "确认" }).click();

    // 保存后当日弹层可见新计划，显示全天标识
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();
    await expect(page.getByRole("dialog").getByText("全天")).toBeVisible();

    // 关闭弹层，检查日历格子摘要
    await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();
    await expect(page.getByTestId("calendar-day").filter({ hasText: "全天" })).toBeVisible();

    // 点击打开当日详情，确认全天标识
    await todayCell.click();
    await expect(page.getByRole("dialog").getByText("全天")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();

    // 清理：删除
    await page.getByRole("button", { name: `删除 ${title}` }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByRole("dialog").getByText(title)).toHaveCount(0);
  });

  test("schedule-timeType-edit: 编辑态回显 timeType，切换类型后 startTime 归 null", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    const run = Date.now().toString(36);
    const title = `e2e_edit_${run}`;
    const today = todayStr();

    // 创建一个固定时间计划
    const todayCell = page.locator(`[data-testid="calendar-day"][data-date="${today}"]`);
    await todayCell.click();
    await page.getByRole("button", { name: /增加计划/ }).click();
    await page.getByLabel("直播主题").fill(title);
    const timeInput = page.getByLabel("开始时间");
    await timeInput.click();
    await timeInput.fill("20:00");
    await timeInput.blur();
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("dialog").getByText(title)).toBeVisible();

    // 编辑该计划，切换为「时间待定」
    await page.getByRole("button", { name: `编辑 ${title}` }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "编辑直播计划" })).toBeVisible();
    // 固定时间单选应选中
    await expect(page.getByLabel("固定时间")).toBeChecked();
    // 切换为时间待定
    await page.getByLabel("时间待定").click();
    // 时间控件应隐藏
    await expect(page.getByLabel("开始时间")).toHaveCount(0);
    // 提交
    await page.getByRole("button", { name: "确认" }).click();

    // 验证：当日详情显示 TBD
    await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();
    await todayCell.click();
    await expect(page.getByRole("dialog").getByText("TBD")).toBeVisible();

    // 清理
    await page.getByRole("button", { name: `删除 ${title}` }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByRole("dialog").getByText(title)).toHaveCount(0);
  });
});
