import Link from "next/link";

interface ToolCardProps {
  name: string;
  description: string;
  href: string;
}

export default function ToolCard({ name, description, href }: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-lg border border-vine/50 bg-raised transition-all duration-200 hover:-translate-y-0.5 hover:border-flower/70"
    >
      <div className="p-5">
        <h3 className="font-serif text-lg font-semibold text-ink group-hover:text-flower">
          {name}
        </h3>
        <p className="mt-2 text-sm text-ink-dim">{description}</p>
      </div>
    </Link>
  );
}
