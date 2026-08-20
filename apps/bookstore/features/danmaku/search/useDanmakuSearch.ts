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
  /** 最近一次追加失败的页码（用于重试） */
  failedPage: number | null;
}

const INITIAL_STATE: SearchState = {
  results: [],
  total: 0,
  page: 1,
  status: "idle",
  loadingMore: false,
  error: null,
  failedPage: null,
};

export function useDanmakuSearch() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const [criteria, setCriteria] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const criteriaRef = useRef("");

  const doSearch = useCallback(async (q: string, p: number, append: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!append) {
      setState((s) => ({ ...s, results: [], total: 0, page: 1, status: "loading", error: null, failedPage: null }));
    } else {
      setState((s) => ({ ...s, loadingMore: true, error: null, failedPage: null }));
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
          status: "done",
          loadingMore: false,
          failedPage: null,
        }));
      } else {
        const msg = res.status === 502 ? "搜索服务不可用" : "error" in res.data ? String((res.data as { error: string }).error) : "请求失败";
        if (append) {
          setState((s) => ({ ...s, loadingMore: false, error: msg, failedPage: p }));
        } else {
          setState((s) => ({ ...s, status: "error", error: msg, loadingMore: false, failedPage: null }));
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      if (append) {
        setState((s) => ({ ...s, loadingMore: false, error: "网络错误", failedPage: p }));
      } else {
        setState((s) => ({ ...s, status: "error", error: "网络错误", loadingMore: false, failedPage: null }));
      }
    }
  }, []);

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
      abortRef.current?.abort();
      criteriaRef.current = "";
      setCriteria("");
      setState(INITIAL_STATE);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const q = value.trim();
      criteriaRef.current = q;
      setCriteria(q);
      doSearch(q, 1, false);
    }, 300);
  }, [doSearch]);

  const flushSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = input.trim();
    if (trimmed) {
      criteriaRef.current = trimmed;
      setCriteria(trimmed);
      return doSearch(trimmed, 1, false);
    }
    return Promise.resolve();
  }, [input, doSearch]);

  const retryFailedPage = useCallback(() => {
    const fp = state.failedPage;
    if (fp === null) return;
    doSearch(criteriaRef.current, fp, true);
  }, [state.failedPage, doSearch]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || state.results.length >= state.total) return;
    doSearch(criteriaRef.current, state.page + 1, true);
  }, [state.loadingMore, state.results.length, state.total, state.page, doSearch]);

  return { input, criteria, updateInput, flushSearch, ...state, loadMore, retryFailedPage };
}
