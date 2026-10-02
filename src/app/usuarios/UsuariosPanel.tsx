"use client";

import { useState } from "react";
import { ROLE_LABEL, type Role } from "@/lib/gantt";
import { cn, tag, ui } from "@/lib/ui";
import { actualizarUsuario, crearUsuario, listarUsuarios, restablecerPassword, type UsuarioView } from "./actions";

const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

export default function UsuariosPanel({ initial, selfId }: { initial: UsuarioView[]; selfId: string }) {
  const [users, setUsers] = useState(initial);
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Role>("lector");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [secreto, setSecreto] = useState<{ user: string; password: string } | null>(null);

  async function refrescar() {
    const r = await listarUsuarios();
    if (r.ok) setUsers(r.data);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const r = await crearUsuario({ nombre, rol, password: pass });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setSecreto({ user: nombre.trim(), password: r.data.password });
    setNombre("");
    setPass("");
    setRol("lector");
    refrescar();
  }

  async function cambiar(u: UsuarioView, cambios: { rol?: Role; activo?: boolean }) {
    setMsg("");
    const r = await actualizarUsuario(u.id, cambios);
    if (!r.ok) setMsg(r.error);
    refrescar();
  }

  async function restablecer(u: UsuarioView) {
    setMsg("");
    const r = await restablecerPassword(u.id, "");
    if (!r.ok) return setMsg(r.error);
    setSecreto({ user: u.nombre, password: r.data.password });
  }

  return (
    <>
      {secreto && (
        <div className="edge-gradient grid gap-2 rounded-2xl bg-accent-soft p-4" role="status">
          <p className={ui.eyebrow}>Contraseña de {secreto.user}</p>
          <code className="justify-self-start rounded-lg border border-line bg-surface px-3 py-2 font-mono text-lg select-all">{secreto.password}</code>
          <p className="m-0 text-muted">Cópiala y entrégala por un canal seguro. No se volverá a mostrar.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className={ui.btn} onClick={() => navigator.clipboard?.writeText(secreto.password)}>
              Copiar
            </button>
            <button className={ui.btnPrimary} onClick={() => setSecreto(null)}>
              Listo
            </button>
          </div>
        </div>
      )}

      <form className={cn(ui.panel, "grid gap-3 p-4")} onSubmit={crear} autoComplete="off">
        <p className={ui.eyebrow}>Nuevo usuario</p>
        <div className="grid items-end gap-3 lg:grid-cols-[minmax(160px,1.2fr)_minmax(120px,.8fr)_minmax(180px,1.2fr)_auto]">
          <label className={ui.label}>
            Usuario
            <input className={ui.fieldFull} required maxLength={60} placeholder="nombre.apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className={ui.label}>
            Rol
            <select className={ui.fieldFull} value={rol} onChange={(e) => setRol(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Contraseña <small className="font-normal">(vacía = generar una segura)</small>
            <input className={ui.fieldFull} type="password" autoComplete="new-password" maxLength={200} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button className={ui.btnPrimary} type="submit" disabled={busy}>
            Crear usuario
          </button>
        </div>
      </form>

      {msg && (
        <p className="m-0 font-bold text-late" role="alert">
          {msg}
        </p>
      )}

      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Usuario</th>
              <th className={ui.th}>Rol</th>
              <th className={ui.th}>Estado</th>
              <th className={ui.th}>Último ingreso</th>
              <th className={ui.th} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === selfId;
              return (
                <tr key={u.id} className={cn(!u.activo && "[&>td]:opacity-55")}>
                  <td className={ui.td}>
                    <b className="block font-bold">{u.nombre}</b>
                    <small className="text-xs text-muted">{self ? "Tú" : u.usuario}</small>
                  </td>
                  <td className={ui.td}>
                    <select className={cn(ui.field, "py-[5px]")} value={u.rol} disabled={self} onChange={(e) => cambiar(u, { rol: e.target.value as Role })} aria-label={`Rol de ${u.nombre}`}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={ui.td}>
                    <span className={cn(tag.base, u.activo ? tag.login : tag.fallo)}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className={ui.tdDate}>{u.ultimo_ingreso ? fecha.format(new Date(u.ultimo_ingreso)) : "—"}</td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className={ui.btn} onClick={() => restablecer(u)}>
                        Restablecer contraseña
                      </button>
                      {!self && (
                        <button className={u.activo ? ui.btnDanger : ui.btn} onClick={() => cambiar(u, { activo: !u.activo })}>
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
