import { ExternalLink } from "lucide-react";

interface ExternalButtonProps {
  href: string;
  label: string;
}

/**
 * 外链按钮：细描边，hover 时堇花紫描边 + 微光。
 */
export default function ExternalButton({ href, label }: ExternalButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-vine px-5 py-2 text-sm tracking-wider text-ink transition-all hover:border-flower hover:shadow-[0_0_18px_-2px_var(--color-flower)]"
    >
      {label}
      <ExternalLink size={14} className="text-ink-dim" />
    </a>
  );
}
