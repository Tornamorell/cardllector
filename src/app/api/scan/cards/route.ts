import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { lookupIds } from "@/lib/queries/scan";

const body = z.object({ ids: z.array(z.uuid()).min(1).max(24) });

/** Cards by id: the scanner recognised one by its photo on the device and needs its details (D33). */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  return NextResponse.json({ matches: await lookupIds(parsed.data.ids) });
}
