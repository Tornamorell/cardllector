// Server only: the hash of a stored card photo (D33), decoded at the size the scanner hashes the
// camera's card at.
import sharp from "sharp";
import { cardHash } from "./card-hash";

export async function photoHash(jpeg: Buffer): Promise<string> {
  const { data, info } = await sharp(jpeg)
    .resize(300, 419, { fit: "fill" })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return cardHash(data, info.width, info.height);
}
