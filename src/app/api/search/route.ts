import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { searchCards } from "@/lib/queries/search";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await searchCards(q));
}
