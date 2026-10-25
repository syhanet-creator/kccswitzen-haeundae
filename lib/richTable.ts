import { Table, TableRow } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { Plugin } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

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


type Ctx = { t: NonNullable<ReturnType<typeof findTable>>; map: TableMap; start: number };
type Rect = { left: number; right: number; top: number; bottom: number };

const COL_MIN = 40;
const ROW_MIN = 24;

function tableCtx(editor: Editor): Ctx | null {
  const t = findTable(editor);
  return t ? { t, map: TableMap.get(t.node), start: t.pos + 1 } : null;
}

/** 선택(여러 칸) 또는 커서가 있는 칸이 차지하는 열·행 범위. 칸 하나에 커서만 있어도 그 칸의 열·행이 된다. */
function selectedRect(editor: Editor, c: Ctx): Rect | null {
  const sel = editor.state.selection;
  const positions: number[] = [];
  if (sel instanceof CellSelection) {
    sel.forEachCell((_n, pos) => positions.push(pos));
  } else {
    const { $from } = sel;
    for (let d = $from.depth; d > 0; d--) {
      const name = $from.node(d).type.name;
      if (name === "tableCell" || name === "tableHeader") { positions.push($from.before(d)); break; }
    }
  }
  if (!positions.length) return null;
  const rects = positions.map((pos) => c.map.findCell(pos - c.start));
  return {
    left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

const domOf = (editor: Editor, pos: number) => editor.view.nodeDOM(pos) as HTMLElement | null;

/** 현재 각 열의 너비(px). 한 칸이 여러 열에 걸쳐 있으면 균등 분할로 본다. */
function columnWidths(editor: Editor, c: Ctx): number[] {
  const widths: number[] = new Array(c.map.width).fill(0);
  const seen = new Set<number>();
  for (let r = 0; r < c.map.height; r++) {
    for (let col = 0; col < c.map.width; col++) {
      const rel = c.map.map[r * c.map.width + col];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const rect = c.map.findCell(rel);
      const w = domOf(editor, c.start + rel)?.offsetWidth ?? 0;
      const span = rect.right - rect.left;
      for (let k = rect.left; k < rect.right; k++) if (!widths[k]) widths[k] = w / span;
    }
  }
  return widths.map((w) => Math.max(COL_MIN, Math.round(w)));
}

/** 선택한 열들의 너비를 delta 만큼 바꾼다. 표가 본문 폭을 넘으면 다른 열에서 덜어 온다. */
function resizeColumns(editor: Editor, c: Ctx, rect: Rect, delta: number) {
  const maxW = Math.max(MIN_W, (editor.view.dom as HTMLElement).clientWidth - 32);
  const widths = columnWidths(editor, c);
  const inSel = (i: number) => i >= rect.left && i < rect.right;
  const next = widths.map((w, i) => (inSel(i) ? Math.max(COL_MIN, w + delta) : w));
  let sum = next.reduce((a, b) => a + b, 0);
  if (sum > maxW) {
    const room = next.map((w, i) => (inSel(i) ? 0 : w - COL_MIN));
    const roomTotal = room.reduce((a, b) => a + b, 0);
    let excess = sum - maxW;
    const take = Math.min(excess, roomTotal);
    if (roomTotal > 0) next.forEach((w, i) => { if (!inSel(i)) next[i] = Math.round(w - (take * room[i]) / roomTotal); });
    excess -= take;
    if (excess > 0) { // 더 덜어 올 열이 없으면 선택한 열을 되돌린다
      const selCount = rect.right - rect.left;
      next.forEach((w, i) => { if (inSel(i)) next[i] = Math.max(COL_MIN, w - Math.ceil(excess / selCount)); });
    }
    sum = next.reduce((a, b) => a + b, 0);
  }
  const { state, view } = editor;
  const sel = state.selection;
  const tr = state.tr;
  const done = new Set<number>();
  for (let r = 0; r < c.map.height; r++) {
    for (let col = 0; col < c.map.width; col++) {
      const rel = c.map.map[r * c.map.width + col];
      if (done.has(rel)) continue;
      done.add(rel);
      const cr = c.map.findCell(rel);
      const node = state.doc.nodeAt(c.start + rel);
      if (!node) continue;
      const colwidth = Array.from({ length: cr.right - cr.left }, (_, k) => next[cr.left + k]);
      tr.setNodeMarkup(c.start + rel, undefined, { ...node.attrs, colwidth });
    }
  }
  const a = c.t.node.attrs;
  tr.setNodeMarkup(c.t.pos, undefined, { ...a, tbWidth: sum, tbAlign: a.tbAlign === "inline" ? "left" : a.tbAlign });
  if (sel instanceof CellSelection) tr.setSelection(CellSelection.create(tr.doc, sel.$anchorCell.pos, sel.$headCell.pos));
  view.dispatch(tr);
}

/** 선택한 행들의 높이를 delta 만큼 바꾼다(최소 높이로 동작: 글이 더 크면 글에 맞춰진다). */
function resizeRows(editor: Editor, c: Ctx, rect: Rect, delta: number) {
  const { state, view } = editor;
  const sel = state.selection;
  const tr = state.tr;
  c.t.node.forEach((row, offset, idx) => {
    if (idx < rect.top || idx >= rect.bottom) return;
    const pos = c.t.pos + 1 + offset;
    const cur = domOf(editor, pos)?.offsetHeight ?? 0;
    tr.setNodeMarkup(pos, undefined, { ...row.attrs, tbRowHeight: Math.max(ROW_MIN, Math.round(cur + delta)) });
  });
  tr.setNodeMarkup(c.t.pos, undefined, { ...c.t.node.attrs, tbHeight: null }); // 표 전체 높이 지정은 해제
  if (sel instanceof CellSelection) tr.setSelection(CellSelection.create(tr.doc, sel.$anchorCell.pos, sel.$headCell.pos));
  view.dispatch(tr);
}


/* ───────── 칸 하나만 크기 조절(Alt+방향키) ─────────
 * HTML 표는 한 열의 칸들이 같은 너비를 쓴다. 칸 하나만 다르게 하려면 열·행 경계를 세분하고
 * 칸마다 colspan·rowspan 으로 걸치게 표를 다시 짠다(한글의 셀 크기 조절과 같은 결과).
 * 조절한 칸의 가장자리에 맞닿은 옆 칸이 반대로 줄고 늘어, 표 전체와 다른 칸의 크기는 그대로다.
 */
type Geo = { rel: number; node: PMNode; x0: number; x1: number; y0: number; y1: number };

const TOL = 2;
const near = (a: number, b: number) => Math.abs(a - b) <= TOL;

function measureCells(editor: Editor, c: Ctx): Geo[] | null {
  const out: Geo[] = [];
  const seen = new Set<number>();
  for (const rel of c.map.map) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    const dom = domOf(editor, c.start + rel);
    const node = c.t.node.nodeAt(rel);
    if (!dom || !node) return null;
    out.push({ rel, node, x0: dom.offsetLeft, x1: dom.offsetLeft + dom.offsetWidth, y0: dom.offsetTop, y1: dom.offsetTop + dom.offsetHeight });
  }
  const minX = Math.min(...out.map((g) => g.x0));
  const minY = Math.min(...out.map((g) => g.y0));
  out.forEach((g) => { g.x0 -= minX; g.x1 -= minX; g.y0 -= minY; g.y1 -= minY; });
  return out;
}

/** 허용 오차 안의 좌표를 하나로 합친 경계선 목록 */
function lines(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] > TOL) out.push(v);
  return out;
}
const snap = (ls: number[], v: number) => ls.findIndex((l) => near(l, v));

