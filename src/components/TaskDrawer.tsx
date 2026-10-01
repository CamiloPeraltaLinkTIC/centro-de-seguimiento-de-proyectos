"use client";

import { useEffect, useRef, useState } from "react";
import { DAY, fmt, pd } from "@/lib/gantt";
import type { Estado, Frente, Responsable, Task, TaskInput } from "@/lib/gantt";

const NUEVO = "__nuevo__";

type Props = {
  task: Task | null;
  presetFrente: string;
  nextNum: number;
  frentes: Frente[];
  responsables: Responsable[];
  today: number;
  canWrite: boolean;
  onClose: () => void;
  onSave: (id: string | null, body: TaskInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreateFrente: (nombre: string) => Promise<Frente | null>;
  onCreateResponsable: (nombre: string) => Promise<Responsable | null>;
};

export default function TaskDrawer(props: Props) {
  const { task, presetFrente, nextNum, frentes, responsables, today, canWrite, onClose, onSave, onDelete, onCreateFrente, onCreateResponsable } = props;
  const num = task?.num ?? nextNum;

  const [actividad, setActividad] = useState(task?.actividad ?? "");
  const [frente, setFrente] = useState(task?.frente_id ?? (presetFrente || (frentes.length ? "" : NUEVO)));
  const [nuevoFrente, setNuevoFrente] = useState("");
  const [resp, setResp] = useState(() => responsables.find((r) => r.id === task?.responsable_id)?.nombre ?? "");
  const [estado, setEstado] = useState<Estado>(task?.estado ?? "Pendiente");
  const [avance, setAvance] = useState(+(task?.avance ?? 0) || 0);
  const [inicio, setInicio] = useState(task?.inicio ?? fmt(today));
  const [fin, setFin] = useState(task?.fin ?? fmt(today + 4 * DAY));
  const [notas, setNotas] = useState(task?.notas ?? "");
  const [msg, setMsg] = useState("");
  const [delArmed, setDelArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const frRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => first.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const frenteSel = frente || frentes[0]?.id || NUEVO;

  function pickEstado(v: Estado) {
    setEstado(v);
    if (v === "Cerrada") setAvance(100);
    else if (v === "Pendiente" && avance === 100) setAvance(0);
  }
  function pickAvance(v: number) {
    setAvance(v);
    if (v === 100) setEstado("Cerrada");
    else if (v > 0 && estado !== "En curso") setEstado("En curso");
    else if (v < 100 && estado === "Cerrada") setEstado("En curso");
  }

  async function save() {
    const a = actividad.trim();
    const isNewFr = frenteSel === NUEVO;
    const frNombre = nuevoFrente.trim();
    if (!a || (isNewFr && !frNombre) || !inicio || !fin) {
      setMsg(isNewFr && !frNombre ? "Escribe el nombre del nuevo frente." : "Completa actividad, frente y fechas.");
      return;
    }
    if (pd(fin) < pd(inicio)) {
      setMsg("La fecha de fin no puede ser anterior al inicio.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg("");

    let frenteId = frenteSel;
    if (isNewFr) {
      const existing = frentes.find((f) => f.nombre.toLowerCase() === frNombre.toLowerCase());
      const f = existing ?? (await onCreateFrente(frNombre));
      if (!f) {
        setBusy(false);
        setMsg("No se pudo crear el frente.");
        return;
      }
      frenteId = f.id;
    }

    // El responsable se escribe libremente: si no existe en el catálogo, se crea.
    let respId: string | null = null;
    const n = resp.trim();
    if (n) {
      const existing = responsables.find((r) => r.nombre.toLowerCase() === n.toLowerCase());
      const r = existing ?? (await onCreateResponsable(n));
      if (!r) {
        setBusy(false);
        setMsg("No se pudo crear el responsable.");
        return;
      }
      respId = r.id;
    }

    const ok = await onSave(task?.id ?? null, {
      num,
      frente_id: frenteId,
      responsable_id: respId,
      actividad: a,
      estado,
      avance,
      inicio,
      fin,
      notas: notas.trim(),
    });
    setBusy(false);
    if (ok) onClose();
    else setMsg("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
  }

  async function del() {
    if (!task) return;
    if (!delArmed) {
      setDelArmed(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    const ok = await onDelete(task.id);
    setBusy(false);
    if (ok) onClose();
    else setMsg("No se pudo eliminar.");
  }

  const ro = !canWrite;

  return (
    <aside className="drawer" role="dialog" aria-labelledby="dTitle">
      <div className="d-head">
        <h2 id="dTitle">
          {task ? (
            `#${task.num} · ${task.actividad}`
          ) : (
            <>
              Nueva <em>actividad</em>
            </>
          )}
        </h2>
        <button className="x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <form className="d-body" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <label>
          Actividad
          <input className="field" ref={first} required disabled={ro} value={actividad} onChange={(e) => setActividad(e.target.value)} />
        </label>
        <div className="two">
          <label>
            Frente
            <select
              className="field"
              disabled={ro}
              value={frenteSel}
              onChange={(e) => {
                setFrente(e.target.value);
                if (e.target.value === NUEVO) setTimeout(() => frRef.current?.focus(), 0);
              }}
            >
              {frentes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
              {canWrite && <option value={NUEVO}>+ Nuevo frente…</option>}
            </select>
          </label>
          <label>
            Responsable
            <input className="field" list="respList" disabled={ro} value={resp} onChange={(e) => setResp(e.target.value)} />
          </label>
        </div>
        {frenteSel === NUEVO && (
          <label>
            Nombre del nuevo frente
            <input className="field" ref={frRef} placeholder="Ej. Logística, Pauta digital…" value={nuevoFrente} onChange={(e) => setNuevoFrente(e.target.value)} />
          </label>
        )}
        <datalist id="respList">
          {responsables.map((r) => (
            <option key={r.id} value={r.nombre} />
          ))}
        </datalist>
        <div>
          <p className="lbl" style={{ marginBottom: 6 }}>
            Estado
          </p>
          <div className="states">
            {(
              [
                ["Pendiente", "s-Pendiente"],
                ["En curso", "s-En"],
                ["Cerrada", "s-Cerrada"],
              ] as const
            ).map(([v, cls]) => (
              <button key={v} type="button" className={cls} aria-pressed={estado === v} disabled={ro} onClick={() => pickEstado(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <label>
          Avance
          <div className="range">
            <input type="range" min={0} max={100} step={5} disabled={ro} value={avance} onChange={(e) => pickAvance(+e.target.value)} />
            <output>{avance}%</output>
          </div>
        </label>
        <div className="two">
          <label>
            Inicio
            <input className="field" type="date" required disabled={ro} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            Fin
            <input className="field" type="date" required disabled={ro} value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>
        <label>
          Notas de seguimiento
          <textarea
            className="field"
            rows={4}
            disabled={ro}
            placeholder="Bloqueos, acuerdos, próximos pasos…"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
      </form>
      <div className="d-foot">
        {canWrite && task && (
          <button className={`btn danger ${delArmed ? "armed" : ""}`} type="button" onClick={del}>
            {delArmed ? "Confirmar eliminación" : "Eliminar"}
          </button>
        )}
        <span className="msg">{msg}</span>
        <button className="btn" type="button" onClick={onClose}>
          Cancelar
        </button>
        {canWrite && (
          <button className="btn primary" type="button" onClick={save}>
            Guardar
          </button>
        )}
      </div>
    </aside>
  );
}
