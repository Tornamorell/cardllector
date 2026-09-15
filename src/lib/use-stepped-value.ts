import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

/**
 * A count stepped with − and + that the server saves (copies, copies wanted). Each click shows at
 * once, before the server answers, and goes back if saving fails (useOptimistic, as in Next's
 * «interactive apps» guide): a click that shows nothing gets clicked again. Clicks queue — Next
 * runs server actions one at a time — each from the value the previous one left. `pending`: not
 * saved yet, to show the number dimmed.
 */
export function useSteppedValue(
  value: number,
  save: (next: number, delta: number) => Promise<unknown>,
  error = "No se ha podido guardar el cambio.",
) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(value);
  const step = (next: number) => {
    if (next === shown) return;
    const delta = next - shown;
    startTransition(async () => {
      setShown(next);
      try {
        await save(next, delta);
      } catch {
        toast.error(error);
      }
    });
  };
  return { shown, pending, step };
}
