# tests/api

枝堇Sumire 后台鉴权与用户管理 API 集成测试（黑盒）。技术栈：TypeScript + Vitest + Node 内置 `fetch`，手工 Cookie jar。

开发与运行前加载 API 契约 `contract/backdoor-auth.openapi.yaml`、技术方案 `docs/engineering/proposals/2026-08-12-backdoor-auth-proposal.md`（§8.2）。用例只依据契约与 PRD 编写，禁止对照 `servers/` 实现编写。

## 运行方式

```bash
cd infra/aspire && aspire start                    # 拉起 bookstore + api + redis + mongodb
aspire describe api --output json                  # 取 api http endpoint
cd tests/api && API_BASE_URL=http://localhost:<api-port> \
  BOOKSTORE_ORIGIN=http://localhost:<bookstore-port> \
  pnpm vitest run
```

`API_BASE_URL` 必需；`BOOKSTORE_ORIGIN` 仅 CORS 用例需要。

## 目录

- `src/client.ts`：fetch 封装、`CookieJar`（解析/回带 sumire_sid）、登录/建号助手、就绪轮询
- `src/login.test.ts`、`logout.test.ts`、`session.test.ts`、`change-password.test.ts`、`users.test.ts`、`surface.test.ts`

## 约定

- 测试基态：超管 `supersumire` / 初始密码 `salamander`；**不改其种子密码**（保留基态）；
- 创建/改密类用例用带随机后缀的用户名（`t_<uuid8>` 等），避免用例间冲突；
- 限速用例最后执行（`fileParallelism: false` 全局串行 + `sequential`）。
