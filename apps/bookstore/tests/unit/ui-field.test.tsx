// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Field, { SelectField, TextareaField } from "@/components/ui/Field";

describe("Field", () => {
  afterEach(() => cleanup());

  it("label 与 id 关联", () => {
    render(<Field label="用户名" />);
    const input = screen.getByLabelText("用户名");
    expect(input.tagName).toBe("INPUT");
    expect(input.id).toBeTruthy();
  });

  it("error 渲染 role=alert + aria-invalid + aria-describedby", () => {
    render(<Field label="密码" error="密码太短" />);
    const input = screen.getByLabelText("密码");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert.id).toBe(describedBy);
    expect(alert.textContent).toBe("密码太短");
  });

  it("hint 与 disabled", () => {
    render(<Field label="昵称" hint="2-12 字" disabled />);
    expect(screen.getByText("2-12 字")).toBeTruthy();
    expect(screen.getByLabelText("昵称")).toBeDisabled();
  });

  it("TextareaField 同壳层", () => {
    render(<TextareaField label="备注" hint="可选" />);
    const textarea = screen.getByLabelText("备注");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("SelectField 同壳层", () => {
    render(
      <SelectField label="角色">
        <option value="a">成员</option>
      </SelectField>,
    );
    expect(screen.getByLabelText("角色").tagName).toBe("SELECT");
  });
});
