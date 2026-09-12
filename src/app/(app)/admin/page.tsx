import type { Metadata } from "next";
import { listUsersForAdmin } from "@/lib/queries/admin";
import { requireAdmin } from "@/lib/session";
import { NewUserForm } from "./new-user-form";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const me = await requireAdmin();
  const users = await listUsersForAdmin();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Quién puede entrar en Cardllector. No hay registro abierto: las cuentas de tus colegas las
          creas aquí. Cada uno ve solo sus cartas, colecciones y ubicaciones; el catálogo y las fotos
          compartidas son de todos. Cada cuenta puede identificar hasta 150 cartas al día con la IA,
          que se paga con tu clave.
        </p>
      </div>
      <NewUserForm />
      <UsersTable users={users} meId={me.id} />
    </div>
  );
}
