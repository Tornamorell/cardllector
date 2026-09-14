import type { Metadata } from "next";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { AssistantFull } from "./full";

export const metadata: Metadata = { title: "Asistente" };

/** Questions to the AI about the user's own cards, collections and decks (D37), at full size. */
export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  const user = await requireUser();
  const { thread } = await searchParams;
  const initial = typeof thread === "string" && z.uuid().safeParse(thread).success ? thread : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Asistente</h1>
      <AssistantFull userId={user.id} initialThreadId={initial} />
    </div>
  );
}
