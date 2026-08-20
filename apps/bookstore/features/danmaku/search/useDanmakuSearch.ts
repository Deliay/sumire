"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchLiveEvents, type SearchLiveEventsPage } from "./api";
import type { LiveEvent } from "../types";

export type SearchStatus = "idle" | "loading" | "error" | "done";

interface SearchState {
  results: LiveEvent[];
  total: number;
  page: number;
  status: SearchStatus;
  loadingMore: boolean;
  error: string | null;
}

const INITIAL_STATE: SearchState = {
  results: [],
  total: 0,
  page: 1,
  status: "idle",
  loadingMore: false,
  error: null,
};

export function useDanmakuSearch() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const criteriaRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, p: number, append: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!append) {
      setState((s) => ({ ...s, status: "loading", error: null }));
    } else {
      setState((s) => ({ ...s, loadingMore: true, error: null }));
    }
    try {
      const res = await searchLiveEvents(q, p, 20, controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && "total" in res.data) {
        const data = res.data as SearchLiveEventsPage;
        setState((s) => ({
          ...s,
          results: append ? [...s.results, ...data.items] : data.items,
          total: data.total,
          page: data.page,
          status: data.items.length > 0 || data.total > 0 ? "done" : "idle",
          loadingMore: false,
        }));
      } else {
        const msg = res.status === 502 ? "搜索服务不可用" : "error" in res.data ? String((res.data as { error: string }).error) : "请求失败";
        setState((s) => ({ ...s, status: "error", error: msg, loadingMore: false }));
      }
    } catch {
      if (controller.signal.aborted) return;
      setState((s) => ({ ...s, status: "error", error: "网络错误", loadingMore: false }));
    }
  }, []);

  useEffect(() => {
    const q = criteriaRef.current;
    if (!q) return;
    doSearch(q, 1, false);
  }, [doSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateInput = useCallback((value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      criteriaRef.current = "";
      setState(INITIAL_STATE);
      return;
    }
    debounceRef.current = setTimeout(() => {
      criteriaRef.current = value.trim();
      doSearch(value.trim(), 1, false);
    }, 300);
  }, [doSearch]);

  const flushSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = input.trim();
    if (trimmed) {
      criteriaRef.current = trimmed;
      doSearch(trimmed, 1, false);
    }
  }, [input, doSearch]);

  const loadMore = useCallback(() => {
    if (state.status === "error" || state.loadingMore || state.results.length >= state.total) return;
    doSearch(criteriaRef.current, state.page + 1, true);
  }, [state.status, state.loadingMore, state.results.length, state.total, state.page, doSearch]);

  return { input, updateInput, flushSearch, ...state, loadMore };
}
