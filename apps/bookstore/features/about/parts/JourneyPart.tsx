import VineTimeline from "@/features/about/VineTimeline";
import type { Profile } from "@/lib/content";
import { SectionTitle } from "./SectionTitle";

/** P4 历程・Journey：藤蔓时间轴。 */
export default function JourneyPart({ profile }: { profile: Profile }) {
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle sub="Journey">历程</SectionTitle>
      <VineTimeline milestones={profile.milestones} />
    </section>
  );
}