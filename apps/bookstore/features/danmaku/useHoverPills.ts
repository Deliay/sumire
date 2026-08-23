/** 悬停胶囊集合 hook：管理 SC/上船事件的胶囊生命周期与倒计时。 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveEvent, LiveEventType } from "./types";
import { isHoverable, pillPrice, hoverDuration, pillKind, pillSort, type HoverPill } from "./hoverTopBar";

export function useHoverPills(types: readonly LiveEventType[]) {
  const [pills, setPills] = useState<HoverPill[]>([]);
  const typesRef = useRef(types);
  useEffect(() => {
    typesRef.current = types;
  }, [types]);

  const add = useCallback((event: LiveEvent) => {
    if (!isHoverable(event)) return;
    if (!typesRef.current.includes(event.type)) return;

    const now = Date.now();
    const duration = hoverDuration(event);
    const pill: HoverPill = {
      eventId: event.eventId,
      kind: pillKind(event),
      price: pillPrice(event),
      arrivedAt: now,
      expiresAt: now + duration * 1000,
      event,
    };

    setPills((prev) => {
      const filtered = prev.filter((p) => p.eventId !== pill.eventId);
      return [...filtered, pill].sort(pillSort);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPills((prev) => {
        const now = Date.now();
        const filtered = prev.filter((p) => p.expiresAt > now);
        return filtered.length === prev.length ? prev : filtered.sort(pillSort);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [types]);

  return { pills, add };
}
