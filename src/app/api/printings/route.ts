import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrintingsOf } from "@/lib/queries/cards";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const oracleId = z.uuid().safeParse(request.nextUrl.searchParams.get("oracleId"));
  if (!oracleId.success) return NextResponse.json({ error: "Bad oracleId" }, { status: 400 });

  return NextResponse.json(await getPrintingsOf(oracleId.data));
}
