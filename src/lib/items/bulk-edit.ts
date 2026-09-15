// Editing several stacks at once from the selection bar (condition, language, finish). Pure:
// what the change does to one stack; the server action applies it and joins identical stacks.
import type { CONDITIONS } from "@/lib/format";

type Finish = "nonfoil" | "foil" | "etched";
type Condition = (typeof CONDITIONS)[number];

export type StackLook = { finish: Finish; condition: Condition; language: string };

/** Only what the user chose to change; the rest stays as each stack has it. */
export type BulkChange = Partial<StackLook>;

/**
 * A stack's condition, language and finish after the change. A finish its printing doesn't come
 * in is left as it was (`finishSkipped`): a foil-only card can't be made non-foil. `finishes`
 * null or empty (a copy without a catalog entry, a football album) means any finish goes, as in
 * FinishSelect.
 */
export function applyBulkChange(
  stack: StackLook,
  finishes: string[] | null,
  change: BulkChange,
): { next: StackLook; finishSkipped: boolean } {
  const finishFits = !change.finish || !finishes?.length || finishes.includes(change.finish);
  return {
    next: {
      finish: change.finish && finishFits ? change.finish : stack.finish,
      condition: change.condition ?? stack.condition,
      language: change.language ?? stack.language,
    },
    finishSkipped: !!change.finish && !finishFits && change.finish !== stack.finish,
  };
}

export const sameLook = (a: StackLook, b: StackLook) =>
  a.finish === b.finish && a.condition === b.condition && a.language === b.language;
