"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";
import { LiveEventSchema } from "@/features/danmaku/types";
import { matchVote, hasKeywordConflict } from "./match";
import { loadVoteState, saveVoteState, clearVoteState } from "./store";
import { EMPTY_VOTE_STATE, type VoteState, type VoteOption } from "./types";

export function useDanmakuVote() {
  const [state, setState] = useState<VoteState>(EMPTY_VOTE_STATE);
  const [voting, setVoting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  const voterSetRef = useRef(new Set<number>());
  const esRef = useRef<EventSource | null>(null);
  const optionsRef = useRef<VoteOption[]>([]);

  // 保持 optionsRef 同步
  useEffect(() => {
    optionsRef.current = state.options;
  }, [state.options]);

  // 挂载后恢复持久化数据（SSR 时 return EMPTY_VOTE_STATE，客户端挂载后经 effect 恢复）
  useEffect(() => {
    const saved = loadVoteState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 合法的客户端 hydration 模式
    setState(saved);
    voterSetRef.current = new Set(saved.voterUids);
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  // 状态变更后回写存储（挂载恢复前不回写）
  useEffect(() => {
    if (hydrated) {
      saveVoteState(state);
    }
  }, [state, hydrated]);

  // voterUids 变更时重建 voterSet
  useEffect(() => {
    voterSetRef.current = new Set(state.voterUids);
  }, [state.voterUids]);

  function addOption(name: string, keyword: string): void {
    if (voting) return;
    const trimmedName = name.trim();
    const trimmedKeyword = keyword.trim();
    if (!trimmedName || !trimmedKeyword) {
      setHint("名称和关键字不能为空");
      return;
    }
    if (hasKeywordConflict(trimmedKeyword, optionsRef.current)) {
      setHint("关键字与已有选项冲突");
      return;
    }
    setState((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          keyword: trimmedKeyword,
          count: 0,
        },
      ],
    }));
    setHint(null);
  }

  function removeOption(id: string): void {
    if (voting) return;
    setState((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o.id !== id),
    }));
  }

  function start(): void {
    if (optionsRef.current.length === 0) {
      setHint("请先添加投票选项");
      return;
    }
    if (!API_CONFIGURED) return;

    const params = new URLSearchParams();
    params.append("type", "danmaku");
    const es = new EventSource(`${API_BASE_URL}/api/live-events/stream?${params.toString()}`, {
      withCredentials: true,
    });

    es.onmessage = (msg) => {
      try {
        const parsed = LiveEventSchema.safeParse(JSON.parse(msg.data));
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type !== "danmaku") return;

        setState((prev) => {
          const newState = { ...prev, processed: prev.processed + 1 };
          if (event.content === undefined) return newState;

          const matchedId = matchVote(event.content, optionsRef.current);
          if (matchedId && !voterSetRef.current.has(event.sender.uid)) {
            voterSetRef.current.add(event.sender.uid);
            return {
              ...newState,
              matched: newState.matched + 1,
              voterUids: [...newState.voterUids, event.sender.uid],
              options: newState.options.map((o) =>
                o.id === matchedId ? { ...o, count: o.count + 1 } : o,
              ),
            };
          }
          return newState;
        });
      } catch {
        // 非法帧静默忽略
      }
    };

    esRef.current = es;
    setVoting(true);
    setHint(null);
  }

  function stop(): void {
    esRef.current?.close();
    esRef.current = null;
    setVoting(false);
  }

  function clear(): void {
    stop();
    setState({ ...EMPTY_VOTE_STATE });
    voterSetRef.current.clear();
    clearVoteState();
    setHint(null);
  }

  // 卸载清理
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return {
    state,
    voting,
    hint,
    addOption,
    removeOption,
    start,
    stop,
    clear,
  };
}
