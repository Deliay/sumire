"use client";

import { useEffect, useState } from "react";
import { fetchUsers, type UserRow } from "@/features/backdoor/api";
import UserTable from "@/features/backdoor/components/UserTable";
import CreateUserDialog from "@/features/backdoor/components/CreateUserDialog";
import { RequireRole } from "@/features/backdoor/RequireRole";
import { useSession } from "@/features/backdoor/session";

export default function UsersPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = async () => {
    const { status, data } = await fetchUsers();
    setLoading(false);
    if (status === 200 && "users" in data) {
      setUsers(data.users);
    } else {
      setError("加载失败");
    }
  };

  useEffect(() => {
    void (async () => {
      const { status, data } = await fetchUsers();
      setLoading(false);
      if (status === 200 && "users" in data) {
        setUsers(data.users);
      } else {
        setError("加载失败");
      }
    })();
  }, []);

  const myRole = session.status === "authenticated" ? session.me.role : "member";

  return (
    <RequireRole role="superadmin">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">用户管理</h1>
            <p className="mt-1 text-ink-dim">里屋的钥匙登记册</p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="text-sm text-ink-dim transition-colors hover:text-flower"
          >
            增加用户 →
          </button>
        </div>
        {error ? (
          <p className="text-sm text-flower">{error}</p>
        ) : (
          <UserTable users={users} loading={loading} />
        )}
        <CreateUserDialog
          role={myRole}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            refresh();
          }}
        />
      </div>
    </RequireRole>
  );
}
