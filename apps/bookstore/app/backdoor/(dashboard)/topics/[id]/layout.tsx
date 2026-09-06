export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function TopicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
