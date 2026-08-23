"use client";

import { useEffect, useCallback } from "react";
import type { LiveEvent } from "../types";
import { formatPrice, guardLevelName, guardLevelTone, labelForType } from "../format";
import Sender from "./Sender";

interface GiftCardDialogProps {
  /** 要展示的事件数据，null 时不渲染浮层。 */
  event: LiveEvent | null;
  /** 关闭回调。 */
  onClose: () => void;
}

/**
 * 礼物卡片浮层：点击胶囊后弹出，展示 SC/上船事件的详细信息卡片。
 * 模态对话框，居中展示，半透明遮罩背景，圆角边框，阴影效果。
 * 可通过点击关闭按钮、点击遮罩层或按 Esc 键关闭。
 */
export default function GiftCardDialog({ event, onClose }: GiftCardDialogProps) {
  // Esc 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!event) return;
    // 打开时阻止背景滚动
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [event, handleKeyDown]);

  if (!event) return null;

  const isSc = event.type === "super_chat";
  const isGuard = event.type === "guard_buy";
  const colors = isSc ? event.scColors : null;
  const guard = isGuard ? event.guard : null;
  const level = guard?.level ?? event.sender.guardLevel ?? 2;
  const tone = isGuard ? guardLevelTone(level) : null;

  // 点击遮罩层关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // 键盘事件处理
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      onKeyUp={handleKeyUp}
      role="dialog"
      aria-modal="true"
      aria-label="事件详情卡片"
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-vine/50 bg-raised p-6 shadow-2xl"
        style={
          colors
            ? {
                background: `linear-gradient(135deg, ${colors.backgroundStart}, ${colors.backgroundEnd})`,
                color: colors.fontColor,
              }
            : isGuard && tone
              ? undefined
              : undefined
        }
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/10 text-current opacity-70 transition-opacity hover:opacity-100"
          aria-label="关闭"
        >
          ✕
        </button>

        {/* 事件类型标签 */}
        <div className="mb-4">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              isSc
                ? "bg-white/20"
                : isGuard && tone
                  ? `${tone.chip} ${tone.text}`
                  : "bg-vine/20 text-ink-dim"
            }`}
          >
            {labelForType(event.type)}
          </span>
        </div>

        {/* 发送者信息 */}
        <div className="mb-4">
          <Sender
            sender={event.sender}
            guardLevel={isGuard ? level : undefined}
          />
        </div>

        {/* SC 留言内容 */}
        {isSc && event.content !== undefined && (
          <div className="mb-4 rounded-lg bg-black/10 p-3">
            <p className="text-sm break-words select-text">{event.content}</p>
          </div>
        )}

        {/* 金额/价格 */}
        {event.price !== undefined && (
          <div className="mb-4">
            <span className={`text-2xl font-bold ${isSc ? "" : isGuard && tone ? tone.text : "text-ink"}`}>
              {formatPrice(event.price)}
            </span>
          </div>
        )}

        {/* 上船类型 */}
        {isGuard && (
          <div className="mb-4">
            <span className={`text-lg font-semibold ${tone ? tone.text : "text-ink"}`}>
              {guardLevelName(level) ?? guard?.name ?? "上船"}
            </span>
          </div>
        )}

        {/* 发生时间 */}
        <div className="text-xs opacity-70">
          {new Date(event.occurredAt).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