/** 대상 칸의 가장자리에 맞닿은 칸들. 모두 대상 칸의 범위 안에 들어와야(직사각형 유지) 한다. */
function neighbours(all: Geo[], g: Geo, axis: "x" | "y", side: "after" | "before"): Geo[] | null {
  const [a0, a1, b0, b1] = axis === "x" ? (["x0", "x1", "y0", "y1"] as const) : (["y0", "y1", "x0", "x1"] as const);
  const edge = side === "after" ? g[a1] : g[a0];
  const list = all.filter((n) => n !== g && near(side === "after" ? n[a0] : n[a1], edge) && n[b1] > g[b0] + TOL && n[b0] < g[b1] - TOL);
  if (!list.length) return null;
  if (list.some((n) => n[b0] < g[b0] - TOL || n[b1] > g[b1] + TOL)) return null; // 대상 칸 밖으로 튀어나온 옆 칸
  const covered = list.reduce((sum, n) => sum + (n[b1] - n[b0]), 0);
  return near(covered, g[b1] - g[b0]) ? list : null;
}

/** 칸들이 빈틈·겹침 없이 표를 채우는지 */
function tiles(cells: Geo[], xs: number[], ys: number[]) {
  const grid = new Uint8Array((xs.length - 1) * (ys.length - 1));
  for (const g of cells) {
    for (let y = snap(ys, g.y0); y < snap(ys, g.y1); y++)
      for (let x = snap(xs, g.x0); x < snap(xs, g.x1); x++) {
        if (grid[y * (xs.length - 1) + x]) return false;
        grid[y * (xs.length - 1) + x] = 1;
      }
  }
  return grid.every(Boolean);
}

