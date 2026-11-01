import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

/** 带标签的输入框：soft 面、1px line-strong、8px 圆角、focus flower 环。 */
export default function TextField({ label, id, className, ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-label tracking-label uppercase text-ink-dim">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "h-11 w-full rounded-md border border-line-strong bg-soft px-3 text-ink placeholder:text-ink-mute",
          "transition-colors duration-(--duration-fast) focus:border-flower focus:outline-none focus:ring-2 focus:ring-flower/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...rest}
      />
    </div>
  );
}
