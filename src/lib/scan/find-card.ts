// Finds a card anywhere in the scanner's frame (D36): on a table, on a mat, down a card
// slinger's box — not only when it fills a crop, which is what detectCardQuad needs. Pure, like
// card-quad.ts: RGBA in, the card's corners out.
//
// Straight lines (near-vertical and near-horizontal, by a Hough transform) → every card-shaped
// quad that four of them make → scored by how strong its four sides are, measured on the sides
// themselves, and by how little each line goes on past the card's corners.
import { blurRgb, gradients, meet, type Line, type Pt, type Quad } from "./card-quad";
import type { Rect } from "./geometry";

const CARD_RATIO = 63 / 88;
const SLOPES = 21; // tilts tried, from −MAX_SLOPE to MAX_SLOPE
const MAX_SLOPE = 0.25; // ~14°: the card stands roughly upright in the frame
const EDGE_MIN = 100; // weakest gradient that counts (sum of the three Sobel channels)
const LINES = 30; // strongest lines kept per direction
const MIN_SPAN = 0.15; // of the frame: a narrower or shorter quad is not the card
const MIN_AREA = 0.06; // of the frame: smaller is a logo or a text box
const RATIO_TOLERANCE = 0.09;
const RATIO_SIGMA = 0.07; // perspective stretches 63:88 a little; much further is not a card
const PARALLEL_SIGMA = 0.1; // slope between opposite sides: perspective splays them a little
const EXT_WEIGHT = 0.8; // how much a line going on past the corners counts against a side
const REACH = 0.05; // of the card's width: how far out its outline may be from the edge found
const SIDE_SAMPLES = 32;
const EXT_SAMPLES = 12; // past each end

/**
 * The strongest near-vertical (or near-horizontal) lines: Hough votes weighted by gradient.
 * Lines are binned by where they cross the middle of the image, not by their intercept at its
 * edge, so that tilted copies of one line land in neighbouring bins and get suppressed together.
 */
function houghLines(g: Float32Array, w: number, h: number, vertical: boolean): Line[] {
  const span = vertical ? w : h; // where it crosses the middle: its bin
  const mid = (vertical ? h : w) / 2;
  const acc = new Float32Array(SLOPES * span);
  const slopes = Array.from({ length: SLOPES }, (_, i) => -MAX_SLOPE + (2 * MAX_SLOPE * i) / (SLOPES - 1));
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const m = g[y * w + x];
      if (m < EDGE_MIN) continue;
      const u = vertical ? y : x; // along the line
      const v = vertical ? x : y; // across it
      for (let i = 0; i < SLOPES; i++) {
        const c = Math.round(v - slopes[i] * (u - mid));
        if (c >= 0 && c < span) acc[i * span + c] += m;
      }
    }
  }
  const lines: Line[] = [];
  while (lines.length < LINES) {
    let best = 0;
    let bi = -1;
    for (let k = 0; k < acc.length; k++) {
      if (acc[k] > best) {
        best = acc[k];
        bi = k;
      }
    }
    if (bi < 0) break;
    const i = Math.floor(bi / span);
    const c = bi % span;
    lines.push({ a: slopes[i], b: c - slopes[i] * mid });
    for (let di = -3; di <= 3; di++) {
      const ii = i + di;
      if (ii < 0 || ii >= SLOPES) continue;
      for (let dc = -5; dc <= 5; dc++) {
        const cc = c + dc;
        if (cc >= 0 && cc < span) acc[ii * span + cc] = 0;
      }
    }
  }
  return lines;
}

const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
const samples = new Float32Array(Math.max(SIDE_SAMPLES, 2 * EXT_SAMPLES));

/** The gradient across a line at (x, y): the most of 3 px across it; 0 off the image. */
function edgeAt(g: Float32Array, w: number, h: number, x: number, y: number, vertical: boolean) {
  let m = 0;
  for (let d = -1; d <= 1; d++) {
    const xx = vertical ? x + d : x;
    const yy = vertical ? y : y + d;
    if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
    const v = g[yy * w + xx];
    if (v > m) m = v;
  }
  return m;
}

/** The median of the first `n` samples: a glare spot or a finger doesn't sink a whole side. */
function median(n: number) {
  return samples.subarray(0, n).sort()[n >> 1];
}

