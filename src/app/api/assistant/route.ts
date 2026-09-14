import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { aiChatMessages, aiChatThreads, aiChatTurns } from "@/db/schema";
import { addUsage, ASSISTANT_MODEL, chatCostUsd, NO_USAGE } from "@/lib/assistant/cost";
import type { ChatEvent } from "@/lib/assistant/events";
import { MAX_TURN_CHARS, titleFrom, toApiMessages } from "@/lib/assistant/history";
import { systemPrompt } from "@/lib/assistant/prompt";
import { assistantTools } from "@/lib/assistant/tools";
import { auth } from "@/lib/auth";
import { assistantAllowance, pageContext, threadHistory, threadOf } from "@/lib/queries/assistant";

// A few lookups and a long answer fit well within this.
export const maxDuration = 120;

/** Model calls per answer: each lookup is one more. */
const MAX_STEPS = 10;

const bodySchema = z.object({
  /** The conversation to go on with; none starts a new one. */
  threadId: z.uuid().nullish(),
  question: z.string().trim().min(1).max(MAX_TURN_CHARS),
  /** The page the user has open, for «este mazo». */
  path: z.string().max(300).nullish(),
});

let client: Anthropic | null = null;
const logError = (what: string) => (error: unknown) => console.error(`[assistant] ${what}`, error);

/**
 * The assistant (D37): a question, in a saved conversation, goes to Claude with read-only tools
 * over the user's data and the page they have open; the answer streams back as NDJSON
 * (ChatEvent) and is saved. Each answer's cost counts against the user's monthly allowance.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "El asistente no está configurado." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { threadId, question, path } = parsed.data;

  const ownerId = session.user.id;
  const { spentUsd, limitUsd } = await assistantAllowance(ownerId);
  if (spentUsd >= limitUsd) {
    return NextResponse.json(
      { error: `Este mes ya has usado los ${limitUsd} $ del asistente. Vuelve a estar disponible el día 1.` },
      { status: 429 },
    );
  }

  // The conversation: one of this user's, or a new one named after its first question.
  const existing = threadId ? await threadOf(ownerId, threadId) : null;
  if (threadId && !existing) return NextResponse.json({ error: "Esa conversación ya no existe." }, { status: 404 });
  const history = existing ? await threadHistory(existing.id) : [];
  const thread =
    existing ??
    (
      await db
        .insert(aiChatThreads)
        .values({ ownerId, title: titleFrom(question) })
        .returning({ id: aiChatThreads.id, title: aiChatThreads.title })
    )[0];
  await db.insert(aiChatMessages).values({ threadId: thread.id, role: "user", content: question });
  // What's on screen goes to the model with the question, not into the saved conversation.
  const context = path ? await pageContext(ownerId, path).catch(() => null) : null;
  const messages = toApiMessages([...history, { role: "user", content: context ? `${context}\n\n${question}` : question }]);

  client ??= new Anthropic();
  const api = client;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser left; the answer is still saved below.
        }
      };
      let written = "";
      const say = (text: string) => {
        written += text;
        send({ type: "text", text });
      };
      send({ type: "thread", id: thread.id, title: thread.title });

      let usage = NO_USAGE;
      let toolCalls = 0;
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
          let separate = written.length > 0;
          for await (const event of step) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              say((separate ? "\n\n" : "") + event.delta.text);
              separate = false;
            }
          }
          const message = await step.finalMessage();
          usage = addUsage(usage, message.usage);
          lastStop = message.stop_reason;
        }
        if (lastStop === "tool_use") {
          say("\n\n_He tenido que parar: necesitaba demasiadas consultas. Prueba con una pregunta más concreta._");
        } else if (!written) {
          say("No tengo una respuesta para eso.");
        }
      } catch (error) {
        if (!request.signal.aborted) {
          logError("answering")(error);
          send({ type: "error", message: "La IA no ha respondido. Prueba otra vez." });
        }
      }

      // Saved even if the browser left halfway: the conversation shows what was answered.
      if (written.trim()) {
        await db
          .insert(aiChatMessages)
          .values({ threadId: thread.id, role: "assistant", content: written })
          .catch(logError("saving the answer"));
      }
      await db
        .update(aiChatThreads)
        .set({ updatedAt: new Date() })
        .where(eq(aiChatThreads.id, thread.id))
        .catch(logError("touching the conversation"));
      const costUsd = chatCostUsd(usage);
      if (usage.input + usage.output + usage.cacheRead + usage.cacheWrite > 0) {
        await db
          .insert(aiChatTurns)
          .values({
            ownerId,
            threadId: thread.id,
            model: ASSISTANT_MODEL,
            inputTokens: usage.input,
            outputTokens: usage.output,
            cacheWriteTokens: usage.cacheWrite,
            cacheReadTokens: usage.cacheRead,
            toolCalls,
            costUsd: costUsd.toFixed(6),
          })
          .catch(logError("recording usage"));
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
