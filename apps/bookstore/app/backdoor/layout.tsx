import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionProvider } from "@/features/backdoor/session";
import { API_CONFIGURED } from "@/features/backdoor/api";

export const metadata: Metadata = {
  title: "后台 · 枝堇",
};

export default function BackdoorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!API_CONFIGURED) {
    notFound();
  }
  return <SessionProvider>{children}</SessionProvider>;
}