/** How strong an edge is along a side, from 12 % to 88 % of it (the corners are rounded). */
function sideStrength(g: Float32Array, w: number, h: number, p: Pt, q: Pt, vertical: boolean) {
  for (let i = 0; i < SIDE_SAMPLES; i++) {
    const t = 0.12 + (0.76 * i) / (SIDE_SAMPLES - 1);
    samples[i] = edgeAt(g, w, h, Math.round(p.x + (q.x - p.x) * t), Math.round(p.y + (q.y - p.y) * t), vertical);
  }
  return median(SIDE_SAMPLES);
}

/**
 * How strong the same line still is past the side's corners (8–35 % of its length beyond each
 * end). A card's edge ends at its corners; a wall, a mat's edge or the photo's own border goes
 * on. Off the image counts as no edge.
 */
function extensionStrength(g: Float32Array, w: number, h: number, p: Pt, q: Pt, vertical: boolean) {
  let k = 0;
  for (const [from, to] of [
    [-0.35, -0.08],
    [1.08, 1.35],
  ]) {
    for (let i = 0; i < EXT_SAMPLES; i++) {
      const t = from + ((to - from) * i) / (EXT_SAMPLES - 1);
      samples[k++] = edgeAt(g, w, h, Math.round(p.x + (q.x - p.x) * t), Math.round(p.y + (q.y - p.y) * t), vertical);
    }
  }
  return median(k);
}

type Sides = Record<"L" | "R" | "T" | "B", Line>;
type Gradients = ReturnType<typeof gradients>;

const quadOf = (s: Sides): Quad => ({ tl: meet(s.L, s.T), tr: meet(s.R, s.T), br: meet(s.R, s.B), bl: meet(s.L, s.B) });

function strengthOf(g: Gradients, w: number, h: number, s: Sides, side: keyof Sides) {
  const q = quadOf(s);
  if (side === "T") return sideStrength(g.gy, w, h, q.tl, q.tr, false);
  if (side === "B") return sideStrength(g.gy, w, h, q.bl, q.br, false);
  if (side === "L") return sideStrength(g.gx, w, h, q.tl, q.bl, true);
  return sideStrength(g.gx, w, h, q.tr, q.br, true);
}

/**
 * A card's border has two edges a few pixels apart: the card's outline and, inside it, the
 * design's, often the stronger of the two (and too close for both to be kept as lines). Moves
 * each side out to the outermost edge within `reach` px that's at least half as strong: the card
 * ends there.
 */
function reachOut(g: Gradients, w: number, h: number, sides: Sides, reach: number): Quad {
  const s: Sides = { ...sides };
  for (const [side, dir] of [
    ["L", -1],
    ["R", 1],
    ["T", -1],
    ["B", 1],
  ] as const) {
    const line = s[side];
    const moved = (d: number) => ({ a: line.a, b: line.b + dir * d });
    const values: number[] = [];
    for (let d = 0; d <= reach + 1; d++) values.push(strengthOf(g, w, h, { ...s, [side]: moved(d) }, side));
    let pick = 0;
    for (let d = 1; d <= reach; d++) {
      if (values[d] >= 0.5 * values[0] && values[d] >= values[d - 1] && values[d] >= values[d + 1]) pick = d;
    }
    s[side] = moved(pick);
  }
  return quadOf(s);
}

export type FoundCard = { quad: Quad; score: number };

