"use client";

import { useEffect, useRef, useState } from "react";
import { DAY, fmt, pd } from "@/lib/gantt";
import { cn, ui } from "@/lib/ui";
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
  const [resp, setResp] = useState(task?.responsable_id ?? "");
  const [nuevoResp, setNuevoResp] = useState("");
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
  const rsRef = useRef<HTMLInputElement>(null);

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

    let respId: string | null = resp || null;
    if (resp === NUEVO) {
      const n = nuevoResp.trim();
      if (!n) {
        setBusy(false);
        setMsg("Escribe el nombre del nuevo responsable.");
        return;
      }
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
    <aside className={ui.drawer} role="dialog" aria-labelledby="dTitle">
      <div className={ui.dHead}>
        <h2 id="dTitle" className={ui.dTitle}>
          {task ? (
            `#${task.num} · ${task.actividad}`
          ) : (
            <>
              Nueva <em className="not-italic text-link">actividad</em>
            </>
          )}
        </h2>
        <button className={ui.dClose} onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <form className={ui.dBody} autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <label className={ui.label}>
          Actividad
          <input className={ui.fieldFull} ref={first} required disabled={ro} value={actividad} onChange={(e) => setActividad(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={ui.label}>
            Frente
            <select
              className={ui.fieldFull}
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
          <label className={ui.label}>
            Responsable
            <select
              className={ui.fieldFull}
              disabled={ro}
              value={resp}
              onChange={(e) => {
                setResp(e.target.value);
                if (e.target.value === NUEVO) setTimeout(() => rsRef.current?.focus(), 0);
              }}
            >
              <option value="">Sin responsable</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
              {canWrite && <option value={NUEVO}>+ Nuevo responsable…</option>}
            </select>
          </label>
        </div>
        {frenteSel === NUEVO && (
          <label className={ui.label}>
            Nombre del nuevo frente
            <input className={ui.fieldFull} ref={frRef} placeholder="Ej. Logística, Pauta digital…" value={nuevoFrente} onChange={(e) => setNuevoFrente(e.target.value)} />
          </label>
        )}
        {resp === NUEVO && (
          <label className={ui.label}>
            Nombre del nuevo responsable
            <input className={ui.fieldFull} ref={rsRef} placeholder="Ej. Ana Gómez - Diseño" value={nuevoResp} onChange={(e) => setNuevoResp(e.target.value)} />
          </label>
        )}
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-muted">
            Estado
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["Pendiente", "aria-pressed:border-todo aria-pressed:bg-todo/15 aria-pressed:text-fg"],
                ["En curso", "aria-pressed:border-run aria-pressed:bg-run/15 aria-pressed:text-run"],
                ["Cerrada", "aria-pressed:border-ok aria-pressed:bg-ok/15 aria-pressed:text-ok"],
              ] as const
            ).map(([v, cls]) => (
              <button key={v} type="button" className={cn("rounded-lg border border-line bg-surface-2 px-1 py-2 text-[12.5px] font-bold text-muted transition enabled:hover:border-brand", cls)} aria-pressed={estado === v} disabled={ro} onClick={() => pickEstado(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <label className={ui.label}>
          Avance
          <div className="flex items-center gap-2.5">
            <input className="flex-1 accent-brand" type="range" min={0} max={100} step={5} disabled={ro} value={avance} onChange={(e) => pickAvance(+e.target.value)} />
            <output className="w-11 text-right font-mono text-fg">{avance}%</output>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={ui.label}>
            Inicio
            <input className={ui.fieldFull} type="date" required disabled={ro} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className={ui.label}>
            Fin
            <input className={ui.fieldFull} type="date" required disabled={ro} value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>
        <label className={ui.label}>
          Notas de seguimiento
          <textarea
            className={ui.fieldFull}
            rows={4}
            disabled={ro}
            placeholder="Bloqueos, acuerdos, próximos pasos…"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
      </form>
      <div className={ui.dFoot}>
        {canWrite && task && (
          <button className={delArmed ? ui.btnDangerArmed : ui.btnDanger} type="button" onClick={del}>
            {delArmed ? "Confirmar eliminación" : "Eliminar"}
          </button>
        )}
        <span className={ui.dMsg}>{msg}</span>
        <button className={ui.btn} type="button" onClick={onClose}>
          Cancelar
        </button>
        {canWrite && (
          <button className={ui.btnPrimary} type="button" onClick={save}>
            Guardar
          </button>
        )}
      </div>
    </aside>
  );
}
