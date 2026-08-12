import type { Milestone } from "@/lib/content";

/**
 * 藤蔓时间轴：轴体是一根藤蔓曲线，节点是微光堇花。
 * 桌面端左右交错，移动端单侧排列。
 */
export default function VineTimeline({
  milestones,
}: {
  milestones: Milestone[];
}) {
  return (
    <div className="relative py-4">
      {/* 藤蔓轴 */}
      <svg
        aria-hidden
        className="absolute left-3 top-0 h-full w-6 md:left-1/2 md:-translate-x-1/2"
        viewBox="0 0 24 1000"
        preserveAspectRatio="none"
      >
        <path
          d="M12 0 C 20 120, 4 240, 12 360 S 20 600, 12 720 S 6 920, 12 1000"
          fill="none"
          stroke="var(--color-vine)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <ol className="flex flex-col gap-12">
        {milestones.map((milestone, index) => {
          const left = index % 2 === 0;
          return (
            <li key={milestone.date} className="relative md:grid md:grid-cols-2">
              {/* 堇花节点 */}
              <span
                className="flower-node absolute left-3 top-1.5 size-4 -translate-x-1/2 rounded-full md:left-1/2"
                aria-hidden
              />
              <div
                className={`pl-10 md:pl-0 ${
                  left
                    ? "md:col-start-1 md:pr-12 md:text-right"
                    : "md:col-start-2 md:pl-12"
                }`}
              >
                <time className="font-display text-lg italic tracking-widest text-primary">
                  {milestone.date}
                </time>
                <h3 className="mt-1 font-serif text-xl font-semibold text-ink">
                  {milestone.title}
                </h3>
                {milestone.note && (
                  <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                    {milestone.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
