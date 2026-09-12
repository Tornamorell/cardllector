import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cardPhoto } from "@/lib/catalog/photos";

/** A shared card photo (D30), for any signed-in user. The URL is versioned: cached for a year. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/card-photos/[id]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const image = await cardPhoto(id);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
