// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RequireRole } from "@/features/backdoor/RequireRole";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const state = { role: "member" };

vi.mock("@/features/backdoor/session", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      me: { ok: true, username: "u", role: state.role, mustChangePassword: false },
    },
  }),
}));

function renderWith(role: string, required: "superadmin" | "admin") {
  state.role = role;
  return render(
    <RequireRole role={required}>
      <div>protected-content</div>
    </RequireRole>,
  );
}

describe("RequireRole 权限守卫", () => {
  afterEach(() => {
    cleanup();
  });

  it("角色满足时渲染受保护内容", () => {
    renderWith("superadmin", "superadmin");
    expect(screen.getByText("protected-content")).toBeTruthy();
  });

  it("超管访问 admin 门槛通过", () => {
    renderWith("superadmin", "admin");
    expect(screen.getByText("protected-content")).toBeTruthy();
  });

  it("admin 访问 superadmin 门槛不通过（渲染加载态，无受保护内容）", () => {
    renderWith("admin", "superadmin");
    expect(screen.queryByText("protected-content")).toBeNull();
    expect(screen.getByText("正在确认身份…")).toBeTruthy();
  });

  it("member 访问 admin 门槛不通过", () => {
    renderWith("member", "admin");
    expect(screen.queryByText("protected-content")).toBeNull();
  });
});
