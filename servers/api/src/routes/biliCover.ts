import { Router, type Request, type Response } from "express";

const UPSTREAM_TIMEOUT_MS = 5000;

/** BV 号校验：BV 后跟 8 位以上字母数字。 */
const BV_RE = /^BV[A-Za-z0-9]{8,}$/;

export interface BiliCoverRouterDeps {
  upstreamUrl: string;
  fetchFn?: typeof fetch;
}

export function createBiliCoverRouter(deps: BiliCoverRouterDeps): Router {
  const router = Router();
  const fetchFn = deps.fetchFn ?? fetch;

  router.get("/:bvId", async (req: Request, res: Response) => {
    const bvId = String(req.params.bvId);
    if (!BV_RE.test(bvId)) {
      res.status(400).json({ error: "BV 号格式不合法" });
      return;
    }

    try {
      const upstream = await fetchFn(`${deps.upstreamUrl}/${encodeURIComponent(bvId)}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `上游响应 ${upstream.status}` });
        return;
      }
      const data = await upstream.json();
      res.status(200).json(data);
    } catch {
      res.status(502).json({ error: "上游封面服务不可用" });
    }
  });

  return router;
}
