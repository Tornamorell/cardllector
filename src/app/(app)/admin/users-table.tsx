"use client";

import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/stack-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUserRow } from "@/lib/queries/admin";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { changeRole, resetPassword, setDeactivated } from "./actions";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export function UsersTable({ users, meId }: { users: AdminUserRow[]; meId: string }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Cartas</TableHead>
            <TableHead className="text-right">IA hoy</TableHead>
            <TableHead className="text-right">IA, 30 días</TableHead>
            <TableHead className="text-right">Asistente, 30 días</TableHead>
            <TableHead>Última vez</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isMe={u.id === meId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({ user: u, isMe }: { user: AdminUserRow; isMe: boolean }) {
  const [pending, startTransition] = useTransition();
  const role = (ROLES as readonly string[]).includes(u.role ?? "") ? (u.role as Role) : "user";

  function run(action: () => Promise<{ error?: string }>, done: string) {
    startTransition(async () => {
      try {
        const r = await action();
        if (r.error) toast.error(r.error);
        else toast.success(done);
      } catch {
        toast.error("No se ha podido guardar el cambio.");
      }
    });
  }

  return (
    <TableRow className={u.banned ? "opacity-60" : undefined}>
      <TableCell>
        <p className="font-medium">
          {u.name}
          {isMe && <span className="text-muted-foreground font-normal"> (tú)</span>}
        </p>
        <p className="text-muted-foreground text-xs">{u.email}</p>
      </TableCell>
      <TableCell>
        <select
          className={selectClass}
          value={role}
          disabled={isMe || pending}
          aria-label={`Rol de ${u.name}`}
          onChange={(e) => {
            const next = e.target.value as Role;
            run(() => changeRole(u.id, next), `${u.name} ahora es ${ROLE_LABELS[next].toLowerCase()}.`);
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="text-right tabular-nums">{u.copies}</TableCell>
      <TableCell className="text-right tabular-nums">{u.aiToday}</TableCell>
      <TableCell className="text-right tabular-nums">{u.aiCost30d.toFixed(2)} $</TableCell>
      <TableCell className="text-right tabular-nums">{u.chatCost30d.toFixed(2)} $</TableCell>
      <TableCell className="text-muted-foreground text-sm">{date(u.lastSeen)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={u.banned ? "destructive" : "secondary"}>{u.banned ? "Desactivada" : "Activa"}</Badge>
          {!isMe && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                run(
                  () => setDeactivated(u.id, !u.banned),
                  u.banned ? `Cuenta de ${u.name} reactivada.` : `Cuenta de ${u.name} desactivada: se han cerrado sus sesiones.`,
                )
              }
            >
              {pending ? (u.banned ? "Reactivando…" : "Desactivando…") : u.banned ? "Reactivar" : "Desactivar"}
            </Button>
          )}
          {!isMe && <PasswordButton user={u} />}
        </div>
      </TableCell>
    </TableRow>
  );
}

// No look-alikes (0/O, 1/l/I): the password is read out or copied to a colleague.
const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPassword() {
  return Array.from(crypto.getRandomValues(new Uint32Array(14)), (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join("");
}

function PasswordButton({ user: u }: { user: AdminUserRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Contraseña…
      </Button>
      {/* Mounted only while open: a fresh random password each time. */}
      {open && <PasswordDialog user={u} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A new password for a colleague: typed or random, and shown once to pass it on. */
function PasswordDialog({ user: u, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [password, setPassword] = useState(randomPassword);
  const [closeSessions, setCloseSessions] = useState(true);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        const r = await resetPassword(u.id, password, closeSessions);
        if (r.error) toast.error(r.error);
        else setDone(true);
      } catch {
        toast.error("No se ha podido cambiar la contraseña.");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No se ha podido copiar.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{done ? "Contraseña cambiada" : `Nueva contraseña para ${u.name}`}</DialogTitle>
          <DialogDescription>
            {done
              ? `Pásasela a ${u.name}: aquí no se vuelve a mostrar.`
              : "Escribe una o usa esta, de 14 caracteres al azar. Después se la pasas."}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-sm break-all">{password}</code>
            <Button variant="outline" size="sm" onClick={copy}>
              <CopyIcon />
              Copiar
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                autoComplete="off"
                aria-label="Nueva contraseña"
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>
                <RefreshCwIcon />
                Otra
              </Button>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={closeSessions}
                onChange={(e) => setCloseSessions(e.target.checked)}
              />
              Cerrar las sesiones que tenga abiertas
            </label>
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={onClose}>Hecho</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={pending || password.length < 8} aria-busy={pending || undefined}>
                {pending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
