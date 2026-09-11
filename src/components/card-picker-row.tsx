"use client";

import type { CardPicker } from "@/components/card-picker";
import { PrintingSelect } from "@/components/card-picker";
import { CardThumb } from "@/components/card-thumb";

/** The row under a card search once a card is picked: its image, the printing, then controls. */
export function CardPickerRow({ picker, children }: { picker: CardPicker; children: React.ReactNode }) {
  const { printing } = picker;
  if (!printing) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <CardThumb src={printing.imageSmall} alt={printing.name} size="sm" />
      <PrintingSelect picker={picker} />
      {children}
    </div>
  );
}
