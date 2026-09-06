"use client";

import { useState } from "react";
import MarkdownView from "@/features/markdown/MarkdownView";

interface CollapsibleMarkdownProps {
  content: string;
}

export default function CollapsibleMarkdown({ content }: CollapsibleMarkdownProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        <MarkdownView content={content} />
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-sm text-primary hover:text-primary/80 transition-colors duration-150"
      >
        {expanded ? "收起" : "展开"}
      </button>
    </div>
  );
}
