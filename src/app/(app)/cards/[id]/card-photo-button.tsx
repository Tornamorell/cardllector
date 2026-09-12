"use client";

import { CameraIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cardPhotoBlob, centerCardRect } from "@/lib/card-photo";
import { saveCardPhoto } from "../photo-actions";

/**
 * «Añadir foto» / «Cambiar foto» for a card without a catalog image: camera or gallery, cropped
 * to a card's shape from the middle of the picture, and shared with everyone (D30).
 */
export function CardPhotoButton({ catalogCardId, hasPhoto }: { catalogCardId: string; hasPhoto: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const blob = await cardPhotoBlob(bitmap, centerCardRect(bitmap.width, bitmap.height));
        if (!blob) throw new Error("No photo");
        const form = new FormData();
        form.set("image", blob, "carta.jpg");
        form.set("catalogCardId", catalogCardId);
        form.set("source", "upload");
        const r = await saveCardPhoto(form);
        if (r.saved) {
          toast.success("Foto guardada: la verán todos los que tengan esta carta.");
          router.refresh();
        } else {
          toast.error("Esta carta ya tiene la imagen del catálogo.");
        }
      } catch {
        toast.error("No se ha podido guardar la foto.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => inputRef.current?.click()}
      >
        <CameraIcon />
        {pending ? "Guardando…" : hasPhoto ? "Cambiar foto" : "Añadir foto"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
