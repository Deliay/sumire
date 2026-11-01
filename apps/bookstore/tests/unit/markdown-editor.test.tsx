// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getCommands, getExtraCommands } from "@uiw/react-md-editor/commands";
import type { ICommand } from "@uiw/react-md-editor";

import MarkdownEditor, {
  HIDDEN_COMMAND_NAMES,
  filterEditorCommand,
} from "@/features/markdown/MarkdownEditor";

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

// next/dynamic 在 jsdom 下异步解析会引入抖动；替换为同步 stub 并捕获传给 MDEditor 的 props
vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicStub(props: Record<string, unknown>) {
      captured.props = props;
      return null;
    };
  },
}));

const HIDDEN_NAMES = ["code", "codeBlock", "link", "image"] as const;
const HIDDEN_LABELS = [
  "Insert code (ctrl + j)",
  "Insert Code Block (ctrl + shift + j)",
  "Add a link (ctrl + l)",
  "Add image (ctrl + k)",
];

function renderEditor(readOnly?: boolean): Record<string, unknown> {
  captured.props = null;
  render(<MarkdownEditor value="" onChange={() => {}} readOnly={readOnly} />);
  const props = captured.props;
  if (!props) {
    throw new Error("MDEditor props 未被捕获");
  }
  return props;
}

afterEach(() => {
  cleanup();
});

describe("filterEditorCommand 纯函数", () => {
  it("denylist 恰为 code / codeBlock / link / image", () => {
    expect([...HIDDEN_COMMAND_NAMES].sort()).toEqual([...HIDDEN_NAMES].sort());
  });

  it("四个被移除命令返回 false", () => {
    for (const name of HIDDEN_NAMES) {
      expect(filterEditorCommand({ name } as ICommand, false)).toBe(false);
    }
  });

  it("其余命令原对象放行", () => {
    const byName = new Map(
      getCommands()
        .filter((command) => command.name)
        .map((command) => [command.name as string, command]),
    );
    for (const name of [
      "bold",
      "italic",
      "strikethrough",
      "hr",
      "title",
      "quote",
      "comment",
      "table",
      "help",
    ]) {
      const command = byName.get(name);
      expect(command).toBeDefined();
      expect(filterEditorCommand(command as ICommand, false)).toBe(command);
    }
  });

  it("isExtra=true 时即使命中 denylist 也原样放行", () => {
    for (const name of HIDDEN_NAMES) {
      const command = { name } as ICommand;
      expect(filterEditorCommand(command, true)).toBe(command);
    }
  });
});

describe("真实默认命令集过滤", () => {
  it("默认命令集恰含四个被移除命令（防 denylist 空跑）", () => {
    const hits = getCommands().filter(
      (command) => command.name && HIDDEN_COMMAND_NAMES.has(command.name),
    );
    expect(hits.map((command) => command.name).sort()).toEqual([...HIDDEN_NAMES].sort());
  });

  it("过滤结果等于默认序列剔除四命令，其余命令与顺序全保留", () => {
    const defaults = getCommands();
    const filtered = defaults
      .map((command) => filterEditorCommand(command, false))
      .filter(Boolean) as ICommand[];
    const expected = defaults.filter(
      (command) => !(command.name && HIDDEN_COMMAND_NAMES.has(command.name)),
    );

    expect(filtered).toHaveLength(expected.length);
    filtered.forEach((command, index) => {
      expect(command).toBe(expected[index]);
    });
  });

  it("过滤结果不含四个被移除按钮的 aria-label", () => {
    const labels = getCommands()
      .map((command) => filterEditorCommand(command, false))
      .filter(Boolean)
      .map((command) => (command as ICommand).buttonProps?.["aria-label"]);

    for (const label of HIDDEN_LABELS) {
      expect(labels).not.toContain(label);
    }
  });

  it("快捷键同源失效：过滤结果不含 code / codeBlock / link / image 的 keyCommand", () => {
    const keyCommands = getCommands()
      .map((command) => filterEditorCommand(command, false))
      .filter(Boolean)
      .map((command) => (command as ICommand).keyCommand);

    for (const name of HIDDEN_NAMES) {
      expect(keyCommands).not.toContain(name);
    }
  });

  it("extraCommands 全量保留（edit / live / preview / fullscreen 不被误伤）", () => {
    const extras = getExtraCommands();
    const filtered = extras
      .map((command) => filterEditorCommand(command, true))
      .filter(Boolean) as ICommand[];

    expect(filtered).toHaveLength(extras.length);
    filtered.forEach((command, index) => {
      expect(command).toBe(extras[index]);
    });

    const names = filtered.map((command) => command.name);
    expect(names).toEqual(expect.arrayContaining(["edit", "live", "preview", "fullscreen"]));
  });
});

describe("MarkdownEditor 组件透传", () => {
  it("非只读默认 Live code 分屏、工具栏保留、拖拽调高可用", () => {
    const props = renderEditor();

    expect(props.preview).toBe("live");
    expect(props.hideToolbar).toBe(false);
    expect(props.visibleDragbar).toBe(true);
    expect(props.height).toBe("10rem");
    expect(props.commandsFilter).toBe(filterEditorCommand);
  });

  it("只读维持纯预览并隐藏工具栏", () => {
    const props = renderEditor(true);

    expect(props.preview).toBe("preview");
    expect(props.hideToolbar).toBe(true);
    expect(props.visibleDragbar).toBe(false);
  });

  it("组件把过滤器交给库：作用于真实命令集与纯函数层一致", () => {
    const props = renderEditor();
    const commandsFilter = props.commandsFilter as (
      command: ICommand,
      isExtra: boolean,
    ) => false | ICommand;

    const filtered = getCommands()
      .map((command) => commandsFilter(command, false))
      .filter(Boolean)
      .map((command) => (command as ICommand).name);

    expect(filtered).not.toEqual(expect.arrayContaining([...HIDDEN_NAMES]));
    expect(getExtraCommands().map((command) => commandsFilter(command, true))).toEqual(
      getExtraCommands(),
    );
  });
});
