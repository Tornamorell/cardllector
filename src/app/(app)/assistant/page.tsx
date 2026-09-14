import type { Metadata } from "next";
import { assistantAllowance } from "@/lib/queries/assistant";
import { requireUser } from "@/lib/session";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Asistente" };

/** Questions to the AI about the user's own cards, collections and decks (D37). */
export default async function AssistantPage() {
  const user = await requireUser();
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY);
  const { spentUsd, limitUsd } = await assistantAllowance(user.id);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Asistente</h1>
      <Chat userId={user.id} enabled={enabled} spentUsd={spentUsd} limitUsd={limitUsd} />
    </div>
  );
}
