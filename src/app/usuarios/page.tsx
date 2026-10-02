import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Band from "@/components/Band";
import UserMenu from "@/components/UserMenu";
import PageHeader from "@/components/PageHeader";
import { getSession } from "@/lib/session";
import { ui } from "@/lib/ui";
import { listarUsuarios } from "./actions";
import UsuariosPanel from "./UsuariosPanel";

export const metadata = { title: "Usuarios · Centro de seguimiento de proyectos" };

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/sesion/expirada");
  if (session.role !== "admin") notFound();
  const r = await listarUsuarios();
  if (!r.ok) throw new Error(r.error);

  return (
    <>
      <Band>
        <UserMenu user={session.user} role={session.role} current="usuarios" />
      </Band>
      <main className={ui.page}>
        <PageHeader
          eyebrow="Administración"
          title="Gestión de"
          highlight="usuarios"
          sub="Crea usuarios, asigna su rol, desactívalos o restablece su contraseña. Todo queda en el historial."
          action={
            <Link className={ui.btn} href="/">
              ← Volver al tablero
            </Link>
          }
        />
        <UsuariosPanel initial={r.data} selfId={session.id} />
      </main>
    </>
  );
}
