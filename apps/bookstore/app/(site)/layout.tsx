import NavBar from "@/components/NavBar";
import { getSite } from "@/lib/content";
import { getTools } from "@/lib/tools/registry";

const site = getSite();

/** 公开站点布局：skip link + 导航 + 正文。后台 /backdoor 路由不在此布局内。 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-small text-night focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到正文
      </a>
      <NavBar siteName={site.name} tools={getTools()} />
      <main id="main" className="min-h-svh">
        {children}
      </main>
    </>
  );
}
