import type { ButtonHTMLAttributes } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

/** 主按钮：应援色填充 + 深色文字；提交中置灰禁用并显示加载文案。 */
export default function PrimaryButton({
  loading = false,
  disabled,
  children,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-ink-on-paper transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "处理中…" : children}
    </button>
  );
}
