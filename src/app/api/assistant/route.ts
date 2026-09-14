import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { aiChatTurns } from "@/db/schema";
import { addUsage, ASSISTANT_MODEL, chatCostUsd, NO_USAGE } from "@/lib/assistant/cost";
import type { ChatEvent } from "@/lib/assistant/events";
import { toApiMessages } from "@/lib/assistant/history";
import { systemPrompt } from "@/lib/assistant/prompt";
import { assistantTools } from "@/lib/assistant/tools";
import { auth } from "@/lib/auth";
import { assistantAllowance } from "@/lib/queries/assistant";

// A few lookups and a long answer fit well within this.
export const maxDuration = 120;

/** Model calls per answer: each lookup is one more. */
const MAX_STEPS = 10;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(50_000) }))
    .min(1)
    .max(200),
});

let client: Anthropic | null = null;

/**
 * The assistant (D37): the conversation so far goes to Claude with read-only tools over the
 * user's data, and the answer streams back as NDJSON (ChatEvent). Each answer's cost is
 * recorded against the user's monthly allowance.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "El asistente no está configurado." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const messages = parsed.success ? toApiMessages(parsed.data.messages) : [];
  if (messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const ownerId = session.user.id;
  const { spentUsd, limitUsd } = await assistantAllowance(ownerId);
  if (spentUsd >= limitUsd) {
    return NextResponse.json(
      { error: `Este mes ya has usado los ${limitUsd} $ del asistente. Vuelve a estar disponible el día 1.` },
      { status: 429 },
    );
  }

  client ??= new Anthropic();
  const api = client;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser left; the answer is still recorded below.
        }
      };
      let usage = NO_USAGE;
      let toolCalls = 0;
      let wrote = false;
      let lastStop: string | null = null;
      try {
        const runner = api.beta.messages.toolRunner(
          {
            model: ASSISTANT_MODEL,
            max_tokens: 16000,
            // The instructions and the tools before them are the same every time: cached.
            system: [{ type: "text", text: systemPrompt(new Date()), cache_control: { type: "ephemeral" } }],
            // And the conversation as it grows: each step re-sends the lookups' results.
            cache_control: { type: "ephemeral" },
            tools: assistantTools(ownerId, (tool) => {
              toolCalls++;
              send({ type: "tool", tool });
            }),
            messages,
            output_config: { effort: "medium" },
            max_iterations: MAX_STEPS,
            stream: true,
          },
          { signal: request.signal },
        );
        for await (const step of runner) {
          // Text before a lookup and text after it are separate paragraphs.
          let separate = wrote;
          for await (const event of step) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "text", text: (separate ? "\n\n" : "") + event.delta.text });
              separate = false;
              wrote = true;
            }
          }
          const message = await step.finalMessage();
          usage = addUsage(usage, message.usage);
          lastStop = message.stop_reason;
        }
        if (lastStop === "tool_use") {
          send({ type: "text", text: "\n\n_He tenido que parar: necesitaba demasiadas consultas. Prueba con una pregunta más concreta._" });
        } else if (!wrote) {
          send({ type: "text", text: "No tengo una respuesta para eso." });
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[assistant]", error);
          send({ type: "error", message: "La IA no ha respondido. Prueba otra vez." });
        }
      }

      const costUsd = chatCostUsd(usage);
      if (usage.input + usage.output + usage.cacheRead + usage.cacheWrite > 0) {
        await db
          .insert(aiChatTurns)
          .values({
            ownerId,
            model: ASSISTANT_MODEL,
            inputTokens: usage.input,
            outputTokens: usage.output,
            cacheWriteTokens: usage.cacheWrite,
            cacheReadTokens: usage.cacheRead,
            toolCalls,
            costUsd: costUsd.toFixed(6),
          })
          .catch((error) => console.error("[assistant] recording usage", error));
      }
      send({ type: "done", costUsd, remainingUsd: Math.max(0, limitUsd - spentUsd - costUsd) });
      try {
        controller.close();
      } catch {
        // Already closed by the browser leaving.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
