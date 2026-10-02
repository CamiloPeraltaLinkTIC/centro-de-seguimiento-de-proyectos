import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Band from "@/components/Band";
import UserMenu from "@/components/UserMenu";
import { getSession } from "@/lib/session";
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
      <main className="wrap">
        <div className="head">
          <div>
            <h1>
              Gestión de <em>usuarios</em>
            </h1>
            <span className="rule" aria-hidden="true" />
            <p className="sub">Crea usuarios, asigna su rol, desactívalos o restablece su contraseña. Todo queda en el historial.</p>
          </div>
          <Link className="btn" href="/">
            ← Volver al tablero
          </Link>
        </div>
        <UsuariosPanel initial={r.data} selfId={session.id} />
      </main>
    </>
  );
}
