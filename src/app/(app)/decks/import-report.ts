import { toast } from "sonner";
import type { ImportResult } from "./actions";

/** What an import added, and which lines it couldn't place, so they can be fixed by hand. */
export function reportImport(r: ImportResult) {
  if (r.added) toast.success(`${r.added} ${r.added === 1 ? "carta añadida" : "cartas añadidas"}.`);
  const missed = [...r.unknown, ...r.unreadable];
  if (missed.length) {
    const shown = missed.slice(0, 6).join(", ");
    toast.warning(`No he encontrado ${missed.length === 1 ? "esta carta" : `estas ${missed.length} cartas`}: ${shown}${missed.length > 6 ? "…" : ""}`, {
      duration: 12_000,
    });
  }
}
