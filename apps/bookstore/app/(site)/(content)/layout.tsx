import Footer from "@/components/Footer";
import { getSite } from "@/lib/content";

const site = getSite();

/** 非首页公开页布局：流式单行页脚。首页（100svh 封面页）自带贴边 floating 页脚，不经此布局。 */
export default function ContentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Footer site={site} />
    </>
  );
}