import type { Metadata } from "next";
import { SessionProvider } from "@/features/backdoor/session";

export const metadata: Metadata = {
  title: "后台 · 枝堇",
};

export default function BackdoorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SessionProvider>{children}</SessionProvider>;
}
