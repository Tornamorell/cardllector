import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrintingsOf } from "@/lib/queries/cards";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Not only UUIDs: Pokémon groups printings by name, "pokemon:charizard ex" (D19).
  const oracleId = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(request.nextUrl.searchParams.get("oracleId"));
  if (!oracleId.success) return NextResponse.json({ error: "Bad oracleId" }, { status: 400 });

  return NextResponse.json(await getPrintingsOf(oracleId.data));
}