/** 행이 글 때문에 최소한 차지하는 높이(지정한 높이를 잠시 풀고 잰다). 이보다 낮게는 줄일 수 없다. */
function naturalRowHeight(editor: Editor, pos: number) {
  const tr = domOf(editor, pos);
  const table = tr?.closest("table") as HTMLElement | null;
  if (!tr || !table) return ROW_MIN;
  const saved = [tr.style.height, table.style.height];
  tr.style.height = "";
  table.style.height = "";
  const h = tr.offsetHeight;
  tr.style.height = saved[0];
  table.style.height = saved[1];
  return Math.max(ROW_MIN, Math.round(h));
}

/**
 * 높이: 같은 행의 칸은 높이를 공유하므로 그 칸이 속한 행의 높이를 바꾼다. 다른 행은 그대로 두되,
 * 표 전체 높이를 유지하도록 이웃 행(없으면 위쪽 행들)의 남는 높이를 주고받는다.
 * 줄일 여유가 있는 행이 없으면 그만큼 표 전체가 늘어난다.
 */
function resizeRowWithNeighbour(editor: Editor, c: Ctx, rel: number, delta: number) {
  const rect = c.map.findCell(rel);
  const a = rect.bottom - 1;
  const rows: { pos: number; h: number; nat: number; attrs: Record<string, unknown> }[] = [];
  c.t.node.forEach((row, offset) => {
    const pos = c.t.pos + 1 + offset;
    rows.push({ pos, h: Math.round(domOf(editor, pos)?.offsetHeight ?? ROW_MIN), nat: naturalRowHeight(editor, pos), attrs: row.attrs });
  });
  // 이웃 우선: 바로 아래 행, 그다음 위쪽(가까운 순), 그다음 더 아래
  const order = [...rows.keys()].filter((i) => i !== a).sort((i, j) => {
    const rank = (k: number) => (k === a + 1 ? 0 : k < a ? 1 + (a - k) / 1000 : 2 + (k - a) / 1000);
    return rank(i) - rank(j);
  });
  const next = rows.map((r) => r.h);
  if (delta > 0) {
    next[a] += delta;
    let need = delta;
    for (const i of order) {
      const take = Math.min(need, Math.max(0, next[i] - rows[i].nat));
      next[i] -= take;
      need -= take;
      if (!need) break;
    }
  } else {
    const shrink = Math.min(-delta, Math.max(0, next[a] - rows[a].nat));
    if (!shrink) return;
    next[a] -= shrink;
    if (order.length) next[order[0]] += shrink; // 표 전체 높이 유지
  }
  const { state, view } = editor;
  const sel = state.selection;
  const tr = state.tr;
  rows.forEach((r, i) => {
    if (next[i] !== r.h) tr.setNodeMarkup(r.pos, undefined, { ...r.attrs, tbRowHeight: next[i] });
  });
  tr.setNodeMarkup(c.t.pos, undefined, { ...c.t.node.attrs, tbHeight: null });
  if (sel instanceof CellSelection) tr.setSelection(CellSelection.create(tr.doc, sel.$anchorCell.pos, sel.$headCell.pos));
  view.dispatch(tr);
}

