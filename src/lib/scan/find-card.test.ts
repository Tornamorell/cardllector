import { describe, expect, it } from "vitest";
import { applyHomography, homography, type Pt, type Quad } from "./card-quad";
import { findCard, quadBounds, quadsAgree } from "./find-card";

type Rgb = [number, number, number];
// The scanner's view between its bars, at the width it searches at.
const W = 360;
const H = 600;

/** A card-shaped quad `width` px wide, centred on (cx, cy), turned `deg` clockwise. */
function cardAt(cx: number, cy: number, width: number, deg = 0): Pt[] {
  const t = (deg * Math.PI) / 180;
  const hw = width / 2;
  const hh = width / (63 / 88) / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: cx + x * Math.cos(t) - y * Math.sin(t), y: cy + x * Math.sin(t) + y * Math.cos(t) }));
}

/** A printed design: white border, a gold inner frame, diagonal purple stripes. */
function design(u: number, v: number): Rgb {
  if (u < 0.03 || u > 0.97 || v < 0.02 || v > 0.98) return [235, 235, 230];
  if (Math.abs(u - 0.08) < 0.01 || Math.abs(u - 0.92) < 0.01 || Math.abs(v - 0.06) < 0.008) return [200, 160, 60];
  return Math.floor((u + v) * 12) % 2 ? [90, 40, 140] : [150, 90, 200];
}

/** A frame: `ground(x, y)` with some noise, and the card at `corners` if any. */
function frame(ground: (x: number, y: number) => Rgb, corners?: Pt[]): Uint8ClampedArray {
  const toCard = corners && homography(corners, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  let seed = 11;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 24;
  const img = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise();
      const uv = toCard && applyHomography(toCard, { x: x + 0.5, y: y + 0.5 });
      const inside = uv && uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1;
      const rgb = inside ? design(uv.x, uv.y) : (ground(x, y).map((c) => c + n) as Rgb);
      img.set([...rgb, 255], (y * W + x) * 4);
    }
  }
  return img;
}

const table = (): Rgb => [120, 85, 55];

/**
 * A card slinger from above: light walls, and the box's darker, shadowed floor. The floor is
 * a strong, nearly card-shaped rectangle, bigger than the card.
 */
const slinger = (x: number, y: number): Rgb =>
  x > 50 && x < 310 && y > 150 && y < 530 ? [140, 125, 100] : [205, 190, 160];

function worstError(q: Quad | undefined, corners: Pt[]) {
  expect(q).toBeDefined();
  const got = [q!.tl, q!.tr, q!.br, q!.bl];
  return Math.max(...got.map((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y)));
}

describe("findCard", () => {
  it("finds a small, turned card off-centre on a table", () => {
    const corners = cardAt(210, 280, 150, 6);
    const found = findCard(frame(table, corners), W, H);
    expect(worstError(found?.quad, corners)).toBeLessThan(5);
  });

  it("finds the card down a card slinger, not the box it lies in", () => {
    const corners = cardAt(180, 345, 160);
    const found = findCard(frame(slinger, corners), W, H);
    expect(worstError(found?.quad, corners)).toBeLessThan(5);
  });

  it("finds the card filling most of the frame, not its inner frame", () => {
    const corners = cardAt(180, 300, 320, -3);
    const found = findCard(frame(table, corners), W, H);
    expect(worstError(found?.quad, corners)).toBeLessThan(5);
  });

  it("finds nothing on an empty table", () => {
    expect(findCard(frame(table), W, H)).toBeNull();
  });
});

describe("quadBounds and quadsAgree", () => {
  const [tl, tr, br, bl] = cardAt(100, 200, 100, 10);
  const quad = { tl, tr, br, bl };

  it("boxes a turned quad", () => {
    const box = quadBounds(quad);
    expect(box.x).toBeCloseTo(bl.x);
    expect(box.y).toBeCloseTo(tl.y);
    expect(box.x + box.w).toBeCloseTo(tr.x);
    expect(box.y + box.h).toBeCloseTo(br.y);
  });

  it("agrees on the same card a few pixels away, not on a moved one", () => {
    const shift = (d: number) => ({
      tl: { x: tl.x + d, y: tl.y },
      tr: { x: tr.x + d, y: tr.y },
      br: { x: br.x + d, y: br.y },
      bl: { x: bl.x + d, y: bl.y },
    });
    expect(quadsAgree(quad, shift(3))).toBe(true);
    expect(quadsAgree(quad, shift(20))).toBe(false);
  });
});
