"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { aiChatThreads } from "@/db/schema";
import { assistantAllowance, getThread, listThreads } from "@/lib/queries/assistant";
import { requireUser } from "@/lib/session";

// The assistant's conversations (D37), for the floating chat and /assistant. Questions go
// through /api/assistant, which streams.

/** Whether the assistant is set up, and this month's spend against the allowance. */
export async function assistantStatus() {
  const user = await requireUser();
  return { enabled: Boolean(process.env.ANTHROPIC_API_KEY), ...(await assistantAllowance(user.id)) };
}

export async function assistantThreads() {
  const user = await requireUser();
  return listThreads(user.id);
}

/** A conversation of the user's, with its messages; null if it's gone or isn't theirs. */
export async function assistantThread(id: string) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(id);
  return parsed.success ? getThread(user.id, parsed.data) : null;
}

export async function deleteAssistantThread(id: string) {
  const user = await requireUser();
  await db
    .delete(aiChatThreads)
    .where(and(eq(aiChatThreads.id, z.uuid().parse(id)), eq(aiChatThreads.ownerId, user.id)));
}