/** kind: 너비 w(칸 하나만) / 높이 h(그 칸의 행), delta>0 이면 키움. 이웃이 반대로 보정해 표 전체 크기는 그대로다. */
function resizeSingleCell(editor: Editor, kind: "w" | "h", delta: number): boolean {
  const c = tableCtx(editor);
  if (!c) return false;
  const sel = editor.state.selection;
  let rel: number | null = null;
  if (sel instanceof CellSelection) {
    const cells: number[] = [];
    sel.forEachCell((_n, pos) => cells.push(pos - c.start));
    if (cells.length !== 1) return true; // 여러 칸 선택 시에는 아무것도 하지 않고 키만 소비한다
    rel = cells[0];
  } else {
    const { $from } = sel;
    for (let d = $from.depth; d > 0; d--) {
      const name = $from.node(d).type.name;
      if (name === "tableCell" || name === "tableHeader") { rel = $from.before(d) - c.start; break; }
    }
  }
  if (rel === null) return false;
  if (kind === "h") { resizeRowWithNeighbour(editor, c, rel, delta); return true; }
  const cells = measureCells(editor, c);
  const g = cells?.find((x) => x.rel === rel);
  if (!cells || !g) return true;

  const axis = kind === "w" ? "x" : "y";
  const [a0, a1] = axis === "x" ? (["x0", "x1"] as const) : (["y0", "y1"] as const);
  const min = kind === "w" ? COL_MIN : ROW_MIN;
  const after = neighbours(cells, g, axis, "after");
  const before = after ? null : neighbours(cells, g, axis, "before");
  const nb = after ?? before;
  if (!nb) return true;
  if (g[a1] - g[a0] + delta < min || nb.some((n) => n[a1] - n[a0] - delta < min)) return true; // 최소 크기 아래로는 안 줄인다

  if (after) { g[a1] += delta; nb.forEach((n) => { n[a0] += delta; }); }
  else { g[a0] -= delta; nb.forEach((n) => { n[a1] -= delta; }); }

  const xs = lines(cells.flatMap((x) => [x.x0, x.x1]));
  const ys = lines(cells.flatMap((x) => [x.y0, x.y1]));
  if (!tiles(cells, xs, ys)) return true;

  // 경계선 구간으로 표를 다시 만든다.
  const colW = xs.slice(1).map((x, i) => Math.max(1, Math.round(x - xs[i])));
  const rowH = ys.slice(1).map((y, i) => Math.max(1, Math.round(y - ys[i])));
  const { state, view } = editor;
  const rowType = state.schema.nodes.tableRow;
  const rowsOut: PMNode[] = [];
  let targetPos = -1;
  let pos = c.t.pos + 1;
  for (let r = 0; r < rowH.length; r++) {
    const inRow = cells.filter((x) => snap(ys, x.y0) === r).sort((a, b) => a.x0 - b.x0);
    const made: PMNode[] = [];
    let cellPos = pos + 1;
    for (const x of inRow) {
      const x0 = snap(xs, x.x0), x1 = snap(xs, x.x1), y1 = snap(ys, x.y1);
      const cell = x.node.type.create({ ...x.node.attrs, colspan: x1 - x0, rowspan: y1 - r, colwidth: colW.slice(x0, x1) }, x.node.content, x.node.marks);
      if (x === g) targetPos = cellPos;
      cellPos += cell.nodeSize;
      made.push(cell);
    }
    const row = rowType.create({ tbRowHeight: rowH[r] }, made);
    pos += row.nodeSize;
    rowsOut.push(row);
  }
  const a = c.t.node.attrs;
  const table = c.t.node.type.create({ ...a, tbWidth: colW.reduce((p, q) => p + q, 0), tbHeight: null, tbAlign: a.tbAlign === "inline" ? "left" : a.tbAlign }, rowsOut);
  const tr = state.tr.replaceWith(c.t.pos, c.t.pos + c.t.node.nodeSize, table);
  if (targetPos >= 0) tr.setSelection(CellSelection.create(tr.doc, targetPos));
  view.dispatch(tr);
  return true;
}

