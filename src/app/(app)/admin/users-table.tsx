"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/stack-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUserRow } from "@/lib/queries/admin";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { changeRole, setDeactivated } from "./actions";

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
              {u.banned ? "Reactivar" : "Desactivar"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
