"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, forwardRef, useImperativeHandle } from "react";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
import type { ApiError } from "@/features/backdoor/api";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  listLiveEvents,
  markAllLiveEventsRead,
  markLiveEventRead,
  markLiveEventUnread,
  type LiveEventsPage,
  type ReadAllType,
} from "../api";
import { loadGiftMinPrice, saveGiftMinPrice } from "../giftMinPrice";
import { loadMergeEnabled, saveMergeEnabled } from "../mergeEnabled";
import {
  getColumnsServerSnapshot,
  getColumnsSnapshot,
  resolveColumns,
  saveColumns,
  subscribeColumns,
  type ViewportTier,
} from "../columns";
import { labelForType } from "../format";
import { mergeEventsByTime } from "../merge";
import { useLiveEventStream } from "../useLiveEventStream";
import {
  LiveEventTypeSchema,
  type ColumnConfig,
  type ColumnLayoutMode,
  type LiveEvent,
  type LiveEventType,
} from "../types";
import FeedColumn from "./FeedColumn";
import GiftFilterControl from "./GiftFilterControl";

/** 「全部已读」仅支持需要已读管理的类型（契约口径）。 */
const READ_ALL_TYPES: readonly ReadAllType[] = ["super_chat", "guard_buy"];

/** 实时流到达即打「New」标记的事件类型（仅 SC / 上船）。 */
const NEW_MARK_TYPES: readonly LiveEventType[] = ["super_chat", "guard_buy"];

/** 历史检索每页条数（后端 pageSize 上限 100）。 */
const PAGE_SIZE = 100;

/** 入场动画批量清除延迟（ms）：动画 100ms + 余量；高密度连续插入时新批次重置计时器。 */
const FRESH_ANIMATION_MS = 300;

function dedupeById(events: LiveEvent[]): LiveEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
}

/**
 * 弹幕看板分栏面板（提案 K5/K6/K7）：默认 3 栏（礼物 | 上船+SC 分节 | 弹幕），
 * 历史首屏逐栏检索 + SSE 实时 prepend（按 eventId 去重），已读双击切换乐观更新失败回滚，
 * 栏位类型组合与混排/分栏布局可配置并持久化 localStorage（useSyncExternalStore 快照，SSR 回退默认）。
 * 移动端优化（F10）：按视口自适应栏数——<640px 折叠为单栏全类型、640-1023px 可选 1/2 栏
 * 默认 1 栏、>=1024px 可选 2/3 栏默认 3 栏（「视图栏」选择器由页头 ColumnCountSelector 提供，
 * 经 localStorage 快照同步至此；折叠为纯视图层，不写回存储）。
 */
interface DanmakuDashboardProps {
  /** 全屏模式：分栏区占满整个屏幕（由弹幕看板页传入）。 */
  isFullscreen?: boolean;
}

/** DanmakuDashboard 暴露给父组件的 imperative handle。 */
export interface DanmakuDashboardHandle {
  /** 回放指定类型的历史事件（模拟 SSE 发布）。 */
  replayTest: (type: LiveEventType) => Promise<void>;
}

/** 单栏检索：进入 loading（移出已加载），失败记错误态，成功写入去重后条目。
 * 按「栏 + 类型」分别加载（一个分栏勾选的每种事件类型各自独立请求）。 */
function sectionKey(colId: string, type: LiveEventType): string {
  return `${colId}:${type}`;
}

