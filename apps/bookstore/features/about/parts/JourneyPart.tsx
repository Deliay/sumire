import Timeline from "@/components/patterns/Timeline";
import type { Profile } from "@/lib/content";

/** P4 历程・Journey：编辑体年表（日期列 + 内容列）。 */
export default function JourneyPart({ profile }: { profile: Profile }) {
  const items = profile.milestones.map((milestone, index) => ({
    key: `${milestone.date}-${milestone.title}`,
    date: milestone.date,
    title: milestone.title,
    note: milestone.note,
    current: index === profile.milestones.length - 1,
  }));
  return (
    <section className="max-w-[36rem]">
      <Timeline items={items} />
    </section>
  );
}
