"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
import {
  listLiveEvents,
  markAllLiveEventsRead,
  markLiveEventRead,
  markLiveEventUnread,
  type ReadAllType,
} from "../api";
import {
  getColumnsServerSnapshot,
  getColumnsSnapshot,
  saveColumns,
  subscribeColumns,
} from "../columns";
import { labelForType } from "../format";
import { useLiveEventStream } from "../useLiveEventStream";
import { LiveEventTypeSchema, type LiveEvent, type LiveEventType } from "../types";
import FeedColumn from "./FeedColumn";

/** 「全部已读」仅支持需要已读管理的类型（契约口径）。 */
const READ_ALL_TYPES: readonly ReadAllType[] = ["super_chat", "guard_buy"];

function dedupeById(events: LiveEvent[]): LiveEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
}

/**
 * 弹幕后台分栏面板（提案 K5/K6/K7）：默认 3 栏（弹幕 | SC | 礼物+上船），
 * 历史首屏逐栏检索 + SSE 实时 prepend（按 eventId 去重），已读双击切换乐观更新失败回滚，
 * 栏位类型组合可配置并持久化 localStorage（useSyncExternalStore 快照，SSR 回退默认）。
 * `<1024px` 纵向堆叠为纯 CSS（flex-col → lg:flex-row）。
 */
export default function DanmakuDashboard() {
  const { session } = useSession();
  const canManage = session.status === "authenticated" && atLeast(session.me.role, "admin");

  const columns = useSyncExternalStore(subscribeColumns, getColumnsSnapshot, getColumnsServerSnapshot);
  const [eventsByColumn, setEventsByColumn] = useState<Record<string, LiveEvent[]>>({});
  const [loadedColumns, setLoadedColumns] = useState<ReadonlySet<string>>(new Set());
  const [configOpenId, setConfigOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // 历史首屏：栏位变化时按栏检索（loading 由「未加载完成」派生，无需同步 setState）
  useEffect(() => {
    let active = true;
    void Promise.all(
      columns.map(async (col) => {
        const { status, data } = await listLiveEvents(col.types);
        if (!active) return;
        if (status === 200 && "items" in data) {
          setEventsByColumn((prev) => ({ ...prev, [col.id]: dedupeById(data.items) }));
        }
        setLoadedColumns((prev) => new Set(prev).add(col.id));
      }),
    );
    return () => {
      active = false;
    };
  }, [columns]);

  // 实时流：类型为各栏并集，事件分发进所有包含该类型的栏（prepend + eventId 去重）
  const streamTypes = useMemo(
    () => [...new Set(columns.flatMap((col) => col.types))],
    [columns],
  );

  const handleStreamEvent = useCallback(
    (event: LiveEvent) => {
      setEventsByColumn((prev) => {
        const next = { ...prev };
        for (const col of columns) {
          if (!col.types.includes(event.type)) continue;
          const list = next[col.id] ?? [];
          if (list.some((e) => e.eventId === event.eventId)) continue;
          next[col.id] = [event, ...list];
        }
        return next;
      });
    },
    [columns],
  );

  const streamStatus = useLiveEventStream(streamTypes, handleStreamEvent);

  const updateEvent = useCallback((eventId: string, fn: (e: LiveEvent) => LiveEvent) => {
    setEventsByColumn((prev) => {
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
      setEventsByColumn((prev) => {
        const next: Record<string, LiveEvent[]> = {};
        for (const [id, list] of Object.entries(prev)) {
          next[id] = list.map((e) => (e.type === type ? { ...e, read: true } : e));
        }
        return next;
      });
    } else {
      setToast("操作失败，请重试");
    }
  }, []);

  // 栏位配置：勾选/取消事件类型，至少保留一种；写回 localStorage（订阅者自动收到新快照）
  const toggleColumnType = useCallback((columnId: string, type: LiveEventType) => {
    const current = getColumnsSnapshot();
    const next = current.map((col) => {
      if (col.id !== columnId) return col;
      const types = col.types.includes(type)
        ? col.types.filter((t) => t !== type)
        : [...col.types, type];
      if (types.length === 0) return col;
      return { ...col, types };
    });
    if (next === current) return;
    saveColumns(next);
    // 类型变更的栏触发重新检索：移出已加载集合
    setLoadedColumns((prev) => {
      const s = new Set(prev);
      s.delete(columnId);
      return s;
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {streamStatus === "connecting" && (
        <p className="text-sm text-ink-dim" role="status">
          实时事件连接中…
        </p>
      )}
      {streamStatus === "closed" && (
        <p className="text-sm text-flower" role="status">
          实时连接已断开，正在尝试重连…
        </p>
      )}
      <div className="flex flex-col gap-4 lg:h-[calc(100svh-16rem)] lg:flex-row">
        {columns.map((col) => {
          const title = col.types.map(labelForType).join(" + ");
          return (
            <FeedColumn
              key={col.id}
              title={title}
              events={eventsByColumn[col.id] ?? []}
              loading={!loadedColumns.has(col.id)}
              canManage={canManage}
              onToggleRead={toggleRead}
              readAllTypes={col.types.filter((t): t is ReadAllType =>
                (READ_ALL_TYPES as readonly string[]).includes(t),
              )}
              onReadAll={handleReadAll}
              headerExtra={
                <button
                  type="button"
                  onClick={() => setConfigOpenId((id) => (id === col.id ? null : col.id))}
                  aria-expanded={configOpenId === col.id}
                  aria-label={`配置「${title}」栏`}
                  className="rounded-md border border-vine/50 px-2 py-1 text-xs text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
                >
                  配置栏位
                </button>
              }
              configPanel={
                configOpenId === col.id ? (
                  <div className="flex flex-wrap items-center gap-3 border-b border-vine/50 px-3 py-2">
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
                ) : null
              }
            />
          );
        })}
      </div>
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-md border border-flower/60 bg-raised px-4 py-2 text-sm text-ink shadow-xl">
          {toast}
          <button type="button" className="ml-2 text-ink-dim hover:text-ink" onClick={() => setToast("")}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
