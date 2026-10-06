import { calcGridItemPosition } from "react-grid-layout/build/calculateUtils";

/*
  react-grid-layout is patched (patches/react-grid-layout+1.5.3.patch) so that
  calcGridItemPosition rounds each tile's edges rather than its left and width
  independently. Unpatched, round(colWidth * x) + round(colWidth * w) can miss
  round(colWidth * (x + w)) by a pixel, so adjacent tiles show a 1px gap or a
  1px overlap that depends on the window width.
*/

// Mirrors DashboardLayout: 100 columns, no margin, no padding, square rows.
const params = (containerWidth, overrides = {}) => ({
  margin: [0, 0],
  containerPadding: [0, 0],
  containerWidth,
  cols: 100,
  rowHeight: containerWidth / 100,
  maxRows: Infinity,
  ...overrides,
});

const widths = [];
for (let width = 1200; width <= 2000; width += 7) widths.push(width);
widths.push(1545);

const spans = [
  [0, 32],
  [32, 32],
  [64, 32],
  [96, 4],
];

describe("react-grid-layout edge rounding", () => {
  it.each(widths)("tiles columns with no gap or overlap at %ipx", (width) => {
    const p = params(width);
    let previousRight = 0;
    for (const [x, w] of spans) {
      const { left, width: px } = calcGridItemPosition(p, x, 0, w, 1);
      expect(left).toBe(previousRight);
      previousRight = left + px;
    }
    expect(previousRight).toBe(width);
  });

  it.each(widths)("tiles rows with no gap or overlap at %ipx", (width) => {
    const p = params(width);
    let previousBottom = 0;
    for (const [y, h] of spans) {
      const { top, height } = calcGridItemPosition(p, 0, y, 1, h);
      expect(top).toBe(previousBottom);
      previousBottom = top + height;
    }
    expect(previousBottom).toBe(Math.round(p.rowHeight * 100));
  });

  it("reproduces the reported 1545px case", () => {
    const p = params(1545);
    const middle = calcGridItemPosition(p, 32, 0, 32, 1);
    const right = calcGridItemPosition(p, 64, 0, 32, 1);
    expect(middle.left + middle.width).toBe(right.left);
  });

  it("keeps margins between tiles and padding around the grid", () => {
    for (const width of widths) {
      const p = params(width, {
        margin: [10, 6],
        containerPadding: [5, 3],
        rowHeight: 17.3,
      });
      const a = calcGridItemPosition(p, 0, 0, 32, 32);
      const b = calcGridItemPosition(p, 32, 32, 32, 32);
      expect(a.left).toBe(5);
      expect(a.top).toBe(3);
      expect(b.left - (a.left + a.width)).toBe(10);
      expect(b.top - (a.top + a.height)).toBe(6);
    }
  });

  it("leaves dragging and resizing pixel values untouched", () => {
    const p = params(1545);
    expect(
      calcGridItemPosition(p, 32, 0, 32, 1, {
        dragging: { top: 10.4, left: 20.6 },
      }),
    ).toMatchObject({ top: 10, left: 21 });
    expect(
      calcGridItemPosition(p, 32, 0, 32, 1, {
        resizing: { width: 100.6, height: 50.2 },
      }),
    ).toMatchObject({ width: 101, height: 50 });
  });
});
