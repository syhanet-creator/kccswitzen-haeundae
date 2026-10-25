import { Table } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

/** 표 속성: 폭·높이(px), 배치, 테두리 모양/굵기/색. 표 요소의 style 로 저장된다. */
export type TableAlign = "inline" | "left" | "center" | "right" | "float-left" | "float-right";
export const BORDER_STYLES = [["solid", "실선"], ["dashed", "파선"], ["dotted", "점선"], ["double", "이중선"], ["none", "없음"]] as const;
export const BORDER_WIDTHS = [1, 2, 3, 4, 6] as const;
export const BORDER_COLORS = ["#e5e7eb", "#9ca3af", "#111827", "#2563eb", "#dc2626", "#16a34a"] as const;
export const ALIGNS: [TableAlign, string][] = [
  ["inline", "글자처럼 취급"], ["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"],
  ["float-left", "왼쪽 글 둘러싸기"], ["float-right", "오른쪽 글 둘러싸기"],
];

const STEP_W = 20; // Ctrl+←/→ 한 번에 바뀌는 폭(px)
const STEP_H = 20; // Ctrl+↑/↓ 한 번에 바뀌는 높이(px)
const MIN_W = 120;
const MIN_H = 40;

const px = (el: HTMLElement, prop: "width" | "height") => {
  const v = el.style[prop];
  return v.endsWith("px") ? parseFloat(v) : null;
};

const ALIGN_STYLE: Record<TableAlign, string> = {
  inline: "",
  left: "margin-left: 0; margin-right: auto",
  center: "margin-left: auto; margin-right: auto",
  right: "margin-left: auto; margin-right: 0",
  "float-left": "float: left; margin-right: 16px; margin-bottom: 8px",
  "float-right": "float: right; margin-left: 16px; margin-bottom: 8px",
};

/** 표 속성을 표 요소의 style 문자열로 만든다(저장 HTML과 편집 화면에서 같이 쓴다). */
function tableStyle(a: Record<string, unknown>) {
  const parts: string[] = [];
  if (a.tbWidth) parts.push(`width: ${a.tbWidth}px`);
  if (a.tbHeight) parts.push(`height: ${a.tbHeight}px`);
  const al = ALIGN_STYLE[(a.tbAlign as TableAlign) ?? "inline"];
  if (al) parts.push(al);
  if (a.tbBorderStyle) parts.push(`--tb-style: ${a.tbBorderStyle}`);
  if (a.tbBorderWidth) parts.push(`--tb-width: ${a.tbBorderWidth}px`);
  if (a.tbBorderColor) parts.push(`--tb-color: ${a.tbBorderColor}`);
  return parts.join("; ");
}

function findTable(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "table") return { node: $from.node(d), pos: $from.before(d) };
  }
  return null;
}

/** 커서가 있는 표의 DOM 요소 */
export function currentTableEl(editor: Editor): HTMLElement | null {
  const t = findTable(editor);
  if (!t) return null;
  const dom = editor.view.nodeDOM(t.pos) as HTMLElement | null;
  return (dom?.closest?.("table") ?? dom) as HTMLElement | null;
}

/** 표 전체(모든 셀)가 선택된 상태인지 */
function wholeTableSelected(editor: Editor, t: NonNullable<ReturnType<typeof findTable>>) {
  const sel = editor.state.selection;
  if (!(sel instanceof CellSelection)) return false;
  const map = TableMap.get(t.node);
  return sel.ranges.length >= new Set(map.map).size;
}

function selectWholeTable(editor: Editor, t: NonNullable<ReturnType<typeof findTable>>) {
  const map = TableMap.get(t.node);
  const first = t.pos + 1 + map.map[0];
  const last = t.pos + 1 + map.map[map.map.length - 1];
  const { state, view } = editor;
  view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, first, last)));
}

/** 표 전체를 선택한 상태에서 폭·높이를 키우거나 줄인다. */
function resize(editor: Editor, t: NonNullable<ReturnType<typeof findTable>>, dw: number, dh: number) {
  const dom = editor.view.nodeDOM(t.pos) as HTMLElement | null;
  const el = dom?.closest?.("table") ?? dom;
  if (!el) return;
  const maxW = Math.max(MIN_W, (editor.view.dom as HTMLElement).clientWidth - 32);
  const curW = t.node.attrs.tbWidth ?? el.offsetWidth;
  const curH = t.node.attrs.tbHeight ?? el.offsetHeight;
  const next = { ...t.node.attrs };
  if (dw) next.tbWidth = Math.round(Math.min(maxW, Math.max(MIN_W, curW + dw)));
  if (dh) next.tbHeight = Math.round(Math.max(MIN_H, curH + dh));
  if (dw && next.tbAlign === "inline") next.tbAlign = "left";
  const { state, view } = editor;
  const sel = state.selection;
  const tr = state.tr.setNodeMarkup(t.pos, undefined, next);
  if (sel instanceof CellSelection) tr.setSelection(CellSelection.create(tr.doc, sel.$anchorCell.pos, sel.$headCell.pos));
  view.dispatch(tr);
}

