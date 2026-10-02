import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Band from "@/components/Band";
import UserMenu from "@/components/UserMenu";
import { ROLE_LABEL } from "@/lib/gantt";
import { getSession } from "@/lib/session";
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
    <ul className="chg">
      {entries.map(([k, v]) => {
        const isDiff = v && typeof v === "object" && !Array.isArray(v) && "antes" in v && "despues" in v;
        return (
          <li key={k}>
            <b>{CAMPOS[k] ?? k}:</b>{" "}
            {isDiff ? (
              <>
                <del>{val((v as { antes: Json }).antes)}</del> → <ins>{val((v as { despues: Json }).despues)}</ins>
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
      <main className="wrap">
        <div className="head">
          <div>
            <h1>
              Historial de <em>cambios</em>
            </h1>
            <span className="rule" aria-hidden="true" />
            <p className="sub">Inicios de sesión y todo lo que se crea, edita o elimina en el tablero.</p>
          </div>
          <Link className="btn" href="/">
            ← Volver al tablero
          </Link>
        </div>

        <form className="h-filters" method="get">
          <select className="field" name="usuario" defaultValue={usuario} aria-label="Usuario">
            <option value="">Todos los usuarios</option>
            {(usuarios ?? []).map((u) => (
              <option key={u.nombre} value={u.nombre}>
                {u.nombre} · {ROLE_LABEL[u.rol]}
              </option>
            ))}
          </select>
          <select className="field" name="accion" defaultValue={accion} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {Object.entries(ACCIONES).map(([k, a]) => (
              <option key={k} value={k}>
                {a.label}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit">
            Filtrar
          </button>
          {(usuario || accion) && (
            <Link className="btn" href="/historial">
              Limpiar
            </Link>
          )}
          <span className="spacer" />
          <span className="num">{count ?? 0} registros</span>
        </form>

        <div className="h-wrap">
          {rows.length ? (
            <table className="h-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = ACCIONES[r.accion] ?? { label: r.accion, tipo: "" };
                  return (
                    <tr key={r.id}>
                      <td className="f">{fecha.format(new Date(r.created_at))}</td>
                      <td className="u">
                        <b>{r.usuario}</b>
                        <small>
                          {r.rol ? ROLE_LABEL[r.rol] : "—"}
                          {r.ip ? ` · ${r.ip}` : ""}
                        </small>
                      </td>
                      <td>
                        <span className="acc" data-t={a.tipo}>
                          {a.label}
                        </span>
                      </td>
                      <td>
                        {r.resumen}
                        <Detalle d={r.detalle} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <b>Sin registros</b>
              <span>No hay eventos con estos filtros.</span>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="h-pager">
            {page > 1 && (
              <Link className="btn" href={link(page - 1)}>
                ← Más recientes
              </Link>
            )}
            <span>
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link className="btn" href={link(page + 1)}>
                Anteriores →
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
