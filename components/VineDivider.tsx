interface VineDividerProps {
  className?: string;
  /** 水平翻转，用于上下相邻区块的错节 */
  flip?: boolean;
  /** 是否播放生长动画（页面首屏用 true，其余静态呈现） */
  grow?: boolean;
}

/**
 * 藤蔓分隔线：一条带叶与堇花的曲线，替代生硬的直线分割。
 */
export default function VineDivider({
  className = "",
  flip = false,
  grow = false,
}: VineDividerProps) {
  return (
    <svg
      viewBox="0 0 1200 64"
      preserveAspectRatio="none"
      aria-hidden
      className={`${grow ? "vine-draw " : ""}h-12 w-full ${
        flip ? "-scale-y-100" : ""
      } ${className}`}
    >
      <path
        data-grow={grow ? "" : undefined}
        pathLength={1}
        d="M0 38 C 140 14, 260 56, 400 32 S 680 52, 830 28 S 1090 48, 1200 30"
        fill="none"
        stroke="var(--color-vine)"
        strokeWidth="2"
      />
      {/* 叶片 */}
      <g fill="var(--color-vine)" opacity="0.85">
        <path d="M398 30 q -16 -16 -34 -12 q 10 16 34 12" />
        <path d="M826 26 q 14 -18 32 -15 q -8 17 -32 15" />
        <path d="M640 44 q -14 14 -30 11 q 8 -14 30 -11" />
      </g>
      {/* 堇花 */}
      <g>
        <circle cx="180" cy="34" r="5" className="flower-node" />
        <circle cx="600" cy="42" r="4.2" className="flower-node" />
        <circle cx="1010" cy="38" r="5" className="flower-node" />
      </g>
    </svg>
  );
}
