// Shared card photos (D30): URLs and the card-shaped image, for both server and browser. The
// canvas functions only run in the browser.
import { autoLevels, detectCardQuad, warpCard, type Quad } from "@/lib/scan/card-quad";

export const CARD_PHOTO_PREFIX = "/api/card-photos/";

/** Versioned so browsers can cache a photo for a year and still see a new one. */
export function cardPhotoUrl(catalogCardId: string, updatedAt: Date) {
  return `${CARD_PHOTO_PREFIX}${catalogCardId}?v=${Math.floor(updatedAt.getTime() / 1000)}`;
}

/** Whether a card's image is a shared photo rather than the catalog source's image. */
export function isCardPhoto(url: string | null | undefined) {
  return !!url?.startsWith(CARD_PHOTO_PREFIX);
}

const RATIO = 63 / 88;
const WIDTH = 300;
const HEIGHT = 419; // 63×88
const DETECT_WIDTH = 360; // px the edges are searched at: enough, and fast on a phone
const GUIDE_MARGIN = 0.12; // the card may stick out of the guide: search this much around it

type Rect = { x: number; y: number; w: number; h: number };

/** The largest card-shaped (63×88) rectangle in the middle of a picture. */
export function centerCardRect(width: number, height: number): Rect {
  if (width / height > RATIO) {
    const w = height * RATIO;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / RATIO;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

function sourceSize(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  const { width, height } = source as ImageBitmap; // bitmaps and canvases
  return { w: Number(width), h: Number(height) };
}

/** `r` of `source` on a new canvas `width` px wide. */
function draw(source: CanvasImageSource, r: Rect, width: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round((r.h * canvas.width) / r.w));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  return { canvas, pixels: () => ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

/**
 * The card found in `search`, straightened and trimmed to its edges like a scan, with its
 * brightness evened out (D32), on an outW×outH canvas. If its edges aren't clear, `fallback`
 * as it is: better the plain crop than a wrong one.
 */
function cardImage(source: CanvasImageSource, search: Rect, fallback: Rect, outW: number, outH: number) {
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d")!;
  try {
    const small = draw(source, search, DETECT_WIDTH);
    const quad = detectCardQuad(small.pixels(), small.canvas.width, small.canvas.height);
    if (quad) {
      // Sampled at ~2× the output, not from a possibly 4K frame.
      const big = draw(source, search, Math.min(search.w, outW * 2.5));
      const k = big.canvas.width / small.canvas.width;
      const at = (p: { x: number; y: number }) => ({ x: p.x * k, y: p.y * k });
      const scaled: Quad = { tl: at(quad.tl), tr: at(quad.tr), br: at(quad.br), bl: at(quad.bl) };
      const flat = warpCard(big.pixels(), big.canvas.width, big.canvas.height, scaled, outW, outH);
      ctx.putImageData(new ImageData(autoLevels(flat), outW, outH), 0, 0);
      return out;
    }
  } catch {
    // The plain crop below.
  }
  ctx.drawImage(source, fallback.x, fallback.y, fallback.w, fallback.h, 0, 0, outW, outH);
  return out;
}

const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", quality));

/**
 * The card in the scanner's guide (`guide`, in `source` pixels), `height` px tall. Searched a
 * little beyond the guide, which is only where the card should be. 300×419 is the shared photo
 * (~30 KB); the AI and «Para luego» take it bigger.
 */
export function cardInGuideBlob(source: CanvasImageSource, guide: Rect, height = HEIGHT, quality = 0.82) {
  const { w, h } = sourceSize(source);
  const mx = guide.w * GUIDE_MARGIN;
  const my = guide.h * GUIDE_MARGIN;
  const x = Math.max(0, guide.x - mx);
  const y = Math.max(0, guide.y - my);
  const search = { x, y, w: Math.min(w, guide.x + guide.w + mx) - x, h: Math.min(h, guide.y + guide.h + my) - y };
  const width = height === HEIGHT ? WIDTH : Math.round(height * RATIO);
  return jpeg(cardImage(source, search, guide, width, height), quality);
}

/** The card in a picture of it (camera or gallery), as a 300×419 shared photo. */
export function cardInPictureBlob(source: CanvasImageSource) {
  const { w, h } = sourceSize(source);
  return jpeg(cardImage(source, { x: 0, y: 0, w, h }, centerCardRect(w, h), WIDTH, HEIGHT), 0.82);
}
