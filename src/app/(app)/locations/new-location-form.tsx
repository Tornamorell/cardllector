"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLocation } from "./actions";

export function NewLocationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const location = await createLocation(name);
            setName("");
            router.push(`/locations/${location.id}`);
          } catch {
            toast.error("No se ha podido crear la ubicación.");
          }
        });
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nueva ubicación…"
        required
        maxLength={60}
        aria-label="Nombre de la ubicación"
      />
      <Button type="submit" disabled={pending || !name.trim()}>
        Crear
      </Button>
    </form>
  );
}
