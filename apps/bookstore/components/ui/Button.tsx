import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "border-transparent bg-primary text-night hover:bg-primary-deep",
  secondary: "border-line-strong bg-transparent text-ink hover:bg-soft",
  ghost: "border-transparent bg-transparent text-ink-dim hover:bg-soft hover:text-ink",
  danger: "border-crimson/40 bg-transparent text-crimson hover:bg-crimson/10",
};

const SIZES: Record<Size, string> = {
  md: "h-11 px-5",
  sm: "h-9 px-3.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  className?: string;
  children?: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border font-sans text-small font-medium transition-colors " +
  "duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** 统一按钮：四变体、两尺寸、loading / disabled、href 渲染为链接。 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "start",
  href,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  const iconNode = icon ? <span aria-hidden>{icon}</span> : null;
  const content = (
    <>
      {iconPosition === "start" ? iconNode : null}
      <span>{loading ? "处理中…" : children}</span>
      {iconPosition === "end" ? iconNode : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      {...rest}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
