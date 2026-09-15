"use client";

import { ChevronsRightIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { advanceSection } from "@/app/(app)/locations/actions";
import { selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import type { SectionOption } from "@/lib/queries/locations";
import { sectionFill } from "@/lib/sections";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";
import { cn } from "@/lib/utils";

// Dividers inside a location (D28).

export { currentSectionId, sectionFill } from "@/lib/sections";

export function SectionPicker({
  value,
  onChange,
  sections,
  allowNone = false,
  id,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  sections: SectionOption[];
  /** Offer "Sin separador" (moving, editing); entry forms always use one. */
  allowNone?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      className={cn(selectClass, className)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Separador"
    >
      {allowNone && <option value="">Sin separador</option>}
      {sections.map((s) => (
        <option key={s.id} value={s.id}>
          Separador {s.name} ({sectionFill(s)})
        </option>
      ))}
    </select>
  );
}

/** «Siguiente separador»: moves the session on to the next divider, creating it if needed. */
export function NextSectionButton({
  locationId,
  sectionId,
  className,
}: {
  locationId: string;
  sectionId: string | null;
  className?: string;
}) {
  const [, setDefaults] = useStickyDefaults();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const next = await advanceSection(locationId, sectionId);
            setDefaults({ lastSectionId: next.id });
            toast.success(`Ahora vas por el separador «${next.name}»`);
          } catch {
            toast.error("No se ha podido pasar al siguiente separador.");
          }
        })
      }
    >
      <ChevronsRightIcon />
      {pending ? "Pasando al siguiente…" : "Siguiente separador"}
    </Button>
  );
}
