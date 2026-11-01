import { AudioLines } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export type RecordingsEmptyReason = "unconfigured" | "unavailable" | "no-recordings";

const TEXT: Record<RecordingsEmptyReason, string> = {
  unconfigured: "录播服务未配置，暂时无法查看录制与回放。",
  unavailable: "录播服务暂时不可用，请稍后再试。",
  "no-recordings": "暂无录播。",
};

const TITLE: Record<RecordingsEmptyReason, string> = {
  unconfigured: "服务未配置",
  unavailable: "服务不可用",
  "no-recordings": "暂无录播",
};

/** 录播页通用空态：服务未配置 / 上游不可用 / 无数据。 */
export default function RecordingsEmpty({ reason }: { reason: RecordingsEmptyReason }) {
  return (
    <EmptyState
      title={TITLE[reason]}
      description={TEXT[reason]}
      action={<AudioLines size={20} aria-hidden className="text-line-strong" />}
    />
  );
}
