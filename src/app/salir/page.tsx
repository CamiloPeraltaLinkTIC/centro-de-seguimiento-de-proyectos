import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { ui } from "@/lib/ui";
import { logout } from "../login/actions";

export const metadata = { title: "Cerrar sesión · Centro de seguimiento de proyectos" };

// Cierre de sesión por POST (formulario): evita que un enlace externo cierre la sesión del usuario.
export default function SalirPage() {
  return (
    <AuthCard>
      <form className="grid gap-4" action={logout}>
        <div className="grid gap-2">
          <h1 className="m-0 font-display text-[28px] leading-tight font-semibold tracking-[-.03em]">
            Cerrar <em className="text-gradient-title not-italic">sesión</em>
          </h1>
          <p className="m-0 text-muted">¿Quieres salir del centro de seguimiento?</p>
        </div>
        <button className={`${ui.btnPrimary} py-2.5 text-sm`} type="submit">
          Cerrar sesión
        </button>
        <Link className={`${ui.btn} py-2.5 text-sm`} href="/">
          Volver al tablero
        </Link>
      </form>
    </AuthCard>
  );
}
