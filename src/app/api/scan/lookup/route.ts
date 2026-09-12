import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { lookupScan } from "@/lib/queries/scan";

const body = z.object({
  line: z.object({
    number: z.string().min(1).max(8),
    total: z.string().max(8).nullable(),
    setCodes: z.array(z.string().max(8)).max(8),
    lang: z.string().max(3).nullable(),
  }),
  fixedSet: z.object({ game: z.enum(["mtg", "pokemon", "sports"]), code: z.string().max(20) }).nullish(),
});

/** Validates a parsed OCR read against the catalog. Called a few times per second. */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const matches = await lookupScan(parsed.data.line, parsed.data.fixedSet);
  return NextResponse.json({ matches });
}
