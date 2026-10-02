import Link from "next/link";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type Role } from "@/lib/gantt";

/** Usuario, rol, accesos de administración y cierre de sesión. */
export default function UserMenu({ user, role, current }: { user: string; role: Role; current?: "historial" | "usuarios" }) {
  return (
    <span className="who">
      <span className="em" title={user}>
        {user}
      </span>
      <span className="role" data-r={role}>
        {ROLE_LABEL[role]}
      </span>
      {role === "admin" && current !== "usuarios" && (
        <Link className="out" href="/usuarios">
          Usuarios
        </Link>
      )}
      {role === "admin" && current !== "historial" && (
        <Link className="out" href="/historial">
          Historial
        </Link>
      )}
      <form action={logout}>
        <button className="out" type="submit">
          Cerrar sesión
        </button>
      </form>
    </span>
  );
}