const DanmakuDashboard = forwardRef<DanmakuDashboardHandle, DanmakuDashboardProps>(function DanmakuDashboard(
  { isFullscreen = false },
  ref,
) {
  const { session } = useSession();
  const canManage = session.status === "authenticated" && atLeast(session.me.role, "admin");

  const storedColumns = useSyncExternalStore(subscribeColumns, getColumnsSnapshot, getColumnsServerSnapshot);
  // 视口档位：narrow(<640) / medium(640-1023) / wide(>=1024)；SSR 快照恒 false → medium
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const tier: ViewportTier = isNarrow ? "narrow" : isWide ? "wide" : "medium";
  // 有效栏位：按视口夹取已存配置（越界用预设覆盖，界内保留自定义），不写回存储；
  // 缺省 mode 归一为 split（兼容旧存储无 mode 字段）
  const columns = useMemo(
    () =>
      resolveColumns(storedColumns, tier).map((col) => ({
        ...col,
        mode: col.mode ?? "split",
      })),
    [storedColumns, tier],
  );
  // 分节检索状态：key = `${colId}:${type}`，每种事件类型独立加载/分页/错误
  const [eventsBySection, setEventsBySection] = useState<Record<string, LiveEvent[]>>({});
  const [loadedSections, setLoadedSections] = useState<ReadonlySet<string>>(new Set());
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [configOpenId, setConfigOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [pagesBySection, setPagesBySection] = useState<Record<string, number>>({});
  const [totalsBySection, setTotalsBySection] = useState<Record<string, number>>({});
  const [loadingMoreBySection, setLoadingMoreBySection] = useState<Record<string, boolean>>({});
  // 实时流到达的 SC/上船事件 eventId → type 集合（读后清除，用于「New」标记）
  const [newIds, setNewIds] = useState<ReadonlyMap<string, LiveEventType>>(new Map());

  // SSE 实际插入分节的事件 id 集合（入场动画标记，单计时器 300ms 后批量清除）
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const freshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 清除逻辑走 ref，避免计时器闭包持有陈旧 state
  const clearFreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    clearFreshRef.current = () => {
      freshTimerRef.current = null;
      setFreshIds(new Set());
    };
  });
  useEffect(() => {
    return () => {
      if (freshTimerRef.current) clearTimeout(freshTimerRef.current);
    };
  }, []);

  // 事件列表镜像（供 handleStreamEvent 在 setState 前判定「实际插入/去重跳过」）
  const eventsBySectionRef = useRef(eventsBySection);
  useEffect(() => {
    eventsBySectionRef.current = eventsBySection;
  }, [eventsBySection]);

  // 礼物最低金额筛选
  const [minPrice, setMinPrice] = useState(() => loadGiftMinPrice());
  const minPriceRef = useRef(minPrice);
  useEffect(() => {
    minPriceRef.current = minPrice;
  }, [minPrice]);

  // 弹幕合并开关（默认关闭，localStorage 持久化；切换即时生效不重新检索）
  const [mergeEnabled, setMergeEnabled] = useState(() => loadMergeEnabled());
  const handleMergeEnabledChange = useCallback(() => {
    const next = !mergeEnabled;
    saveMergeEnabled(next);
    setMergeEnabled(next);
  }, [mergeEnabled]);

  // 检索代际：columns 变化时递增，旧代检索结果作废，避免竞态覆盖新栏位数据
  const generationRef = useRef(0);

  // 单节历史检索：进入 loading（移出已加载），失败记错误态，成功写入去重后条目。
  // 重试与首屏共用此函数（page=1 覆盖式）。
  const loadSection = useCallback(
    async (col: ColumnConfig, type: LiveEventType, generation: number) => {
      const key = sectionKey(col.id, type);
      setLoadedSections((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setSectionErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      let status = 0;
      let data: LiveEventsPage | ApiError | null = null;
      // 礼物请求捕获阈值，响应比对丢弃
      const capturedMinPrice = type === "gift" ? minPriceRef.current : undefined;
      try {
        const res = type === "gift"
          ? await listLiveEvents([type], 1, PAGE_SIZE, capturedMinPrice)
          : await listLiveEvents([type], 1, PAGE_SIZE);
        status = res.status;
        data = res.data;
      } catch {
        // 网络错误/请求异常：与上游非 200 同口径进入错误态，暴露重试入口
        status = 0;
        data = null;
      }
      if (generationRef.current !== generation) return;
      // 礼物响应：阈值变化则丢弃
      if (type === "gift" && capturedMinPrice !== minPriceRef.current) return;
      if (status === 200 && data && "items" in data) {
        setEventsBySection((prev) => ({ ...prev, [key]: dedupeById(data!.items) }));
        setTotalsBySection((prev) => ({ ...prev, [key]: data!.total }));
        setPagesBySection((prev) => ({ ...prev, [key]: 1 }));
      } else {
        setSectionErrors((prev) => ({ ...prev, [key]: "检索失败" }));
      }
      setLoadedSections((prev) => new Set(prev).add(key));
    },
    [],
  );

  // 滚动加载下一页历史：append 去重，更新页数与 total。
  const loadMoreSection = useCallback(
    async (col: ColumnConfig, type: LiveEventType) => {
      const key = sectionKey(col.id, type);
      if (loadingMoreBySection[key]) return;
      const currentPage = pagesBySection[key] ?? 1;
      const total = totalsBySection[key];
      const currentCount = eventsBySection[key]?.length ?? 0;
      // 已加载条数不低于服务端 total 视为没有更多
      if (total !== undefined && currentCount >= total) return;
      setLoadingMoreBySection((prev) => ({ ...prev, [key]: true }));
      let status = 0;
      let data: LiveEventsPage | ApiError | null = null;
      // 礼物请求捕获阈值
      const capturedMinPrice = type === "gift" ? minPriceRef.current : undefined;
      try {
        const res = type === "gift"
          ? await listLiveEvents([type], currentPage + 1, PAGE_SIZE, capturedMinPrice)
          : await listLiveEvents([type], currentPage + 1, PAGE_SIZE);
        status = res.status;
        data = res.data;
      } catch {
        status = 0;
        data = null;
      }
      // 礼物响应：阈值变化则丢弃
      if (type === "gift" && capturedMinPrice !== minPriceRef.current) {
        setLoadingMoreBySection((prev) => ({ ...prev, [key]: false }));
        return;
      }
      if (status === 200 && data && "items" in data) {
        setEventsBySection((prev) => ({
          ...prev,
          [key]: dedupeById([...(prev[key] ?? []), ...data!.items]),
        }));
        setTotalsBySection((prev) => ({ ...prev, [key]: data!.total }));
        setPagesBySection((prev) => ({ ...prev, [key]: currentPage + 1 }));
      }
      setLoadingMoreBySection((prev) => ({ ...prev, [key]: false }));
    },
    [loadingMoreBySection, pagesBySection, totalsBySection, eventsBySection],
  );

  // 历史首屏：栏位/类型变化时逐节检索
  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    for (const col of columns) {
      for (const type of col.types) {
        void loadSection(col, type, generation);
      }
    }
  }, [columns, loadSection]);

  // 实时流：类型为各栏并集，事件分发进所有包含该类型的栏（prepend + eventId 去重）
  const streamTypes = useMemo(
    () => [...new Set(columns.flatMap((col) => col.types))],
    [columns],
  );

  const handleStreamEvent = useCallback(
    (event: LiveEvent) => {
      // SSE 低价礼物丢弃（不标记入场动画）
      if (event.type === "gift" && (event.price ?? 0) < minPriceRef.current) return;
      // 实际插入判定：至少一个目标分节未含该 eventId；被分节去重跳过的不标记入场
      const inserted = columns.some((col) => {
        if (!col.types.includes(event.type)) return false;
        const list = eventsBySectionRef.current[sectionKey(col.id, event.type)] ?? [];
        return !list.some((e) => e.eventId === event.eventId);
      });
      if (inserted) {
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.add(event.eventId);
          return next;
        });
        // 单计时器批量清除整批；新批次到达重置计时器（替换进行中动画，不叠加）
        if (freshTimerRef.current) clearTimeout(freshTimerRef.current);
        freshTimerRef.current = setTimeout(() => clearFreshRef.current(), FRESH_ANIMATION_MS);
      }
      setEventsBySection((prev) => {
        const next = { ...prev };
        for (const col of columns) {
          if (!col.types.includes(event.type)) continue;
          const key = sectionKey(col.id, event.type);
          const list = next[key] ?? [];
          if (list.some((e) => e.eventId === event.eventId)) continue;
          next[key] = [event, ...list];
        }
        return next;
      });
      // 实时流到达的 SC/上船标记为 New（读后清除）
      if ((NEW_MARK_TYPES as readonly string[]).includes(event.type)) {
        setNewIds((prev) => {
          if (prev.has(event.eventId)) return prev;
          const next = new Map(prev);
          next.set(event.eventId, event.type);
          return next;
        });
      }
    },
    [columns],
  );

  const streamStatus = useLiveEventStream(streamTypes, handleStreamEvent);

  // 回放测试：从API拉取历史数据，模拟SSE发布
  const replayTest = useCallback(
    async (type: LiveEventType) => {
      const suffix = `-replay-${Date.now()}`;
      let data: LiveEventsPage | ApiError | null = null;
      try {
        const res = type === "gift"
          ? await listLiveEvents([type], 1, 100, 0)
          : await listLiveEvents([type], 1, 100);
        if (res.status === 200 && "items" in res.data) {
          data = res.data;
        }
      } catch {
        // 网络错误忽略
      }
      if (!data) return;
      // 模拟SSE发布：逐条延迟调用handleStreamEvent
      for (const event of data.items) {
        const replayEvent: LiveEvent = {
          ...event,
          eventId: `${event.eventId}${suffix}`,
        };
        handleStreamEvent(replayEvent);
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    [handleStreamEvent],
  );

  useImperativeHandle(ref, () => ({ replayTest }), [replayTest]);

  const updateEvent = useCallback((eventId: string, fn: (e: LiveEvent) => LiveEvent) => {
    setEventsBySection((prev) => {
      const next: Record<string, LiveEvent[]> = {};
      for (const [id, list] of Object.entries(prev)) {
        next[id] = list.map((e) => (e.eventId === eventId ? fn(e) : e));
      }
      return next;
    });
  }, []);

  // 双击切换已读（K6）：乐观更新，失败回滚并提示
  const toggleRead = useCallback(
    async (event: LiveEvent) => {
      const nextRead = !event.read;
      updateEvent(event.eventId, (e) => ({ ...e, read: nextRead }));
      // 标记已读时清除「New」
      if (nextRead) {
        setNewIds((prev) => {
          if (!prev.has(event.eventId)) return prev;
          const next = new Map(prev);
          next.delete(event.eventId);
          return next;
        });
      }
      const { status } = nextRead
        ? await markLiveEventRead(event.eventId)
        : await markLiveEventUnread(event.eventId);
      if (status !== 200) {
        updateEvent(event.eventId, (e) => ({ ...e, read: !nextRead }));
        setToast("操作失败，请重试");
      }
    },
    [updateEvent],
  );

  const handleReadAll = useCallback(async (type: ReadAllType) => {
    const { status } = await markAllLiveEventsRead(type);
    if (status === 200) {
      setEventsBySection((prev) => {
        const next: Record<string, LiveEvent[]> = {};
        for (const [id, list] of Object.entries(prev)) {
          next[id] = list.map((e) => (e.type === type ? { ...e, read: true } : e));
        }
        return next;
      });
      // 该类型全部已读 → 清除其 New 标记
      setNewIds((prev) => {
        const next = new Map(prev);
        for (const [id, t] of prev) {
          if (t === type) next.delete(id);
        }
        return next;
      });
    } else {
      setToast("操作失败，请重试");
    }
  }, []);

  // 栏位配置：勾选/取消事件类型，至少保留一种；写回 localStorage（订阅者自动收到新快照）。
  // 作用于当前有效栏（用户所见），跨视口夹取场景下写入为自定义栏数配置。
  const toggleColumnType = useCallback(
    (columnId: string, type: LiveEventType) => {
      const next = columns.map((col) => {
        if (col.id !== columnId) return col;
        const types = col.types.includes(type)
          ? col.types.filter((t) => t !== type)
          : [...col.types, type];
        if (types.length === 0) return col;
        return { ...col, types };
      });
      saveColumns(next);
    },
    [columns],
  );

  // 栏内布局：切换混排/分栏；写回 localStorage（订阅者自动收到新快照）。
  const toggleColumnMode = useCallback(
    (columnId: string, mode: ColumnLayoutMode) => {
      const next = columns.map((col) => (col.id === columnId ? { ...col, mode } : col));
      saveColumns(next);
    },
    [columns],
  );

  // 混排栏合并列表（按时间倒序）：仅 columns 或事件数据变化时重算，保证引用稳定
  const mixedEventsByColumn = useMemo(() => {
    const map: Record<string, LiveEvent[]> = {};
    for (const col of columns) {
      if (col.mode !== "mixed") continue;
      map[col.id] = mergeEventsByTime(
        ...col.types.map((type) => eventsBySection[sectionKey(col.id, type)] ?? []),
      );
    }
    return map;
  }, [columns, eventsBySection]);

  // 礼物最低金额筛选变更：保存 + 同步 ref + 仅重载礼物分节
  const handleMinPriceChange = useCallback(
    (newPrice: number) => {
      saveGiftMinPrice(newPrice);
      minPriceRef.current = newPrice;
      setMinPrice(newPrice);
      // 仅对礼物分节触发 loadSection（页码重置为 1）
      for (const col of columns) {
        if (!col.types.includes("gift")) continue;
        void loadSection(col, "gift", generationRef.current);
      }
    },
    [columns, loadSection],
  );

  return (
    <div className={isFullscreen ? "flex h-full flex-1 flex-col" : "flex flex-col gap-4"}>
      <div
        className={
          isFullscreen
            ? `flex min-h-0 flex-1 ${columns.length > 1 ? "flex-row" : "flex-col"}`
            : `flex h-[calc(100svh-16rem)] gap-4 ${columns.length > 1 ? "flex-row" : "flex-col"}`
        }
      >
        {columns.map((col) => {
          const title = col.types.map(labelForType).join(" + ");
          const keys = col.types.map((type) => sectionKey(col.id, type));
          const sections =
            col.mode === "mixed"
              ? [
                  {
                    type: col.types[0],
                    label: "",
                    events: mixedEventsByColumn[col.id] ?? [],
                    loading: keys.some((k) => !loadedSections.has(k)),
                    error: keys.map((k) => sectionErrors[k]).find((e) => e != null) ?? null,
                    onRetry: () =>
                      col.types.forEach((type) => {
                        if (sectionErrors[sectionKey(col.id, type)]) {
                          void loadSection(col, type, generationRef.current);
                        }
                      }),
                    onLoadMore: () => col.types.forEach((type) => void loadMoreSection(col, type)),
                    hasMore: keys.some(
                      (k) => (totalsBySection[k] ?? 0) > (eventsBySection[k]?.length ?? 0),
                    ),
                    loadingMore: keys.some((k) => loadingMoreBySection[k]),
                  },
                ]
              : col.types.map((type) => {
                  const key = sectionKey(col.id, type);
                  return {
                    type,
                    label: labelForType(type),
                    events: eventsBySection[key] ?? [],
                    loading: !loadedSections.has(key),
                    error: sectionErrors[key] ?? null,
                    onRetry: () => void loadSection(col, type, generationRef.current),
                    onLoadMore: () => void loadMoreSection(col, type),
                    hasMore: (totalsBySection[key] ?? 0) > (eventsBySection[key]?.length ?? 0),
                    loadingMore: loadingMoreBySection[key],
                  };
                });
          return (
            <FeedColumn
              key={col.id}
              title={title}
              sections={sections}
              canManage={canManage}
              onToggleRead={toggleRead}
              newIds={newIds}
              mergeEnabled={mergeEnabled}
              freshIds={freshIds}
              readAllTypes={col.types.filter((t): t is ReadAllType =>
                (READ_ALL_TYPES as readonly string[]).includes(t),
              )}
              onReadAll={handleReadAll}
              headerExtra={
                <div className="flex items-center gap-2">
                  {streamStatus === "connecting" && (
                    <p className="text-sm text-ink-dim" role="status">
                      实时事件连接中…
                    </p>
                  )}
                  {streamStatus === "closed" && (
                    <p className="text-sm text-flower" role="status">
                      实时连接已断开
                    </p>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mergeEnabled}
                    aria-label="弹幕合并"
                    onClick={handleMergeEnabledChange}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
                      mergeEnabled
                        ? "border-flower text-ink"
                        : "border-vine/50 text-ink-dim hover:border-flower hover:text-ink"
                    }`}
                  >
                    弹幕合并
                  </button>
                  {col.types.includes("gift") && (
                    <GiftFilterControl value={minPrice} onChange={handleMinPriceChange} />
                  )}
                  <button
                    type="button"
                    onClick={() => setConfigOpenId((id) => (id === col.id ? null : col.id))}
                    aria-expanded={configOpenId === col.id}
                    aria-label={`配置「${title}」栏`}
                    className="rounded-md border border-vine/50 px-2 py-1 text-xs text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
                  >
                    配置栏位
                  </button>
                </div>
              }
              configPanel={
                configOpenId === col.id ? (
                  <div className="flex flex-col gap-2 border-b border-vine/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {LiveEventTypeSchema.options.map((type) => (
                        <label key={type} className="flex items-center gap-1.5 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={col.types.includes(type)}
                            onChange={() => toggleColumnType(col.id, type)}
                            className="accent-primary"
                          />
                          {labelForType(type)}
                        </label>
                      ))}
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-3"
                      role="radiogroup"
                      aria-label="栏内布局"
                    >
                      <span className="text-xs text-ink-dim">布局</span>
                      {(["mixed", "split"] as const).map((mode) => (
                        <label key={mode} className="flex items-center gap-1.5 text-sm text-ink">
                          <input
                            type="radio"
                            name={`danmaku-layout-${col.id}`}
                            checked={col.mode === mode}
                            onChange={() => toggleColumnMode(col.id, mode)}
                            className="accent-primary"
                          />
                          {mode === "mixed" ? "混排" : "分栏"}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null
              }
            />
          );
        })}
      </div>
      {toast && (
        <div className="fixed right-6 bottom-6 z-[70] rounded-md border border-flower/60 bg-raised px-4 py-2 text-sm text-ink shadow-xl">
          {toast}
          <button type="button" className="ml-2 text-ink-dim hover:text-ink" onClick={() => setToast("")}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

export default DanmakuDashboard;
