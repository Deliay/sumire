# tests/e2e

枝堇Sumire 后台与书店 E2E 集成测试（Playwright）。测试目标仅一个前端应用——bookstore（公开页 + `/backdoor` 后台）。接口层行为在 `tests/api` 覆盖，e2e 不重复。

开发前加载 `docs/engineering/proposals/2026-08-12-backdoor-auth-proposal.md`（§8.3）、PRD `docs/product/requirements/draft/2026-08-12-backdoor-auth-prd.md` 与设计 `docs/design/03-backdoor-design.md`。

## 运行方式

```bash
cd infra/aspire && aspire start                    # 拉起 bookstore + api + redis + mongodb
aspire describe bookstore --output json            # 取 bookstore http endpoint
cd tests/e2e && BOOKSTORE_BASE_URL=http://localhost:<bookstore-port> \
  API_BASE_URL=http://localhost:<api-port> \
  pnpm test
```

`BOOKSTORE_BASE_URL` 必填；`API_BASE_URL` 供 globalSetup 准备账号与 spec 内建号使用。

### 未配置形态（独立命令）

未配置 `NEXT_PUBLIC_API_BASE_URL` 的静态构建下，`/backdoor` 应呈现 404。该形态不依赖 Aspire/API，独立运行：

```bash
pnpm -C apps/bookstore build        # 不设置 NEXT_PUBLIC_API_BASE_URL（未配置形态）
cd tests/e2e && pnpm test:unconfigured
```

`playwright.unconfigured.config.ts` 无 `globalSetup`，`scripts/serve-static.mjs` 静态伺服 `apps/bookstore/out`（clean-url + 404 回退），`BOOKSTORE_STATIC_BASE_URL` 由配置注入；未设置时对应 spec 自动 `skip`。

## 结构

- `global-setup.ts`：通过 API 准备超管/管理员/成员三角色已完成改密账号，写入 `.accounts.json`
- `src/tools/api.ts`：API 调用助手
- `src/tools/accounts.ts`：从 `.accounts.json` 读取预置账号
- `src/backdoor/`：后台相关用例（auth / change-password / users / dashboard / schedule 含周表图片生成弹层 / danmaku 弹幕看板 / topics 棉花糖后台建主题→公开投递→详情采用→幻灯片核心链路）
- `src/bookstore/`：书店页脚入口与日历（含历史直播混合展示、降级）用例

## 约定

- `playwright.config.ts` 不使用 `webServer`（服务由 Aspire 管理）；
- 预置账号带运行标识后缀，避免与 `tests/api` 基态相互污染；
- 改密类用例自建独立账号，不改动其它用例共享的预置账号密码；
- 历史直播混合展示/降级用例用 Playwright `page.route` 拦截 `**/api/live-history` 返回 mock 体（历史记录 `startDate` 取当日本地 00:00，保证归入当日且已过），不在 e2e 依赖内网上游可用。
