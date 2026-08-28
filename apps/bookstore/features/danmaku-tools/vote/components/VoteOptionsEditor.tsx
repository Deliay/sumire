"use client";

import { useState } from "react";
import type { VoteOption } from "../types";

interface VoteOptionsEditorProps {
  options: VoteOption[];
  voting: boolean;
  onAdd: (name: string, keyword: string) => void;
  onRemove: (id: string) => void;
  hint: string | null;
}

export default function VoteOptionsEditor({
  options,
  voting,
  onAdd,
  onRemove,
  hint,
}: VoteOptionsEditorProps) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");

  function handleAdd() {
    onAdd(name, keyword);
    setName("");
    setKeyword("");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-semibold text-ink">投票选项</h2>

      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="flex items-center justify-between rounded-md border border-vine/50 bg-raised px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">{option.name}</span>
                <span className="text-xs text-ink-dim">关键字：{option.keyword}</span>
              </div>
              {!voting && (
                <button
                  type="button"
                  onClick={() => onRemove(option.id)}
                  className="text-sm text-ink-dim transition-colors hover:text-crimson"
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={voting}
            className="flex-1 rounded-md border border-vine/50 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim/50 focus:border-flower disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="匹配关键字"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={voting}
            className="flex-1 rounded-md border border-vine/50 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim/50 focus:border-flower disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={voting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          添加选项
        </button>
      </div>

      {hint && (
        <div role="alert" className="text-sm text-crimson">
          {hint}
        </div>
      )}
    </div>
  );
}
