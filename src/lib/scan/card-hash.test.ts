import { describe, expect, it } from "vitest";
import { bestMatch, cardHash, hashDistance, MATCH_MAX_BITS } from "./card-hash";

const W = 300;
const H = 419;

/** A card-sized RGBA image painted by `paint(u, v)` (0–1 across and down). */
function image(paint: (u: number, v: number) => [number, number, number]) {
  const img = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) img.set([...paint((x + 0.5) / W, (y + 0.5) / H), 255], (y * W + x) * 4);
  }
  return img;
}

/** A card design: diagonal stripes, and a "player" (a blob) at (cx, cy). */
const card = (cx: number, cy: number, stripes: number) => (u: number, v: number): [number, number, number] => {
  const player = Math.hypot(u - cx, (v - cy) * 0.7) < 0.18;
  if (player) return [230, 220, 210];
  return Math.floor((u + v) * stripes) % 2 ? [60, 30, 120] : [120, 80, 180];
};

/** The same card photographed again: dimmer, noisy, and 1 % off. */
const retaken = (paint: (u: number, v: number) => [number, number, number]) => {
  let seed = 3;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 24;
  return (u: number, v: number) => paint(u + 0.01, v - 0.008).map((c) => c * 0.85 + noise()) as [number, number, number];
};

describe("cardHash", () => {
  const a = card(0.35, 0.4, 8);
  const b = card(0.65, 0.6, 11);

  it("is 63 bits as 16 hex digits", () => {
    expect(cardHash(image(a), W, H)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("barely changes for the same card photographed again", () => {
    const d = hashDistance(cardHash(image(a), W, H), cardHash(image(retaken(a)), W, H));
    expect(d).toBeLessThanOrEqual(8);
  });

  it("differs a lot between different cards", () => {
    expect(hashDistance(cardHash(image(a), W, H), cardHash(image(b), W, H))).toBeGreaterThan(MATCH_MAX_BITS + 6);
  });
});

describe("bestMatch", () => {
  // 16 hex digits; flip(n) is `base` with n bits set.
  const base = "0000000000000000";
  const flip = (n: number) =>
    Array.from({ length: 8 }, (_, i) => Math.max(0, Math.min(8, n - i * 8)))
      .map((bits) => ((1 << bits) - 1).toString(16).padStart(2, "0"))
      .join("");

  it("picks the photo within reach", () => {
    expect(bestMatch(base, [
      { id: "far", hash: flip(30) },
      { id: "near", hash: flip(3) },
    ])).toEqual({ id: "near", distance: 3 });
  });

  it("rejects a photo too far away", () => {
    expect(bestMatch(base, [{ id: "far", hash: flip(MATCH_MAX_BITS + 1) }])).toBeNull();
  });

  it("rejects a tie between two cards", () => {
    expect(bestMatch(base, [
      { id: "a", hash: flip(4) },
      { id: "b", hash: flip(7) },
    ])).toBeNull();
  });

  it("ignores hashes of another length", () => {
    expect(bestMatch(base, [{ id: "old", hash: "00" }])).toBeNull();
  });
});
