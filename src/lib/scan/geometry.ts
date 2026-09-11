/** Magic and Pokémon cards share the 63 × 88 mm format. */
export const CARD_RATIO = 63 / 88;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The on-screen guide the user aligns the card with: the largest card-shaped box that fits in
 * 86% of the frame, centered. Computed in video pixels, so the overlay (drawn in percentages)
 * and the crop match exactly.
 */
export function guideRect(frameW: number, frameH: number, fill = 0.86): Rect {
  const h = Math.min(frameH * fill, (frameW * fill) / CARD_RATIO);
  const w = h * CARD_RATIO;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

/**
 * Bottom-left info strip (number, set code, language), relative to the card. Slightly larger
 * than the text itself to tolerate imperfect alignment. Measured on Magic 2014+ and Pokémon
 * card scans (docs/scanner.md).
 */
export const INFO_STRIP = { x0: 0.02, x1: 0.5, y0: 0.895, y1: 0.99 };

export function stripRect(card: Rect, strip = INFO_STRIP): Rect {
  return {
    x: card.x + card.w * strip.x0,
    y: card.y + card.h * strip.y0,
    w: card.w * (strip.x1 - strip.x0),
    h: card.h * (strip.y1 - strip.y0),
  };
}