/** Ctrl 키를 다른 키 없이 한 번만 눌렀다 떼면 커서가 있는 칸을 선택한다. */
function ctrlTapSelectsCell(editor: Editor) {
  let alone = false;
  return new Plugin({
    props: {
      handleDOMEvents: {
        keydown: (_view, e) => { alone = e.key === "Control" && !e.repeat; return false; },
        mousedown: () => { alone = false; return false; },
        keyup: (_view, e) => {
          if (e.key !== "Control" || !alone) return false;
          alone = false;
          const sel = editor.state.selection;
          if (sel instanceof CellSelection) return false;
          const { $from } = sel;
          for (let d = $from.depth; d > 0; d--) {
            const name = $from.node(d).type.name;
            if (name === "tableCell" || name === "tableHeader") {
              editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, $from.before(d))));
              return false;
            }
          }
          return false;
        },
      },
    },
  });
}

/**
 * 표 전체를 선택한 상태에서 폭·높이를 키우거나 줄인다.
 * 열 너비·행 높이가 이미 정해져 있으면 그 합이 표 크기의 하한이 되므로, 같은 비율로 함께 늘이고 줄인다.
 */
function resize(editor: Editor, t: NonNullable<ReturnType<typeof findTable>>, dw: number, dh: number) {
  const c = tableCtx(editor);
  if (!c) return;
  const maxW = Math.max(MIN_W, (editor.view.dom as HTMLElement).clientWidth - 32);
  const { state, view } = editor;
  const sel = state.selection;
  const tr = state.tr;

  if (dw) {
    const widths = columnWidths(editor, c);
    const total = widths.reduce((a, b) => a + b, 0);
    const target = Math.round(Math.min(maxW, Math.max(MIN_W, total + dw)));
    const next = widths.map((w) => Math.max(COL_MIN, Math.round((w * target) / total)));
    const done = new Set<number>();
    for (let r = 0; r < c.map.height; r++) {
      for (let col = 0; col < c.map.width; col++) {
        const rel = c.map.map[r * c.map.width + col];
        if (done.has(rel)) continue;
        done.add(rel);
        const cr = c.map.findCell(rel);
        const node = state.doc.nodeAt(c.start + rel);
        if (!node) continue;
        tr.setNodeMarkup(c.start + rel, undefined, { ...node.attrs, colwidth: Array.from({ length: cr.right - cr.left }, (_, k) => next[cr.left + k]) });
      }
    }
    const a = t.node.attrs;
    tr.setNodeMarkup(t.pos, undefined, { ...a, tbWidth: next.reduce((x, y) => x + y, 0), tbAlign: a.tbAlign === "inline" ? "left" : a.tbAlign });
  }

  if (dh) {
    const heights: { pos: number; h: number; attrs: Record<string, unknown> }[] = [];
    t.node.forEach((row, offset) => {
      const pos = t.pos + 1 + offset;
      heights.push({ pos, h: Math.max(ROW_MIN, domOf(editor, pos)?.offsetHeight ?? ROW_MIN), attrs: row.attrs });
    });
    const total = heights.reduce((a, b) => a + b.h, 0);
    const target = Math.max(MIN_H, total + dh);
    heights.forEach(({ pos, h, attrs }) => tr.setNodeMarkup(pos, undefined, { ...attrs, tbRowHeight: Math.max(ROW_MIN, Math.round((h * target) / total)) }));
    tr.setNodeMarkup(t.pos, undefined, { ...tr.doc.nodeAt(t.pos)!.attrs, tbHeight: null });
  }

  if (sel instanceof CellSelection) tr.setSelection(CellSelection.create(tr.doc, sel.$anchorCell.pos, sel.$headCell.pos));
  view.dispatch(tr);
}