/** The upright box around a quad: what the scanner reads, as it would the guide. */
export function quadBounds(q: Quad): Rect {
  const xs = [q.tl.x, q.tr.x, q.br.x, q.bl.x];
  const ys = [q.tl.y, q.tr.y, q.br.y, q.bl.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Whether two quads are the same card in about the same place: each corner within `tolerance` of its width. */
export function quadsAgree(a: Quad, b: Quad, tolerance = 0.05): boolean {
  const limit = tolerance * dist(a.tl, a.tr);
  return (["tl", "tr", "br", "bl"] as const).every((k) => dist(a[k], b[k]) <= limit);
}

/**
 * The card in an RGBA frame: the card-shaped quad (63×88 give or take perspective, at least 6 %
 * of the frame) whose four sides are strongest, or null if there's none. Search at ~360 px wide.
 */
export function findCard(rgba: ArrayLike<number>, w: number, h: number): FoundCard | null {
  const g = gradients(blurRgb(rgba, w, h), w, h);
  const vs = houghLines(g.gx, w, h, true);
  const hs = houghLines(g.gy, w, h, false);
  const nv = vs.length;
  const nh = hs.length;
  const corners: Pt[] = [];
  for (const v of vs) for (const hl of hs) corners.push(meet(v, hl));
  const at = (v: number, hl: number) => corners[v * nh + hl];

  // A side is one line cut by two others, and the same side recurs in many quads: measure it once.
  const memo = (n: number) => new Float32Array(n).fill(-1);
  const hRaw = memo(nh * nv * nv);
  const hExt = memo(nh * nv * nv);
  const vRaw = memo(nv * nh * nh);
  const vExt = memo(nv * nh * nh);
  const hSide = (m: Float32Array, f: typeof sideStrength, hl: number, a: number, b: number) => {
    const k = (hl * nv + a) * nv + b;
    if (m[k] < 0) m[k] = f(g.gy, w, h, at(a, hl), at(b, hl), false);
    return m[k];
  };
  const vSide = (m: Float32Array, f: typeof sideStrength, v: number, a: number, b: number) => {
    const k = (v * nh + a) * nh + b;
    if (m[k] < 0) m[k] = f(g.gx, w, h, at(v, a), at(v, b), true);
    return m[k];
  };

  const midX = (l: Line) => l.a * (h / 2) + l.b;
  const midY = (l: Line) => l.a * (w / 2) + l.b;
  let best: FoundCard | null = null;
  let bestSides: Sides | null = null;
  for (let L = 0; L < nv; L++) {
    for (let R = 0; R < nv; R++) {
      if (midX(vs[R]) - midX(vs[L]) < MIN_SPAN * w) continue;
      for (let T = 0; T < nh; T++) {
        for (let B = 0; B < nh; B++) {
          if (midY(hs[B]) - midY(hs[T]) < MIN_SPAN * h) continue;
          const quad = { tl: at(L, T), tr: at(R, T), br: at(R, B), bl: at(L, B) };
          if ([quad.tl, quad.tr, quad.br, quad.bl].some((c) => c.x < -2 || c.y < -2 || c.x > w + 2 || c.y > h + 2)) {
            continue;
          }
          const width = (dist(quad.tl, quad.tr) + dist(quad.bl, quad.br)) / 2;
          const height = (dist(quad.tl, quad.bl) + dist(quad.tr, quad.br)) / 2;
          const ratio = width / height;
          if (Math.abs(ratio - CARD_RATIO) > RATIO_TOLERANCE || width * height < MIN_AREA * w * h) continue;

          const raw = [
            hSide(hRaw, sideStrength, T, L, R),
            vSide(vRaw, sideStrength, R, T, B),
            hSide(hRaw, sideStrength, B, L, R),
            vSide(vRaw, sideStrength, L, T, B),
          ];
          const mean = (raw[0] + raw[1] + raw[2] + raw[3]) / 4;
          if (mean < EDGE_MIN || Math.min(...raw) < 0.35 * mean) continue;
          const ext = [
            hSide(hExt, extensionStrength, T, L, R),
            vSide(vExt, extensionStrength, R, T, B),
            hSide(hExt, extensionStrength, B, L, R),
            vSide(vExt, extensionStrength, L, T, B),
          ];
          // Geometric mean: one weak side (a wall standing in for the card's edge) drags it down.
          let logs = 0;
          for (let i = 0; i < 4; i++) logs += Math.log(Math.max(1, raw[i] - EXT_WEIGHT * ext[i]));
          // A card's opposite sides are parallel, give or take perspective: a line slanting
          // across its top edge and the design's edges under it isn't its top.
          const splay = (vs[L].a - vs[R].a) ** 2 + (hs[T].a - hs[B].a) ** 2;
          const shape = Math.exp(
            -0.5 * ((ratio - CARD_RATIO) / RATIO_SIGMA) ** 2 - (0.5 * splay) / PARALLEL_SIGMA ** 2,
          );
          const score = shape * Math.exp(logs / 4);
          if (!best || score > best.score) {
            best = { quad, score };
            bestSides = { L: vs[L], R: vs[R], T: hs[T], B: hs[B] };
          }
        }
      }
    }
  }
  if (!best || !bestSides) return null;
  const reach = Math.max(2, Math.round(REACH * dist(best.quad.tl, best.quad.tr)));
  return { quad: reachOut(g, w, h, bestSides, reach), score: best.score };
}
