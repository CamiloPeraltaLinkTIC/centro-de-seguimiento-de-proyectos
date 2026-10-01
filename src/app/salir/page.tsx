import Link from "next/link";
import Band from "@/components/Band";
import { logout } from "../login/actions";

export const metadata = { title: "Cerrar sesión · Centro de seguimiento de proyectos" };

// Cierre de sesión por POST (formulario): evita que un enlace externo cierre la sesión del usuario.
export default function SalirPage() {
  return (
    <>
      <Band />
      <main className="login">
        <form className="login-card" action={logout}>
          <div>
            <h1>
              Cerrar <em>sesión</em>
            </h1>
            <span className="rule" aria-hidden="true" />
            <p className="sub">¿Quieres salir del centro de seguimiento?</p>
          </div>
          <button className="btn primary" type="submit">
            Cerrar sesión
          </button>
          <Link className="btn" href="/" style={{ textAlign: "center", textDecoration: "none", color: "inherit" }}>
            Volver al tablero
          </Link>
        </form>
      </main>
    </>
  );
}
