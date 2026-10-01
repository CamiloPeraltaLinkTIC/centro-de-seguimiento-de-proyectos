"use client";

import { useState } from "react";
import type { Responsable, Task } from "@/lib/gantt";

export type ResponsableDraft = { key: string; id: string | null; nombre: string; del: boolean };

type Props = {
  responsables: Responsable[];
  tasks: Task[];
  onClose: () => void;
  onSave: (draft: ResponsableDraft[]) => Promise<boolean>;
};

export default function ResponsablesDrawer({ responsables, tasks, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<ResponsableDraft[]>(() => responsables.map((r) => ({ key: r.id, id: r.id, nombre: r.nombre, del: false })));
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = (i: number, p: Partial<ResponsableDraft>) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  function addNew() {
    const n = newName.trim();
    if (!n) return;
    if (draft.some((d) => !d.del && d.nombre.trim().toLowerCase() === n.toLowerCase())) return setMsg("Ya existe un responsable con ese nombre.");
    setDraft((d) => [...d, { key: `new-${Date.now()}`, id: null, nombre: n, del: false }]);
    setNewName("");
    setMsg("");
  }

  async function save() {
    const live = draft.filter((d) => !d.del);
    if (live.some((d) => !d.nombre.trim())) return setMsg("Ningún responsable puede quedar sin nombre.");
    const names = live.map((d) => d.nombre.trim().toLowerCase());
    if (new Set(names).size !== names.length) return setMsg("Hay dos responsables con el mismo nombre.");
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) onClose();
    else setMsg("No se pudieron guardar todos los cambios. Revisa y vuelve a guardar.");
  }

  return (
    <aside className="drawer" role="dialog" aria-labelledby="rsTitle">
      <div className="d-head">
        <h2 id="rsTitle">
          Gestionar <em>responsables</em>
        </h2>
        <button className="x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className="d-body">
        <p className="fe-intro">Corrige nombres o agrega personas y equipos. Al renombrar un responsable, todas sus actividades se actualizan.</p>
        <div className="fe-new rs-new">
          <input
            className="field"
            placeholder="Nombre del nuevo responsable"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNew();
              }
            }}
          />
          <button type="button" className="btn primary" onClick={addNew}>
            Agregar
          </button>
        </div>
        <div className="fe-list">
          {draft.length === 0 && <p className="none">Aún no hay responsables.</p>}
          {draft.map((d, i) => {
            const n = d.id ? tasks.filter((t) => t.responsable_id === d.id).length : 0;
            return (
              <div className={`fe-row rs-row ${d.del ? "del" : ""}`} key={d.key}>
                <input className="field" aria-label="Nombre del responsable" disabled={d.del} value={d.nombre} onChange={(e) => patch(i, { nombre: e.target.value })} />
                <span className="cnt2">{n} act.</span>
                <button
                  type="button"
                  className="ib rm"
                  aria-label={d.del ? "Restaurar" : "Eliminar"}
                  title={n ? "Reasigna sus actividades antes de eliminarlo" : d.del ? "Restaurar" : "Eliminar"}
                  disabled={n > 0}
                  onClick={() => (d.id ? patch(i, { del: !d.del }) : setDraft((x) => x.filter((_, j) => j !== i)))}
                >
                  {d.del ? "↺" : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="d-foot">
        <span className="msg">{msg}</span>
        <button className="btn" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary" type="button" disabled={busy} onClick={save}>
          Guardar cambios
        </button>
      </div>
    </aside>
  );
}
