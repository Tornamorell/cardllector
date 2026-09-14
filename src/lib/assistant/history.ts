// The assistant's conversations (D37): saved in the database (ai_chat_messages), the text of
// each turn only. The tools' results aren't kept; the model looks things up again if needed.

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Turns sent to the model: the recent ones are what a follow-up question refers to. */
export const MAX_TURNS = 20;
/** Characters per turn: a pasted deck list fits; a runaway answer is cut. */
export const MAX_TURN_CHARS = 8000;
const MAX_TITLE = 80;

/**
 * The turns as the API wants them: no empty ones, the same speaker's consecutive turns joined,
 * the last MAX_TURNS, starting with the user's.
 */
export function toApiMessages(turns: ChatTurn[], maxTurns = MAX_TURNS): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const content = t.content.trim().slice(0, MAX_TURN_CHARS);
    if (!content) continue;
    const last = out.at(-1);
    if (last?.role === t.role) last.content += `\n\n${content}`;
    else out.push({ role: t.role, content });
  }
  const recent = out.slice(-maxTurns);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}

/** A conversation's name: its first question, on one line and shortened. */
export function titleFrom(question: string): string {
  const line = question.replace(/\s+/g, " ").trim();
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1).trimEnd()}…` : line || "Conversación";
}
