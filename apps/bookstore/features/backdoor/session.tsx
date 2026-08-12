"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, type MeResponse } from "@/features/backdoor/api";
import GuardLoading from "@/features/backdoor/components/GuardLoading";

export type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; me: MeResponse };

interface SessionContextValue {
  session: SessionState;
  refresh: () => Promise<void>;
  clear: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const CHANGE_PASSWORD_PATH = "/backdoor/change-password";
const LOGIN_PATH = "/backdoor/login";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const { status, data } = await fetchMe();
    if (status === 200 && data.ok) {
      setSession({ status: "authenticated", me: data });
    } else {
      setSession({ status: "unauthenticated" });
    }
  }, []);

  const clear = useCallback(() => {
    setSession({ status: "unauthenticated" });
  }, []);

  // 初始加载会话
  useEffect(() => {
    let active = true;
    void (async () => {
      const { status, data } = await fetchMe();
      if (!active) return;
      if (status === 200 && data.ok) {
        setSession({ status: "authenticated", me: data });
      } else {
        setSession({ status: "unauthenticated" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 会话守卫：未登录跳登录页；强制改密限制在改密页（改密页/登录页除外防循环）
  useEffect(() => {
    if (session.status === "loading") return;
    const isAuthPath = pathname === LOGIN_PATH || pathname === CHANGE_PASSWORD_PATH;
    if (session.status === "unauthenticated" && !isAuthPath) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (session.status === "authenticated" && session.me.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [session, pathname, router]);

  const value = useMemo(() => ({ session, refresh, clear }), [session, refresh, clear]);

  if (session.status === "loading") {
    return <GuardLoading />;
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession 必须在 SessionProvider 内使用");
  return ctx;
}
