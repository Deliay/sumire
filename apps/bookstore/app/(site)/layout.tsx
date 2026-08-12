import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { getSite } from "@/lib/content";
import { getTools } from "@/lib/tools/registry";

const site = getSite();

/** 公开站点布局：导航 + 内容 + 页脚（后台 /backdoor 路由不在此布局内）。 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <NavBar siteName={site.name} tools={getTools()} />
      <main className="min-h-svh">{children}</main>
      <Footer site={site} />
    </>
  );
}
