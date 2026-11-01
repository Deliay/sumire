import type { InputHTMLAttributes } from "react";
import Field from "@/components/ui/Field";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

/** 后台输入框：共享 Field 的薄封装（统一 token / 焦点环 / 错误态）。 */
export default function TextField({ label, id, ...rest }: TextFieldProps) {
  return <Field label={label} id={id} {...rest} />;
}
