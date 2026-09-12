// Shared card photos (D30): URLs and the card-shaped crop, for both server and browser. The
// canvas functions only run in the browser.

export const CARD_PHOTO_PREFIX = "/api/card-photos/";

/** Versioned so browsers can cache a photo for a year and still see a new one. */
export function cardPhotoUrl(catalogCardId: string, updatedAt: Date) {
  return `${CARD_PHOTO_PREFIX}${catalogCardId}?v=${Math.floor(updatedAt.getTime() / 1000)}`;
}

/** Whether a card's image is a shared photo rather than the catalog source's image. */
export function isCardPhoto(url: string | null | undefined) {
  return !!url?.startsWith(CARD_PHOTO_PREFIX);
}

const WIDTH = 300;
const HEIGHT = 419; // 63×88

type Rect = { x: number; y: number; w: number; h: number };

/** The largest card-shaped (63×88) rectangle in the middle of a picture. */
export function centerCardRect(width: number, height: number): Rect {
  const ratio = 63 / 88;
  if (width / height > ratio) {
    const w = height * ratio;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / ratio;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

/** `rect` of `source` as a 300×419 JPEG: small enough to share every card's photo (~30 KB). */
export function cardPhotoBlob(source: CanvasImageSource, rect: Rect): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.getContext("2d")?.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, WIDTH, HEIGHT);
  return new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.82));
}
