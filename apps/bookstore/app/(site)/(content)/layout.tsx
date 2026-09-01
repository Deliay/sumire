import Footer from "@/components/Footer";
import { getSite } from "@/lib/content";

const site = getSite();

/** 非首页公开页布局：流式单行页脚。首页（整页滚动容器）的全站唯一 Footer 位于素材站（末站）尾部，不经此布局。 */
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