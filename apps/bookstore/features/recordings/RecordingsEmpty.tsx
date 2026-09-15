import { AudioLines } from "lucide-react";

export type RecordingsEmptyReason = "unconfigured" | "unavailable" | "no-recordings";

const TEXT: Record<RecordingsEmptyReason, string> = {
  unconfigured: "录播服务未配置，暂时无法查看录制与回放。",
  unavailable: "录播服务暂时不可用，请稍后再试。",
  "no-recordings": "暂无录播。",
};

/** 录播页通用空态：服务未配置 / 上游不可用 / 无数据。 */
export default function RecordingsEmpty({ reason }: { reason: RecordingsEmptyReason }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-vine/50 bg-raised/60 px-6 py-12 text-center text-ink-dim">
      <AudioLines size={28} aria-hidden className="text-vine" />
      <p>{TEXT[reason]}</p>
    </div>
  );
}
