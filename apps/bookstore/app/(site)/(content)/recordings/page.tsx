import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import RecordingsEmpty from "@/features/recordings/RecordingsEmpty";
import RecordingsApp from "@/features/recordings/RecordingsApp";

export const metadata: Metadata = {
  title: "录播 · 枝堇",
  description: "枝堇Sumire 的直播录制状态、实时音频收听与历史录播回放。",
};

export default function RecordingsPage() {
  if (!RECORDINGS_CONFIGURED) {
    return (
      <PageShell width="wide">
        <RecordingsEmpty reason="unconfigured" />
      </PageShell>
    );
  }
  return <RecordingsApp />;
}
