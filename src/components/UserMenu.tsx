import Link from "next/link";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type Role } from "@/lib/gantt";
import { cn, ui } from "@/lib/ui";
import ThemeToggle from "./ThemeToggle";

const ROLE_BADGE: Record<Role, string> = {
  admin: "border-cyan/45 bg-linear-to-r from-brand/25 to-indigo/35 text-white",
  editor: "border-sky/40 bg-sky/10 text-[#bfefff]",
  lector: "border-white/15 bg-white/10 text-[#c0c8de]",
};

const iniciales = (u: string) =>
  u
    .replace(/[^\p{L}]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Usuario, rol, accesos de administración, tema y cierre de sesión. */
export default function UserMenu({ user, role, current }: { user: string; role: Role; current?: "historial" | "usuarios" | "documentos" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="grid size-[30px] place-items-center rounded-full bg-linear-to-r from-brand to-indigo text-[11px] font-bold tracking-wide text-white ring-2 ring-white/15"
        aria-hidden="true"
      >
        {iniciales(user)}
      </span>
      <span className="max-w-[200px] truncate font-bold max-md:hidden" title={user}>
        {user}
      </span>
      <span className={cn("rounded-full border px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[.08em] max-md:hidden", ROLE_BADGE[role])}>{ROLE_LABEL[role]}</span>
      {current !== "documentos" && (
        <Link className={ui.out} href="/documentos">
          Documentos
        </Link>
      )}
      {current && (
        <Link className={ui.out} href="/">
          Tablero
        </Link>
      )}
      {role === "admin" && current !== "usuarios" && (
        <Link className={ui.out} href="/usuarios">
          Usuarios
        </Link>
      )}
      {role === "admin" && current !== "historial" && (
        <Link className={ui.out} href="/historial">
          Historial
        </Link>
      )}
      <ThemeToggle />
      <form action={logout} className="m-0 inline-flex">
        <button className={ui.out} type="submit">
          Cerrar sesión
        </button>
      </form>
    </span>
  );
}
