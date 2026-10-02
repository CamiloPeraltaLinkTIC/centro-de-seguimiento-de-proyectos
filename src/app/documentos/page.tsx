import { redirect } from "next/navigation";
import Band from "@/components/Band";
import PageHeader from "@/components/PageHeader";
import UserMenu from "@/components/UserMenu";
import { getSession } from "@/lib/session";
import { ui } from "@/lib/ui";
import { listarDocumentos } from "./actions";
import DocumentosPanel from "./DocumentosPanel";

export const metadata = { title: "Documentación · Centro de seguimiento de proyectos" };

export default async function DocumentosPage() {
  const s = await getSession();
  if (!s) redirect("/sesion/expirada");
  const r = await listarDocumentos();
  if (!r.ok) throw new Error(r.error);
  const isAdmin = s.role === "admin";

  return (
    <>
      <Band contexto="Documentación">
        <UserMenu user={s.user} role={s.role} current="documentos" />
      </Band>
      <main className={ui.page}>
        <PageHeader
          eyebrow="Proyecto MATERAN"
          title="Documentación del"
          highlight="proyecto"
          sub={isAdmin ? "Sube los documentos del proyecto. El equipo los ve en solo lectura y cada apertura queda registrada." : "Documentos del proyecto en solo lectura. Los nuevos aparecen aquí automáticamente."}
        />
        <DocumentosPanel initial={r.data} isAdmin={isAdmin} />
      </main>
    </>
  );
}