export const RichTable = Table.extend({
  priority: 1000,

  addAttributes() {
    return {
      ...this.parent?.(),
      tbWidth: {
        default: null,
        parseHTML: (el: HTMLElement) => px(el, "width"),
        renderHTML: (a: Record<string, unknown>) => (a.tbWidth ? { style: `width: ${a.tbWidth}px` } : {}),
      },
      tbHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => px(el, "height"),
        renderHTML: (a: Record<string, unknown>) => (a.tbHeight ? { style: `height: ${a.tbHeight}px` } : {}),
      },
      tbAlign: {
        default: "inline",
        parseHTML: (el: HTMLElement): TableAlign => {
          const s = el.style;
          if (s.float === "left") return "float-left";
          if (s.float === "right") return "float-right";
          if (s.marginLeft === "auto" && s.marginRight === "auto") return "center";
          if (s.marginLeft === "auto") return "right";
          if (s.marginRight === "auto") return "left";
          return "inline";
        },
        renderHTML: (a: Record<string, unknown>) => {
          const css = ALIGN_STYLE[(a.tbAlign as TableAlign) ?? "inline"];
          return css ? { style: css } : {};
        },
      },
      tbBorderStyle: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.getPropertyValue("--tb-style").trim() || null,
        renderHTML: (a: Record<string, unknown>) => (a.tbBorderStyle ? { style: `--tb-style: ${a.tbBorderStyle}` } : {}),
      },
      tbBorderWidth: {
        default: null,
        parseHTML: (el: HTMLElement) => parseFloat(el.style.getPropertyValue("--tb-width")) || null,
        renderHTML: (a: Record<string, unknown>) => (a.tbBorderWidth ? { style: `--tb-width: ${a.tbBorderWidth}px` } : {}),
      },
      tbBorderColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.getPropertyValue("--tb-color").trim() || null,
        renderHTML: (a: Record<string, unknown>) => (a.tbBorderColor ? { style: `--tb-color: ${a.tbBorderColor}` } : {}),
      },
    };
  },

  // 기본 표 화면(NodeView)은 표 속성 style 을 무시하므로, 편집 화면에서도 속성이 보이도록 직접 그린다.
  addNodeView() {
    return ({ node }) => {
      const table = document.createElement("table");
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);
      const paint = (attrs: Record<string, unknown>) => {
        const css = tableStyle(attrs);
        if (css) table.setAttribute("style", css);
        else table.removeAttribute("style");
      };
      paint(node.attrs);
      return {
        dom: table,
        contentDOM: tbody,
        update: (n) => {
          if (n.type !== node.type) return false;
          paint(n.attrs);
          return true;
        },
      };
    };
  },

  addKeyboardShortcuts() {
    const withTable = (fn: (t: NonNullable<ReturnType<typeof findTable>>) => boolean) => () => {
      const t = findTable(this.editor);
      return t ? fn(t) : false;
    };
    // 전체 선택 상태에서만 Ctrl+방향키로 크기를 바꾼다(그 외에는 평소 동작).
    const whenWhole = (dw: number, dh: number) =>
      withTable((t) => {
        if (!wholeTableSelected(this.editor, t)) return false;
        resize(this.editor, t, dw, dh);
        return true;
      });
    return {
      ...this.parent?.(),
      // 표 안에서 Ctrl+A: 표 전체 선택. 이미 전체 선택이면 문서 전체 선택으로 넘어간다.
      "Mod-a": withTable((t) => {
        if (wholeTableSelected(this.editor, t)) return false;
        selectWholeTable(this.editor, t);
        return true;
      }),
      "Mod-ArrowLeft": whenWhole(-STEP_W, 0),
      "Mod-ArrowRight": whenWhole(STEP_W, 0),
      "Mod-ArrowUp": whenWhole(0, -STEP_H),
      "Mod-ArrowDown": whenWhole(0, STEP_H),
    };
  },
});
