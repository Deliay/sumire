import { notFound } from "next/navigation";
import { getTool, getTools } from "@/lib/tools/registry";

/**
 * 工具分发页：由工具注册表驱动。
 * 注册表为空的 V1 中，任何 slug 都 404——未上线功能没有占位。
 */
export function generateStaticParams() {
  return getTools().map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-28 lg:px-10">
      <h1 className="font-serif text-4xl font-bold tracking-wider">
        {tool.name}
      </h1>
      <p className="mt-2 text-ink-dim">{tool.description}</p>
    </div>
  );
}
