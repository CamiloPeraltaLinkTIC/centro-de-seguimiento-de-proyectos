"use client";

import { useEffect, useRef, useState } from "react";
import { PAL } from "@/lib/gantt";
import { cn, ui } from "@/lib/ui";
import type { Frente, Task } from "@/lib/gantt";

export type FrenteDraft = { key: string; id: string | null; nombre: string; color: string; del: boolean };

type Props = {
  frentes: Frente[];
  tasks: Task[];
  focusNew: boolean;
  onClose: () => void;
  onSave: (draft: FrenteDraft[]) => Promise<boolean>;
};

function Palette({ cur, onPick }: { cur: string; onPick: (c: string) => void }) {
  return (
    <div className="col-span-full flex flex-wrap gap-1.5 pt-1 pb-0.5">
      {PAL.map(([c, n]) => (
        <button
          key={c}
          type="button"
          className="size-6 rounded-md border-2 border-surface p-0 ring-1 ring-line transition aria-pressed:ring-2 aria-pressed:ring-fg"
          style={{ background: c }}
          title={n}
          aria-label={n}
          aria-pressed={c === cur}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

export default function FrentesDrawer({ frentes, tasks, focusNew, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<FrenteDraft[]>(() => frentes.map((f) => ({ key: f.id, id: f.id, nombre: f.nombre, color: f.color, del: false })));
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PAL[frentes.length % PAL.length][0]);
  const [newPal, setNewPal] = useState(false);
  const [openPal, setOpenPal] = useState(-1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusNew) return;
    const t = setTimeout(() => newRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [focusNew]);

  const patch = (i: number, p: Partial<FrenteDraft>) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, k: number) =>
    setDraft((d) => {
      const n = [...d];
      [n[i], n[i + k]] = [n[i + k], n[i]];
      return n;
    });

  function addNew() {
    const n = newName.trim();
    if (!n) return newRef.current?.focus();
    if (draft.some((d) => !d.del && d.nombre.trim().toLowerCase() === n.toLowerCase())) return setMsg("Ya existe un frente con ese nombre.");
    setDraft((d) => [...d, { key: `new-${Date.now()}`, id: null, nombre: n, color: newColor, del: false }]);
    setNewColor(PAL[(draft.length + 1) % PAL.length][0]);
    setNewName("");
    setMsg("");
    newRef.current?.focus();
  }

  async function save() {
    const live = draft.filter((d) => !d.del);
    if (live.some((d) => !d.nombre.trim())) return setMsg("Ningún frente puede quedar sin nombre.");
    const names = live.map((d) => d.nombre.trim().toLowerCase());
    if (new Set(names).size !== names.length) return setMsg("Hay dos frentes con el mismo nombre.");
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) onClose();
    else setMsg("No se pudieron guardar todos los cambios. Revisa y vuelve a guardar.");
  }

  return (
    <aside className={ui.drawer} role="dialog" aria-labelledby="feTitle">
      <div className={ui.dHead}>
        <h2 id="feTitle" className={ui.dTitle}>
          Gestionar <em className="not-italic text-link">frentes</em>
        </h2>
        <button className={ui.dClose} onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className={ui.dBody}>
        <p className="m-0 text-[13px] text-muted">Renombra, cambia el color, reordena o agrega frentes de trabajo. Al renombrar un frente, sus actividades se mueven con él.</p>
        <div className="grid gap-2">
          {draft.length === 0 && <p className="m-0 text-[13px] text-muted">Aún no hay frentes. Agrega el primero abajo.</p>}
          {draft.map((d, i) => {
            const n = d.id ? tasks.filter((t) => t.frente_id === d.id).length : 0;
            return (
              <div className={cn(ui.feRow, "grid-cols-[auto_minmax(0,1fr)_auto_auto]", d.del && "opacity-50 [&_input]:line-through")} key={d.key}>
                <button
                  type="button"
                  className={ui.swatch}
                  style={{ background: d.color }}
                  aria-label="Cambiar color"
                  disabled={d.del}
                  onClick={() => setOpenPal(openPal === i ? -1 : i)}
                />
                <input className={ui.fieldFull} aria-label="Nombre del frente" disabled={d.del} value={d.nombre} onChange={(e) => patch(i, { nombre: e.target.value })} />
                <span className="font-mono text-[11.5px] whitespace-nowrap text-muted">{n} act.</span>
                <span className="flex gap-0.5">
                  <button type="button" className={ui.iconBtn} aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className={ui.iconBtn} aria-label="Bajar" disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className={cn(ui.iconBtn, ui.iconBtnRm)}
                    aria-label={d.del ? "Restaurar" : "Eliminar"}
                    title={n ? "Mueve o elimina sus actividades antes de borrar el frente" : d.del ? "Restaurar" : "Eliminar"}
                    disabled={n > 0}
                    onClick={() => (d.id ? patch(i, { del: !d.del }) : setDraft((x) => x.filter((_, j) => j !== i)))}
                  >
                    {d.del ? "↺" : "✕"}
                  </button>
                </span>
                {openPal === i && (
                  <Palette
                    cur={d.color}
                    onPick={(c) => {
                      patch(i, { color: c });
                      setOpenPal(-1);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border border-dashed border-brand/50 bg-accent-soft p-2.5">
          <button type="button" className={ui.swatch} style={{ background: newColor }} aria-label="Color del nuevo frente" onClick={() => setNewPal(!newPal)} />
          <input
            className={ui.fieldFull}
            ref={newRef}
            placeholder="Nombre del nuevo frente"
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
          {newPal && (
            <Palette
              cur={newColor}
              onPick={(c) => {
                setNewColor(c);
                setNewPal(false);
              }}
            />
          )}
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
