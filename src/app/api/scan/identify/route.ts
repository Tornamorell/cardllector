import { and, count, eq, gt, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { aiIdentifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { identifyContext, lookupReading } from "@/lib/queries/scan";
import { readCard } from "@/lib/scan/identify";
import { IDENTIFY_MODEL, identifyCostUsd } from "@/lib/scan/reading";

const MAX_IMAGE_BYTES = 400_000;
/** Identifications per user in 24 hours: at ~0,003 $ each, 150 is under 0,50 $ a day (D31). */
const DAILY_LIMIT = Number(process.env.AI_IDENTIFY_DAILY_LIMIT) || 150;

const fixedSetSchema = z
  .object({ game: z.enum(["mtg", "pokemon", "sports"]), code: z.string().max(40) })
  .nullable();

/**
 * «Identificar con IA» (D31): a JPEG of the card in the scanner's guide goes to Claude, and its
 * reading is matched against the catalog. Form fields: `image`, `fixedSet` (JSON or "null").
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La identificación con IA no está configurada." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File) || image.type !== "image/jpeg" || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Foto no válida." }, { status: 400 });
  }
  let fixedSet: z.infer<typeof fixedSetSchema>;
  try {
    fixedSet = fixedSetSchema.parse(JSON.parse(String(form?.get("fixedSet") ?? "null")));
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const ownerId = session.user.id;
  const [{ n }] = await db
    .select({ n: count() })
    .from(aiIdentifications)
    .where(
      and(eq(aiIdentifications.ownerId, ownerId), gt(aiIdentifications.createdAt, sql`now() - interval '1 day'`)),
    );
  if (n >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Has llegado al límite de ${DAILY_LIMIT} identificaciones en 24 horas.` },
      { status: 429 },
    );
  }

  let result: Awaited<ReturnType<typeof readCard>>;
  try {
    result = await readCard(Buffer.from(await image.arrayBuffer()), await identifyContext(fixedSet));
  } catch (error) {
    console.error("[identify]", error);
    return NextResponse.json({ error: "La IA no ha respondido. Prueba otra vez." }, { status: 502 });
  }

  const { reading, usage } = result;
  const matches = reading?.isCard ? await lookupReading(reading, fixedSet) : [];
  await db.insert(aiIdentifications).values({
    ownerId,
    model: IDENTIFY_MODEL,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    costUsd: identifyCostUsd(usage).toFixed(6),
    reading,
    matches: matches.length,
  });
  return NextResponse.json({ reading, matches, remaining: DAILY_LIMIT - n - 1 });
}
