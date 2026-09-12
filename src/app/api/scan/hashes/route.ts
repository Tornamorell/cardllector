import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { catalogCardPhotos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { photoHashRows } from "@/lib/queries/scan";
import { photoHash } from "@/lib/scan/photo-hash";

/** Photos without a hash computed per request, so an old backlog doesn't stall the scanner. */
const BACKFILL_PER_REQUEST = 60;

/**
 * The shared photos' hashes, for the scanner to recognise cards by their photo on the device
 * (D33). `?set=sports:megacracks-2526` limits them to one set. Photos saved before hashes
 * existed get theirs here.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [game, code] = (request.nextUrl.searchParams.get("set") ?? "").split(":");
  const rows = await photoHashRows(game && code ? { game, code } : null);

  for (const row of rows.filter((r) => !r.hash).slice(0, BACKFILL_PER_REQUEST)) {
    try {
      const [photo] = await db
        .select({ image: catalogCardPhotos.image })
        .from(catalogCardPhotos)
        .where(eq(catalogCardPhotos.catalogCardId, row.id));
      if (!photo) continue;
      row.hash = await photoHash(photo.image);
      await db.update(catalogCardPhotos).set({ hash: row.hash }).where(eq(catalogCardPhotos.catalogCardId, row.id));
    } catch (error) {
      console.error("[hashes]", row.id, error);
    }
  }
  return NextResponse.json({ hashes: rows.filter((r) => r.hash) });
}
