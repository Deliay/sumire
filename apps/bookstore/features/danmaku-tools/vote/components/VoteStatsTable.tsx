"use client";

import type { VoteOption } from "../types";

interface VoteStatsTableProps {
  options: VoteOption[];
  processed: number;
  matched: number;
}

export default function VoteStatsTable({
  options,
  processed,
  matched,
}: VoteStatsTableProps) {
  const totalVotes = options.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-dim">
        已处理 {processed} 条弹幕，其中 {matched} 条匹配
      </p>

      {options.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">投票统计</caption>
          <thead>
            <tr className="border-b border-vine/50">
              <th className="px-3 py-2 text-left font-medium text-ink">名称</th>
              <th className="px-3 py-2 text-right font-medium text-ink">票数</th>
              <th className="px-3 py-2 text-right font-medium text-ink">占比</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <tr key={option.id} className="border-b border-vine/50">
                <td className="px-3 py-2 text-ink">{option.name}</td>
                <td className="px-3 py-2 text-right text-ink">{option.count}</td>
                <td className="px-3 py-2 text-right text-ink-dim">
                  {totalVotes > 0
                    ? `${((option.count / totalVotes) * 100).toFixed(1)}%`
                    : "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
