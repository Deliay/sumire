"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchUsers, type UserRow } from "@/features/backdoor/api";
import UserTable from "@/features/backdoor/components/UserTable";
import { RequireRole } from "@/features/backdoor/RequireRole";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { status, data } = await fetchUsers();
      if (!active) return;
      setLoading(false);
      if (status === 200 && "users" in data) {
        setUsers(data.users);
      } else {
        setError("加载失败");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <RequireRole role="superadmin">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">用户管理</h1>
            <p className="mt-1 text-ink-dim">里屋的钥匙登记册</p>
          </div>
          <Link
            href="/backdoor/users/new"
            className="text-sm text-ink-dim transition-colors hover:text-flower"
          >
            增加用户 →
          </Link>
        </div>
        {error ? (
          <p className="text-sm text-flower">{error}</p>
        ) : (
          <UserTable users={users} loading={loading} />
        )}
      </div>
    </RequireRole>
  );
}
