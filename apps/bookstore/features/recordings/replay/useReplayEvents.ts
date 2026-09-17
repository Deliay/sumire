"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveEvent } from "@/features/danmaku/types";
import { fetchReplayEvents } from "./replayEvents";
import { WINDOW_MS, toIso, windowBounds, windowIndexForOffset } from "./replayWindows";

/** 单窗口最多翻页数（防御上游异常 total）。 */
export const MAX_WINDOW_PAGES = 20;
/** 单页条数（契约上限 100）。 */
export const WINDOW_PAGE_SIZE = 100;

export interface UseReplayEventsOptions {
  /** 直播间 ID（正整数）；null 时禁用取数。事件按该房间检索，切换房间须清空缓存。 */
  roomId: number | null;
  /** 分段实际起点毫秒（info.startedAt 推导，info 缺失回退 createdAt）；null 时禁用取数。 */
  startMs: number | null;
  /** 分段实际终点毫秒（info.endedAt 推导 / duration 兜底）；null 时以 start + 12h 为上界。 */
  endMs?: number | null;
}

export interface ReplayEventsController {
  /** 已加载窗口事件合并去重、按 occurredAt 升序。 */
  events: LiveEvent[];
  loading: boolean;
  error: boolean;
  focusedWindow: number;
  /** 切换当前关注窗口（seek/播放进入新窗时调用），代次 last-wins。 */
  focusWindow: (index: number) => void;
  /** 确保某窗口已加载（缓存命中跳过），不改动关注态。 */
  ensureWindow: (index: number) => Promise<void>;
  /** 播放进入窗口后半段时预取下一窗。 */
  prefetchNext: (offsetMs: number) => void;
  /** 清空当前关注窗缓存并重试。 */
  retry: () => void;
}

/** 时间窗口增量加载调度：Map 缓存 + 代次 last-wins + 卸载中止。 */
export function useReplayEvents({ roomId, startMs, endMs = null }: UseReplayEventsOptions): ReplayEventsController {
  const cacheRef = useRef<Map<number, LiveEvent[]>>(new Map());
  const inflightRef = useRef<Map<number, Promise<boolean>>>(new Map());
  const abortRef = useRef<Set<AbortController>>(new Set());
  const genRef = useRef(0);
  const mountedRef = useRef(true);
  const focusRef = useRef<(index: number) => void>(() => {});

  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [focusedWindow, setFocusedWindow] = useState(0);

  const loadWindow = useCallback(
    (index: number): Promise<boolean> => {
      if (startMs === null || roomId === null) return Promise.resolve(false);

      const { startMs: windowStart, endMs: windowEnd } = windowBounds(index, startMs, endMs);
      // 缓存键含 roomId + 窗口起点（同一 index 在 duration 精确化后起点不变；房间维度防串扰）
      const key = `${roomId}:${windowStart}`;
      if (cacheRef.current.has(key)) return Promise.resolve(true);
      const existing = inflightRef.current.get(key);
      if (existing) return existing;
      if (windowEnd <= windowStart) {
        cacheRef.current.set(key, []);
        return Promise.resolve(true);
      }

      const controller = new AbortController();
      abortRef.current.add(controller);

      const promise = (async (): Promise<boolean> => {
        const collected: LiveEvent[] = [];
        try {
          let page = 1;
          for (;;) {
            const res = await fetchReplayEvents({
              roomId,
              start: toIso(windowStart),
              end: toIso(windowEnd),
              page,
              pageSize: WINDOW_PAGE_SIZE,
              signal: controller.signal,
            });
            if (!res.ok) return false;
            collected.push(...res.items);
            if (collected.length >= res.total || res.items.length === 0 || page >= MAX_WINDOW_PAGES) break;
            page += 1;
          }
          cacheRef.current.set(key, collected);
          if (mountedRef.current) setVersion((v) => v + 1);
          return true;
        } catch {
          return controller.signal.aborted;
        } finally {
          inflightRef.current.delete(key);
          abortRef.current.delete(controller);
        }
      })();

      inflightRef.current.set(key, promise);
      return promise;
    },
    [roomId, startMs, endMs],
  );

  const focusWindow = useCallback(
    (index: number) => {
      if (startMs === null || roomId === null) return;
      genRef.current += 1;
      const generation = genRef.current;
      setFocusedWindow(index);
      setError(false);
      setLoading(true);
      void loadWindow(index).then((ok) => {
        if (generation !== genRef.current || !mountedRef.current) return;
        setLoading(false);
        if (!ok) setError(true);
      });
    },
    [roomId, startMs, loadWindow],
  );

  // focusRef 在 effect 中同步，供 effect 内间接调用（避免 render 期写 ref）
  useEffect(() => {
    focusRef.current = focusWindow;
  }, [focusWindow]);

  const ensureWindow = useCallback(
    async (index: number) => {
      await loadWindow(index);
    },
    [loadWindow],
  );

  const prefetchNext = useCallback(
    (offsetMs: number) => {
      if (startMs === null || roomId === null || !Number.isFinite(offsetMs) || offsetMs < 0) return;
      const index = windowIndexForOffset(offsetMs);
      if (offsetMs - index * WINDOW_MS >= WINDOW_MS / 2) void loadWindow(index + 1);
    },
    [roomId, startMs, loadWindow],
  );

  const retry = useCallback(() => {
    if (startMs === null || roomId === null) return;
    cacheRef.current.delete(`${roomId}:${windowBounds(focusedWindow, startMs, endMs).startMs}`);
    focusRef.current(focusedWindow);
  }, [roomId, startMs, endMs, focusedWindow]);

  // 房间或起点变化（切换文件/直播间）：清空缓存并从首窗加载
  useEffect(() => {
    cacheRef.current.clear();
    inflightRef.current.clear();
    genRef.current += 1;
    if (startMs !== null && roomId !== null) focusRef.current(0);
  }, [roomId, startMs]);

  // 卸载：中止在途请求
  useEffect(() => {
    mountedRef.current = true;
    const aborts = abortRef.current;
    return () => {
      mountedRef.current = false;
      for (const controller of aborts) controller.abort();
      aborts.clear();
    };
  }, []);

  const events = useMemo(() => {
    const all: LiveEvent[] = [];
    for (const list of cacheRef.current.values()) all.push(...list);
    const seen = new Set<string>();
    const deduped: LiveEvent[] = [];
    for (const event of all) {
      if (seen.has(event.eventId)) continue;
      seen.add(event.eventId);
      deduped.push(event);
    }
    deduped.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
    return deduped;
    // version 驱动缓存变更后的重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { events, loading, error, focusedWindow, focusWindow, ensureWindow, prefetchNext, retry };
}
