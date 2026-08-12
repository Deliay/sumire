import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

/** 带标签的深色输入框（后台工作台风格，紧凑）。 */
export default function TextField({ label, id, ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-dim">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-md border border-vine/50 bg-soft px-3 py-2 text-base text-ink outline-none transition-colors duration-150 focus:border-flower"
        {...rest}
      />
    </div>
  );
}
