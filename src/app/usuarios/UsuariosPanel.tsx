"use client";

import { useState } from "react";
import { ROLE_LABEL, type Role } from "@/lib/gantt";
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
        <div className="panel u-secret" role="status">
          <p className="lbl">Contraseña de {secreto.user}</p>
          <code>{secreto.password}</code>
          <p className="sub">Cópiala y entrégala por un canal seguro. No se volverá a mostrar.</p>
          <div className="u-actions">
            <button className="btn" onClick={() => navigator.clipboard?.writeText(secreto.password)}>
              Copiar
            </button>
            <button className="btn primary" onClick={() => setSecreto(null)}>
              Listo
            </button>
          </div>
        </div>
      )}

      <form className="panel u-new" onSubmit={crear} autoComplete="off">
        <p className="lbl">Nuevo usuario</p>
        <div className="u-grid">
          <label>
            Usuario
            <input className="field" required maxLength={60} placeholder="nombre.apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>
            Rol
            <select className="field" value={rol} onChange={(e) => setRol(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contraseña <small>(vacía = generar una segura)</small>
            <input className="field" type="password" autoComplete="new-password" maxLength={200} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            Crear usuario
          </button>
        </div>
      </form>

      {msg && (
        <p className="u-msg" role="alert">
          {msg}
        </p>
      )}

      <div className="h-wrap">
        <table className="h-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último ingreso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === selfId;
              return (
                <tr key={u.id} className={u.activo ? "" : "u-off"}>
                  <td className="u">
                    <b>{u.nombre}</b>
                    <small>{self ? "Tú" : u.usuario}</small>
                  </td>
                  <td>
                    <select className="field" value={u.rol} disabled={self} onChange={(e) => cambiar(u, { rol: e.target.value as Role })} aria-label={`Rol de ${u.nombre}`}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="acc" data-t={u.activo ? "login" : "fallo"}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="f">{u.ultimo_ingreso ? fecha.format(new Date(u.ultimo_ingreso)) : "—"}</td>
                  <td>
                    <div className="u-actions">
                      <button className="btn" onClick={() => restablecer(u)}>
                        Restablecer contraseña
                      </button>
                      {!self && (
                        <button className={`btn ${u.activo ? "danger" : ""}`} onClick={() => cambiar(u, { activo: !u.activo })}>
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
