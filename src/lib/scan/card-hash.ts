// Perceptual hash of a straightened card image (D33): the same card photographed twice gives
// nearly the same bits; different cards, different bits. Pure, for the browser (the camera
// frame) and the server (the stored photo).

/** Grey levels of the card's inner area (`inset` off each edge), averaged down to n×n cells. */
function greyGrid(rgba: ArrayLike<number>, w: number, h: number, n: number, inset: number): Float64Array {
  const sum = new Float64Array(n * n);
  const count = new Float64Array(n * n);
  const x0 = w * inset;
  const y0 = h * inset;
  const cw = (w * (1 - 2 * inset)) / n;
  const ch = (h * (1 - 2 * inset)) / n;
  for (let y = Math.floor(y0); y < Math.ceil(h - y0); y++) {
    const gy = Math.floor((y + 0.5 - y0) / ch);
    if (gy < 0 || gy >= n) continue;
    for (let x = Math.floor(x0); x < Math.ceil(w - x0); x++) {
      const gx = Math.floor((x + 0.5 - x0) / cw);
      if (gx < 0 || gx >= n) continue;
      const i = (y * w + x) * 4;
      sum[gy * n + gx] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      count[gy * n + gx]++;
    }
  }
  for (let i = 0; i < sum.length; i++) sum[i] = count[i] ? sum[i] / count[i] : 0;
  return sum;
}

/** The k×k lowest frequencies of the 2-D DCT-II of an n×n grid. */
function dctLow(grid: Float64Array, n: number, k: number): Float64Array {
  const cos = new Float64Array(k * n);
  for (let u = 0; u < k; u++) for (let x = 0; x < n; x++) cos[u * n + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
  const rows = new Float64Array(n * k); // rows[y][u]
  for (let y = 0; y < n; y++) {
    for (let u = 0; u < k; u++) {
      let s = 0;
      for (let x = 0; x < n; x++) s += grid[y * n + x] * cos[u * n + x];
      rows[y * k + u] = s;
    }
  }
  const out = new Float64Array(k * k); // out[v][u]
  for (let v = 0; v < k; v++) {
    for (let u = 0; u < k; u++) {
      let s = 0;
      for (let y = 0; y < n; y++) s += rows[y * k + u] * cos[v * n + y];
      out[v * k + u] = s;
    }
  }
  return out;
}

/** A pHash with an n×n grid and k×k frequencies (k² − 1 bits, the average left out), as hex. */
export function hashWith(rgba: ArrayLike<number>, w: number, h: number, n: number, k: number, inset: number): string {
  const coeffs = [...dctLow(greyGrid(rgba, w, h, n, inset), n, k)].slice(1);
  const median = [...coeffs].sort((a, b) => a - b)[Math.floor(coeffs.length / 2)];
  const bytes = new Uint8Array(Math.ceil(coeffs.length / 8));
  coeffs.forEach((c, i) => {
    if (c > median) bytes[i >> 3] |= 1 << (i & 7);
  });
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const POPCOUNT = Uint8Array.from({ length: 256 }, (_, i) => {
  let n = 0;
  for (let b = i; b; b >>= 1) n += b & 1;
  return n;
});

/** Bits that differ between two hashes of the same length. */
export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i += 2) d += POPCOUNT[parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)];
  return d;
}

/**
 * The app's hash: 63 bits from a 32×32 grid, 6 % trimmed off each edge (D33). Measured on four
 * real cards, straightened: the same card photographed again stays within 8 bits; the closest
 * other card was 22 away. Without straightening the same card drifted up to 26: don't hash a
 * plain crop.
 */
export function cardHash(rgba: ArrayLike<number>, w: number, h: number): string {
  return hashWith(rgba, w, h, 32, 8, 0.06);
}

/** Furthest a photo's hash may be from the card's and still count. */
export const MATCH_MAX_BITS = 12;
/** How much closer the best photo must be than the next one. */
export const MATCH_MARGIN_BITS = 6;

/** The card whose photo a hash matches: close enough, and clearly closer than any other. */
export function bestMatch(
  hash: string,
  photos: Iterable<{ id: string; hash: string }>,
): { id: string; distance: number } | null {
  let best: { id: string; distance: number } | null = null;
  let second = Infinity;
  for (const p of photos) {
    if (p.hash.length !== hash.length) continue;
    const distance = hashDistance(hash, p.hash);
    if (!best || distance < best.distance) {
      second = best?.distance ?? Infinity;
      best = { id: p.id, distance };
    } else if (distance < second) {
      second = distance;
    }
  }
  if (!best || best.distance > MATCH_MAX_BITS || second - best.distance < MATCH_MARGIN_BITS) return null;
  return best;
}
