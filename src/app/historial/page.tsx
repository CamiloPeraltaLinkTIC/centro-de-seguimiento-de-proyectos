import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Band from "@/components/Band";
import UserMenu from "@/components/UserMenu";
import { ROLE_LABEL } from "@/lib/gantt";
import PageHeader from "@/components/PageHeader";
import { getSession } from "@/lib/session";
import { cn, tag, ui } from "@/lib/ui";
import { db } from "@/lib/supabase/server";
import type { HistorialRow, Json } from "@/lib/supabase/types";

export const metadata = { title: "Historial · Centro de seguimiento de proyectos" };

const PAGE = 50;

const ACCIONES: Record<string, { label: string; tipo: string }> = {
  login: { label: "Inicio de sesión", tipo: "login" },
  logout: { label: "Cierre de sesión", tipo: "" },
  login_fallido: { label: "Ingreso fallido", tipo: "fallo" },
  login_bloqueado: { label: "Ingreso bloqueado", tipo: "fallo" },
  actividad_creada: { label: "Actividad creada", tipo: "crea" },
  actividad_editada: { label: "Actividad editada", tipo: "edita" },
  actividad_eliminada: { label: "Actividad eliminada", tipo: "elimina" },
  frente_creado: { label: "Frente creado", tipo: "crea" },
  frente_editado: { label: "Frente editado", tipo: "edita" },
  frente_eliminado: { label: "Frente eliminado", tipo: "elimina" },
  responsable_creado: { label: "Responsable creado", tipo: "crea" },
  responsable_editado: { label: "Responsable editado", tipo: "edita" },
  responsable_eliminado: { label: "Responsable eliminado", tipo: "elimina" },
  usuario_creado: { label: "Usuario creado", tipo: "crea" },
  usuario_editado: { label: "Usuario editado", tipo: "edita" },
  usuario_password: { label: "Contraseña restablecida", tipo: "edita" },
};

const CAMPOS: Record<string, string> = {
  actividad: "Actividad",
  frente: "Frente",
  responsable: "Responsable",
  estado: "Estado",
  avance: "Avance",
  inicio: "Inicio",
  fin: "Fin",
  notas: "Notas",
  num: "ID",
  nombre: "Nombre",
  color: "Color",
  orden: "Orden",
  rol: "Rol",
  activo: "Activo",
  usuario: "Usuario",
};

const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const val = (v: Json | undefined) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Sí" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Muestra los cambios { campo: { antes, despues } } o los datos de un registro creado/eliminado. */
function Detalle({ d }: { d: Json | null }) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const entries = Object.entries(d);
  if (!entries.length) return null;
  return (
    <ul className="m-0 mt-1.5 grid list-none gap-0.5 p-0 text-xs text-muted">
      {entries.map(([k, v]) => {
        const isDiff = v && typeof v === "object" && !Array.isArray(v) && "antes" in v && "despues" in v;
        return (
          <li key={k}>
            <b className="font-bold text-fg">{CAMPOS[k] ?? k}:</b>{" "}
            {isDiff ? (
              <>
                <del className="text-late">{val((v as { antes: Json }).antes)}</del> → <ins className="text-ok no-underline">{val((v as { despues: Json }).despues)}</ins>
              </>
            ) : (
              val(v)
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function HistorialPage({ searchParams }: PageProps<"/historial">) {
  const session = await getSession();
  if (!session) redirect("/sesion/expirada");
  if (session.role !== "admin") notFound();

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const usuario = one(sp.usuario).slice(0, 100);
  const accion = one(sp.accion);
  const page = Math.max(1, Math.min(10_000, parseInt(one(sp.p) || "1", 10) || 1));

  const { data: usuarios } = await db().from("usuarios").select("nombre,rol").order("nombre");
  let q = db()
    .from("historial")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (usuario) q = q.eq("usuario", usuario);
  if (accion && ACCIONES[accion]) q = q.eq("accion", accion);
  const { data, count, error } = await q;
  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  const rows = (data ?? []) as HistorialRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  const link = (p: number) => {
    const u = new URLSearchParams();
    if (usuario) u.set("usuario", usuario);
    if (accion) u.set("accion", accion);
    if (p > 1) u.set("p", String(p));
    const s = u.toString();
    return `/historial${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Band>
        <UserMenu user={session.user} role={session.role} current="historial" />
      </Band>
      <main className={ui.page}>
        <PageHeader
          eyebrow="Administración"
          title="Historial de"
          highlight="cambios"
          sub="Inicios de sesión y todo lo que se crea, edita o elimina en el tablero."
          action={
            <Link className={ui.btn} href="/">
              ← Volver al tablero
            </Link>
          }
        />

        <form className={cn(ui.panel, "flex flex-wrap items-center gap-2.5 p-2.5")} method="get">
          <select className={ui.field} name="usuario" defaultValue={usuario} aria-label="Usuario">
            <option value="">Todos los usuarios</option>
            {(usuarios ?? []).map((u) => (
              <option key={u.nombre} value={u.nombre}>
                {u.nombre} · {ROLE_LABEL[u.rol]}
              </option>
            ))}
          </select>
          <select className={ui.field} name="accion" defaultValue={accion} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {Object.entries(ACCIONES).map(([k, a]) => (
              <option key={k} value={k}>
                {a.label}
              </option>
            ))}
          </select>
          <button className={ui.btnPrimary} type="submit">
            Filtrar
          </button>
          {(usuario || accion) && (
            <Link className={ui.btn} href="/historial">
              Limpiar
            </Link>
          )}
          <span className="flex-1" />
          <span className="font-mono text-xs text-muted">{count ?? 0} registros</span>
        </form>

        <div className={ui.tableWrap}>
          {rows.length ? (
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Fecha</th>
                  <th className={ui.th}>Usuario</th>
                  <th className={ui.th}>Acción</th>
                  <th className={ui.th}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = ACCIONES[r.accion] ?? { label: r.accion, tipo: "" };
                  return (
                    <tr key={r.id}>
                      <td className={ui.tdDate}>{fecha.format(new Date(r.created_at))}</td>
                      <td className={ui.td}>
                        <b className="block font-bold">{r.usuario}</b>
                        <small className="text-xs text-muted">
                          {r.rol ? ROLE_LABEL[r.rol] : "—"}
                          {r.ip ? ` · ${r.ip}` : ""}
                        </small>
                      </td>
                      <td className={ui.td}>
                        <span className={cn(tag.base, tag[(a.tipo || "neutral") as keyof typeof tag])}>
                          {a.label}
                        </span>
                      </td>
                      <td className={ui.td}>
                        {r.resumen}
                        <Detalle d={r.detalle} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className={ui.emptyState}>
              <b className={ui.emptyTitle}>Sin registros</b>
              <span>No hay eventos con estos filtros.</span>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-[13px] text-muted">
            {page > 1 && (
              <Link className={ui.btn} href={link(page - 1)}>
                ← Más recientes
              </Link>
            )}
            <span>
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link className={ui.btn} href={link(page + 1)}>
                Anteriores →
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
