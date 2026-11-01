"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Surface from "@/components/ui/Surface";
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
            <Surface
              key={option.id}
              padding="none"
              className="flex items-center justify-between px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">{option.name}</span>
                <span className="text-xs text-ink-dim">关键字：{option.keyword}</span>
              </div>
              {!voting && (
                <Button variant="danger" size="sm" onClick={() => onRemove(option.id)}>
                  删除
                </Button>
              )}
            </Surface>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Field
            label="名称"
            type="text"
            placeholder="名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={voting}
            className="flex-1"
          />
          <Field
            label="匹配关键字"
            type="text"
            placeholder="匹配关键字"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={voting}
            className="flex-1"
          />
          <Button variant="primary" size="md" onClick={handleAdd} disabled={voting}>
            添加选项
          </Button>
        </div>
      </div>

      {hint && (
        <div role="alert" className="text-sm text-crimson">
          {hint}
        </div>
      )}
    </div>
  );
}
