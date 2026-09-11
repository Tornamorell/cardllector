import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { searchCards, searchPrintings } from "@/lib/queries/search";
import { parsePrintingQuery } from "@/lib/search/printing-query";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  // "obf 125" names a printing: those go first, then cards by name.
  const printingQuery = parsePrintingQuery(q);
  const [printings, cards] = await Promise.all([
    printingQuery ? searchPrintings(printingQuery) : [],
    searchCards(q),
  ]);
  return NextResponse.json([...printings, ...cards]);
}
