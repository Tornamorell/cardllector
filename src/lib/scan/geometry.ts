/** Magic and Pokémon cards share the 63 × 88 mm format. */
export const CARD_RATIO = 63 / 88;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The largest card-shaped box that fits in `fill` of a frame, centered. */
export function guideRect(frameW: number, frameH: number, fill = 0.86): Rect {
  const h = Math.min(frameH * fill, (frameW * fill) / CARD_RATIO);
  const w = h * CARD_RATIO;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

/** The same, inside an area of the screen (the space between the scanner's bars). */
export function guideIn(area: Rect, fill = 0.92): Rect {
  const g = guideRect(area.w, area.h, fill);
  return { ...g, x: g.x + area.x, y: g.y + area.y };
}

/**
 * Bottom-left info strip (number, set code, language), relative to the card. Slightly larger
 * than the text itself to tolerate imperfect alignment. Measured on Magic 2014+ and Pokémon
 * card scans (docs/scanner.md).
 */
export const INFO_STRIP = { x0: 0.02, x1: 0.5, y0: 0.895, y1: 0.99 };

/** Title line: the fallback when the info strip can't be read. */
export const TITLE_STRIP = { x0: 0.04, x1: 0.76, y0: 0.025, y1: 0.1 };

/**
 * Where an album prints the player's name on the front, for albums with no collector number
 * there (D29), and how to read it: turned upright (degrees clockwise) and inverted when it's
 * light text on a dark band, which Tesseract reads far better as dark on light.
 */
export type NameLayout = {
  strip: { x0: number; x1: number; y0: number; y1: number };
  rotate: 0 | 90 | -90;
  invert: boolean;
};

/**
 * By product line (sets.set_type). Megacracks: the name runs up the right edge, white on a
 * black band (measured on a 2025-26 base card: "LAMINE YAMAL" read at 78 % confidence).
 */
export const NAME_LAYOUTS: Record<string, NameLayout> = {
  megacracks: { strip: { x0: 0.87, x1: 0.945, y0: 0.17, y1: 0.68 }, rotate: 90, invert: true },
};

export function stripRect(card: Rect, strip = INFO_STRIP): Rect {
  return {
    x: card.x + card.w * strip.x0,
    y: card.y + card.h * strip.y0,
    w: card.w * (strip.x1 - strip.x0),
    h: card.h * (strip.y1 - strip.y0),
  };
}

/**
 * How a video frame maps onto an element showing it with `object-fit: cover`: scaled to fill
 * and centered, cropping what overflows.
 */
export function coverTransform(videoW: number, videoH: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / videoW, boxH / videoH);
  return { scale, offX: (boxW - videoW * scale) / 2, offY: (boxH - videoH * scale) / 2 };
}

/** A rectangle on screen (relative to the video element) → video pixels. */
export function toVideo(r: Rect, t: ReturnType<typeof coverTransform>): Rect {
  return { x: (r.x - t.offX) / t.scale, y: (r.y - t.offY) / t.scale, w: r.w / t.scale, h: r.h / t.scale };
}
