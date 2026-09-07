"use client";

import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[10rem] rounded-md border border-vine bg-soft animate-pulse" />
  ),
});

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = "10rem",
}: MarkdownEditorProps) {
  const preview = readOnly ? "preview" : "edit";
  return (
    <div data-color-mode="dark" style={{ minHeight }}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        preview={preview}
        height={minHeight}
        visibleDragbar={!readOnly}
        hideToolbar={readOnly}
      />
    </div>
  );
}
