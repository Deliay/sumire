"use client";

import Link from "next/link";
import { useState } from "react";
import { useDanmakuVote } from "@/features/danmaku-tools/vote/useDanmakuVote";
import VoteOptionsEditor from "@/features/danmaku-tools/vote/components/VoteOptionsEditor";
import VoteControlBar from "@/features/danmaku-tools/vote/components/VoteControlBar";
import VoteStatsTable from "@/features/danmaku-tools/vote/components/VoteStatsTable";
import ClearVoteDialog from "@/features/danmaku-tools/vote/components/ClearVoteDialog";

export default function VotePage() {
  const { state, voting, hint, addOption, removeOption, start, stop, clear } =
    useDanmakuVote();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  function handleClear() {
    setClearDialogOpen(true);
  }

  function handleConfirmClear() {
    clear();
    setClearDialogOpen(false);
  }

  function handleCancelClear() {
    setClearDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">弹幕投票</h1>
          <p className="mt-2 text-ink-dim">
            观众弹幕实时投票统计工具
          </p>
        </div>
        <Link
          href="/backdoor/danmaku-tools"
          className="text-sm text-ink-dim transition-colors hover:text-ink"
        >
          ← 返回工具列表
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <VoteOptionsEditor
            options={state.options}
            voting={voting}
            onAdd={addOption}
            onRemove={removeOption}
            hint={hint}
          />
          <VoteControlBar
            voting={voting}
            onStart={start}
            onStop={stop}
            onClear={handleClear}
            hint={null}
          />
        </div>

        <VoteStatsTable
          options={state.options}
          processed={state.processed}
          matched={state.matched}
        />
      </div>

      <ClearVoteDialog
        open={clearDialogOpen}
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </div>
  );
}