/** 행 높이(px)를 저장하는 표 행 */
export const RichTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tbRowHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => px(el, "height"),
        renderHTML: (a: Record<string, unknown>) => (a.tbRowHeight ? { style: `height: ${a.tbRowHeight}px` } : {}),
      },
    };
  },
});

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
      let colgroup: HTMLElement | null = null;
      const paint = (attrs: Record<string, unknown>, tnode: typeof node) => {
        const css = tableStyle(attrs);
        if (css) table.setAttribute("style", css);
        else table.removeAttribute("style");
        // 칸에 저장된 열 너비(colwidth)를 <col> 로 반영한다.
        const map = TableMap.get(tnode);
        const widths: number[] = new Array(map.width).fill(0);
        for (let i = 0; i < map.map.length; i++) {
          const cw = tnode.nodeAt(map.map[i])?.attrs.colwidth as number[] | null | undefined;
          const col = i % map.width;
          const rect = map.findCell(map.map[i]);
          if (cw && cw[col - rect.left]) widths[col] = cw[col - rect.left];
        }
        colgroup?.remove();
        colgroup = null;
        if (widths.some(Boolean)) {
          const cg = document.createElement("colgroup");
          widths.forEach((w) => {
            const col = document.createElement("col");
            if (w) col.style.width = `${w}px`;
            cg.appendChild(col);
          });
          table.insertBefore(cg, tbody);
          colgroup = cg;
        }
      };
      paint(node.attrs, node);
      return {
        dom: table,
        contentDOM: tbody,
        update: (n) => {
          if (n.type !== node.type) return false;
          paint(n.attrs, n);
          return true;
        },
      };
    };
  },

  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), ctrlTapSelectsCell(this.editor)];
  },

  addKeyboardShortcuts() {
    const withTable = (fn: (t: NonNullable<ReturnType<typeof findTable>>) => boolean) => () => {
      const t = findTable(this.editor);
      return t ? fn(t) : false;
    };
    // Ctrl+방향키: 표 전체 선택이면 표 크기, 아니면 커서·선택이 걸친 열(←/→)·행(↑/↓)의 크기를 바꾼다.
    const resizeKey = (dw: number, dh: number) =>
      withTable((t) => {
        if (wholeTableSelected(this.editor, t)) { resize(this.editor, t, dw, dh); return true; }
        const ctx = tableCtx(this.editor);
        const rect = ctx && selectedRect(this.editor, ctx);
        if (!ctx || !rect) return false;
        if (dw) resizeColumns(this.editor, ctx, rect, dw);
        else resizeRows(this.editor, ctx, rect, dh);
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
      // Alt+방향키: 커서가 있는(Ctrl 로 선택한) 칸 하나만 크기를 바꾼다. 옆 칸이 보정해 표 전체 크기는 그대로다.
      "Alt-ArrowRight": () => resizeSingleCell(this.editor, "w", STEP_W),
      "Alt-ArrowLeft": () => resizeSingleCell(this.editor, "w", -STEP_W),
      "Alt-ArrowDown": () => resizeSingleCell(this.editor, "h", STEP_H),
      "Alt-ArrowUp": () => resizeSingleCell(this.editor, "h", -STEP_H),
      "Mod-ArrowLeft": resizeKey(-STEP_W, 0),
      "Mod-ArrowRight": resizeKey(STEP_W, 0),
      "Mod-ArrowUp": resizeKey(0, -STEP_H),
      "Mod-ArrowDown": resizeKey(0, STEP_H),
    };
  },
});
