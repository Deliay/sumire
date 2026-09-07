import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  content: string;
  className?: string;
  style?: CSSProperties;
}

export default function MarkdownView({ content, className, style }: MarkdownViewProps) {
  return (
    <div className={`prose prose-invert max-w-none ${className ?? ""}`} style={style}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
