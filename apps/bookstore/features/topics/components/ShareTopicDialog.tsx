"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { sanitizeFilename } from "@/features/topics/components/sanitizeFilename";
import type { Topic } from "@/features/topics/types";

interface ShareTopicDialogProps {
  topic: Topic;
  onClose: () => void;
}

export default function ShareTopicDialog({ topic, onClose }: ShareTopicDialogProps) {
  // 弹层仅在客户端挂载（点击「分享」后），window.location.origin 在客户端取；SSR 时为空串
  const [link] = useState(() =>
    typeof window === "undefined" ? "" : `${window.location.origin}/topics?id=${topic.id}`,
  );
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 256, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // 二维码生成失败时静默，仅展示链接
      });
    return () => { cancelled = true; };
  }, [link]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时忽略
    }
  }, [link]);

  const filename = `投递二维码-${sanitizeFilename(topic.title)}.png`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[28rem] max-w-[calc(100vw-2.5rem)] rounded-lg border border-vine bg-raised p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium text-ink mb-1">分享投递链接</h2>
        <p className="text-sm text-ink-dim mb-4">访客扫码或打开链接即可向该主题投递</p>

        <div className="flex items-center gap-2 mb-4">
          <input
            readOnly
            value={link}
            className="flex-1 min-w-0 rounded border border-vine bg-soft px-3 py-2 text-sm text-ink"
            aria-label="投递链接"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 text-sm bg-primary text-night rounded hover:bg-primary/90"
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>

        <div className="flex flex-col items-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="投递二维码"
              width={256}
              height={256}
              className="rounded border border-vine bg-white p-2"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-ink-dim">
              二维码生成中…
            </div>
          )}
          <a
            href={qrDataUrl}
            download={filename}
            className="mt-3 px-4 py-1.5 text-sm border border-vine rounded text-ink-dim hover:text-ink"
          >
            下载二维码
          </a>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-ink-dim hover:text-ink"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}