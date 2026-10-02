import { redirect } from "next/navigation";
import Band from "@/components/Band";
import PageHeader from "@/components/PageHeader";
import UserMenu from "@/components/UserMenu";
import { DOC_COLS } from "@/lib/documentos";
import { canEdit, getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import { ui } from "@/lib/ui";
import type { Documento } from "./actions";
import DocumentosPanel from "./DocumentosPanel";

export const metadata = { title: "Documentación · Centro de seguimiento de proyectos" };

export default async function DocumentosPage() {
  const s = await getSession();
  if (!s) redirect("/sesion/expirada");

  const { data, error } = await db().from("documentos").select(DOC_COLS).is("eliminado_at", null).order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los documentos: ${error.message}`);

  // Número de visualizaciones por documento (solo administradores).
  let vistas: Record<string, number> = {};
  if (s.role === "admin") {
    const { data: h } = await db().from("historial").select("entidad_id").eq("accion", "documento_visto");
    vistas = (h ?? []).reduce<Record<string, number>>((acc, r) => {
      if (r.entidad_id) acc[r.entidad_id] = (acc[r.entidad_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <>
      <Band contexto="Documentación">
        <UserMenu user={s.user} role={s.role} current="documentos" />
      </Band>
      <main className={ui.page}>
        <PageHeader eyebrow="Proyecto MATERAN" title="Documentación del" highlight="proyecto" sub="Documentos de solo lectura. Cada apertura queda registrada." />
        <DocumentosPanel initial={(data ?? []) as Documento[]} canUpload={canEdit(s.role)} isAdmin={s.role === "admin"} vistas={vistas} />
      </main>
    </>
  );
}
