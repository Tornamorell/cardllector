import type { Metadata } from "next";
import { cardPhotoUrl } from "@/lib/card-photo";
import { listPhotosForReview, listUsersForAdmin } from "@/lib/queries/admin";
import { requireAdmin } from "@/lib/session";
import { NewUserForm } from "./new-user-form";
import { PhotoReview } from "./photo-review";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const me = await requireAdmin();
  const [users, photos] = await Promise.all([listUsersForAdmin(), listPhotosForReview()]);
  const toReview = photos.filter((p) => !p.reviewedAt).length;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Quién puede entrar en Tapmat. No hay registro abierto: las cuentas de tus colegas las
          creas aquí. Cada uno ve solo sus cartas, colecciones y ubicaciones; el catálogo y las fotos
          compartidas son de todos. Cada cuenta puede identificar hasta 150 cartas al día con la IA,
          que se paga con tu clave.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cuentas</h2>
        <NewUserForm />
        <UsersTable users={users} meId={me.id} />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            Fotos compartidas
            {toReview > 0 && <span className="text-primary font-normal"> · {toReview} por revisar</span>}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Las que sube la gente para las cartas sin imagen, al escanear o desde la ficha: las ven
            todos. Marca como correctas las que estén bien. Si una no es la carta o se ve mal,
            elimínala y la carta vuelve a quedarse sin imagen. Si alguien la cambia, vuelve a estar
            por revisar.
          </p>
        </div>
        <PhotoReview
          photos={photos.map((p) => ({
            catalogCardId: p.catalogCardId,
            name: p.name,
            setLabel: `${p.setCode.toUpperCase()} #${p.number}`,
            src: cardPhotoUrl(p.catalogCardId, p.updatedAt),
            contributor: p.contributor,
            source: p.source,
            dateLabel: p.updatedAt.toLocaleDateString("es-ES"),
            reviewed: !!p.reviewedAt,
            reviewer: p.reviewer,
          }))}
        />
      </section>
    </div>
  );
}
