import type { ButtonHTMLAttributes } from "react";
import Button from "@/components/ui/Button";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

/** 主按钮薄封装：共享 Button primary 变体，整宽。 */
export default function PrimaryButton({
  loading = false,
  disabled,
  children,
  ...rest
}: PrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      size="md"
      loading={loading}
      disabled={disabled}
      className="w-full"
      {...rest}
    >
      {children}
    </Button>
  );
}
