"use client";

import { useState } from "react";
import { cn, ui } from "@/lib/ui";
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
    <aside className={ui.drawer} role="dialog" aria-labelledby="rsTitle">
      <div className={ui.dHead}>
        <h2 id="rsTitle" className={ui.dTitle}>
          Gestionar <em className="not-italic text-link">responsables</em>
        </h2>
        <button className={ui.dClose} onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className={ui.dBody}>
        <p className="m-0 text-[13px] text-muted">Corrige nombres o agrega personas y equipos. Al renombrar un responsable, todas sus actividades se actualizan.</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border border-dashed border-brand/50 bg-accent-soft p-2.5">
          <input
            className={ui.fieldFull}
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
          <button type="button" className={ui.btnPrimary} onClick={addNew}>
            Agregar
          </button>
        </div>
        <div className="grid gap-2">
          {draft.length === 0 && <p className="m-0 text-[13px] text-muted">Aún no hay responsables.</p>}
          {draft.map((d, i) => {
            const n = d.id ? tasks.filter((t) => t.responsable_id === d.id).length : 0;
            return (
              <div className={cn(ui.feRow, "grid-cols-[minmax(0,1fr)_auto_auto]", d.del && "opacity-50 [&_input]:line-through")} key={d.key}>
                <input className={ui.fieldFull} aria-label="Nombre del responsable" disabled={d.del} value={d.nombre} onChange={(e) => patch(i, { nombre: e.target.value })} />
                <span className="font-mono text-[11.5px] whitespace-nowrap text-muted">{n} act.</span>
                <button
                  type="button"
                  className={cn(ui.iconBtn, ui.iconBtnRm)}
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
      <div className={ui.dFoot}>
        <span className={ui.dMsg}>{msg}</span>
        <button className={ui.btn} type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className={ui.btnPrimary} type="button" disabled={busy} onClick={save}>
          Guardar cambios
        </button>
      </div>
    </aside>
  );
}
