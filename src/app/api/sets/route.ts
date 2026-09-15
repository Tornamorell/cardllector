import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { setOptions } from "@/lib/queries/catalog";

/**
 * Every set with cards, for pickers that load them only when opened — adding a whole set to a
 * collection. ~1,200 sets are too many to send with every collection page.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ sets: await setOptions() }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
