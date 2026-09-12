"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { createColleague } from "./actions";

// No look-alikes (l/1, O/0): the password is read out or copied into a message.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newPassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A colleague's account: name, email, the password you'll give them, and a role. */
export function NewUserForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await createColleague({ name, email, password, role });
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success(`Cuenta creada. Pásale a ${name} su correo y la contraseña.`, { duration: 8000 });
        setName("");
        setEmail("");
        setPassword("");
        setRole("user");
      } catch {
        toast.error("No se ha podido crear la cuenta.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-card space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Crear una cuenta</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-user-name">Nombre</Label>
          <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-user-email">Correo</Label>
          <Input
            id="new-user-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-user-password">Contraseña inicial</Label>
          <div className="flex gap-1.5">
            <Input
              id="new-user-password"
              // Visible on purpose: you give it to them.
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caracteres o más"
              required
              minLength={8}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={() => setPassword(newPassword())}>
              Generar
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-user-role">Rol</Label>
          <select
            id="new-user-role"
            className={`${selectClass} w-full`}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        <UserPlusIcon />
        {pending ? "Creando…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
