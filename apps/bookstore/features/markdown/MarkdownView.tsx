import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export default function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={`prose prose-invert max-w-none ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
