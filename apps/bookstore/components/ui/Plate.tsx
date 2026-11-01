import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PlateProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** 题注（图版名 + 分类等）。 */
  caption?: ReactNode;
  /** 图版编号：存在时题注前缀「图版 01」。 */
  index?: number;
  fit?: "cover" | "contain";
  sizes?: string;
  priority?: boolean;
  as?: "figure" | "div";
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
}

/** 图版：1px 描边、无圆角、题注。不用 fill，输出固定尺寸防 CLS。 */
export default function Plate({
  src,
  alt,
  width,
  height,
  caption,
  index,
  fit = "cover",
  sizes,
  priority,
  as = "figure",
  className,
  frameClassName,
  imageClassName,
}: PlateProps) {
  const Root = as;
  const Caption = as === "figure" ? "figcaption" : "span";
  return (
    <Root className={cn("group flex flex-col", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden border border-line bg-soft",
          frameClassName ?? "aspect-[4/5]",
        )}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className={cn(
            "h-full w-full",
            fit === "contain" ? "object-contain p-4" : "object-cover",
            imageClassName,
          )}
        />
      </div>
      {caption ? (
        <Caption className="mt-2 flex items-baseline gap-2 text-label text-ink-dim">
          {typeof index === "number" ? (
            <span className="font-display text-small text-primary">图版 {String(index).padStart(2, "0")}</span>
          ) : null}
          <span className="transition-colors group-hover:text-ink group-hover:underline">{caption}</span>
        </Caption>
      ) : null}
    </Root>
  );
}
