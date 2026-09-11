import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pendingScanImage } from "@/lib/queries/pending-scans";

/** The photo of a card waiting for review. Only its owner can see it. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/pending-scans/[id]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const image = await pendingScanImage(session.user.id, id);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      // A photo never changes; it's deleted instead.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
