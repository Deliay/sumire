"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseBiliLinks, type BiliLinkToken } from "../biliVideo";
import { fetchBiliCover } from "../api";

interface VideoPreviewCardProps {
  bvId: string;
}

function VideoPreviewCard({ bvId }: VideoPreviewCardProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBiliCover>>["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchBiliCover(bvId).then((res) => {
      if (cancelled) return;
      if (res.status === 200 && "id" in res.data) {
        setData(res.data);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bvId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md bg-soft text-xs text-ink-dim">
        加载中…
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-md border border-vine/50 bg-raised transition-colors duration-150 hover:border-flower"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.image}
        alt={data.title}
        className="h-36 w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="px-2.5 py-2">
        <p className="line-clamp-2 text-sm font-medium text-ink">{data.title}</p>
        <p className="mt-0.5 text-xs text-ink-dim">{data.author}</p>
      </div>
    </a>
  );
}

interface BiliLinkSegmentProps {
  bvId: string;
  url: string;
  onEnter: (bvId: string, target: HTMLElement) => void;
  onLeave: () => void;
}

function BiliLinkSegment({ bvId, url, onEnter, onLeave }: BiliLinkSegmentProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <a
      ref={ref}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseEnter={() => ref.current && onEnter(bvId, ref.current)}
      onMouseLeave={onLeave}
      className="inline-flex items-center gap-0.5 text-eye underline decoration-eye/40 transition-colors duration-150 hover:text-flower hover:decoration-flower/60"
    >
      <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
        <path d="M4 2.5v11l9-5.5z" />
      </svg>
      {bvId}
    </a>
  );
}

interface BiliVideoLinkProps {
  text: string;
  /** 自定义文本颜色类名（SC 留言需跟随 scColors.fontColor）。 */
  className?: string;
}

/**
 * 解析文本中的 BV 号并渲染为可点击链接，鼠标悬浮显示视频预览卡片。
 * 非 BV 部分保持纯文本。
 */
export default function BiliVideoLink({ text, className }: BiliVideoLinkProps) {
  const [hoveredBv, setHoveredBv] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tokens: BiliLinkToken[] = parseBiliLinks(text);

  const handleLinkEnter = useCallback((bvId: string, target: HTMLElement) => {
    clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const POPOVER_W = 256;
      const POPOVER_H = 200;
      let x = rect.left;
      let y = rect.bottom + 8;
      if (x + POPOVER_W > window.innerWidth) x = window.innerWidth - POPOVER_W - 8;
      if (x < 0) x = 8;
      if (y + POPOVER_H > window.innerHeight) y = rect.top - POPOVER_H - 8;
      setPopoverPos({ x, y });
      setHoveredBv(bvId);
    }, 300);
  }, []);

  const handleLinkLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setHoveredBv(null);
    }, 200);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    clearTimeout(leaveTimerRef.current);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setHoveredBv(null);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(hoverTimerRef.current);
      clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const popover =
    hoveredBv
      ? createPortal(
          <div
            role="tooltip"
            className="fixed z-50 w-64"
            style={{ left: popoverPos.x, top: popoverPos.y }}
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handlePopoverLeave}
          >
            <VideoPreviewCard bvId={hoveredBv} />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span ref={containerRef} className={className}>
        {tokens.map((token) =>
          token.type === "bv" ? (
            <BiliLinkSegment
              key={token.bvId}
              bvId={token.bvId}
              url={token.url}
              onEnter={handleLinkEnter}
              onLeave={handleLinkLeave}
            />
          ) : (
            <span key={token.content}>{token.content}</span>
          ),
        )}
      </span>
      {popover}
    </>
  );
}
