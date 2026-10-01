"use client";

import { useEffect, useRef, useState } from "react";
import { PAL } from "@/lib/gantt";
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
    <div className="palette">
      {PAL.map(([c, n]) => (
        <button key={c} type="button" style={{ background: c }} title={n} aria-label={n} aria-pressed={c === cur} onClick={() => onPick(c)} />
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
    <aside className="drawer" role="dialog" aria-labelledby="feTitle">
      <div className="d-head">
        <h2 id="feTitle">
          Gestionar <em>frentes</em>
        </h2>
        <button className="x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className="d-body">
        <p className="fe-intro">Renombra, cambia el color, reordena o agrega frentes de trabajo. Al renombrar un frente, sus actividades se mueven con él.</p>
        <div className="fe-list">
          {draft.length === 0 && <p className="none">Aún no hay frentes. Agrega el primero abajo.</p>}
          {draft.map((d, i) => {
            const n = d.id ? tasks.filter((t) => t.frente_id === d.id).length : 0;
            return (
              <div className={`fe-row ${d.del ? "del" : ""}`} key={d.key}>
                <button
                  type="button"
                  className="swatch"
                  style={{ background: d.color }}
                  aria-label="Cambiar color"
                  disabled={d.del}
                  onClick={() => setOpenPal(openPal === i ? -1 : i)}
                />
                <input className="field" aria-label="Nombre del frente" disabled={d.del} value={d.nombre} onChange={(e) => patch(i, { nombre: e.target.value })} />
                <span className="cnt2">{n} act.</span>
                <span className="fe-tools">
                  <button type="button" className="ib" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="ib" aria-label="Bajar" disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ib rm"
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
        <div className="fe-new">
          <button type="button" className="swatch" style={{ background: newColor }} aria-label="Color del nuevo frente" onClick={() => setNewPal(!newPal)} />
          <input
            className="field"
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
          <button type="button" className="btn primary" onClick={addNew}>
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
      <div className="d-foot">
        <span className="msg">{msg}</span>
        <button className="btn" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary" type="button" disabled={busy} onClick={save}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </aside>
  );
}
