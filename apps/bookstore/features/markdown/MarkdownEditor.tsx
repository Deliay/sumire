"use client";

import dynamic from "next/dynamic";
import type { ICommand } from "@uiw/react-md-editor";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[10rem] rounded-md border border-vine bg-soft animate-pulse" />
  ),
});

/** 提问箱场景不提供的工具栏命令（按 command.name 精确匹配） */
export const HIDDEN_COMMAND_NAMES: ReadonlySet<string> = new Set([
  "code",
  "codeBlock",
  "link",
  "image",
]);

/**
 * 过滤编辑器工具栏命令。工具栏渲染与快捷键分发消费同一命令列表，
 * 因此剔除命令后按钮与快捷键一并失效；extraCommands（视图切换/全屏）恒保留。
 */
export function filterEditorCommand(
  command: ICommand,
  isExtra: boolean,
): false | ICommand {
  if (!isExtra && command.name && HIDDEN_COMMAND_NAMES.has(command.name)) {
    return false;
  }
  return command;
}

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
  const preview = readOnly ? "preview" : "live";
  return (
    <div data-color-mode="dark" style={{ minHeight }}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        preview={preview}
        height={minHeight}
        visibleDragbar={!readOnly}
        hideToolbar={readOnly}
        commandsFilter={filterEditorCommand}
      />
    </div>
  );
}
