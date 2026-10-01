"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { DAY, dur, fmt, human, isLate, pd, PAL, sortFrentes, sortResponsables, TASK_COLS, todayUTC, weighted } from "@/lib/gantt";
import type { Frente, Responsable, Role, Task, TaskInput } from "@/lib/gantt";
import { createClient } from "@/lib/supabase/client";
import Band from "./Band";
import FrentesDrawer, { type FrenteDraft } from "./FrentesDrawer";
import Gantt, { type GanttHandle } from "./Gantt";
import ResponsablesDrawer, { type ResponsableDraft } from "./ResponsablesDrawer";
import TaskDrawer from "./TaskDrawer";

type Props = { email: string; role: Role; initialFrentes: Frente[]; initialResponsables: Responsable[]; initialTasks: Task[] };
type Sync = { s: "idle" | "live" | "saving" | "error"; txt: string };
export type Filters = { estado: string; frente: string; resp: string; q: string };

export default function Dashboard({ email, role, initialFrentes, initialResponsables, initialTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canWrite = role === "admin";
  const TODAY = useMemo(() => todayUTC(), []);

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [frentesRaw, setFrentes] = useState<Frente[]>(initialFrentes);
  const [respRaw, setResponsables] = useState<Responsable[]>(initialResponsables);
  const [sync, setSync] = useState<Sync>({ s: "live", txt: "Sincronizado" });
  const [F, setF] = useState<Filters>({ estado: "", frente: "", resp: "", q: "" });
  const [ppd, setPpd] = useState(12);
  const [taskDrawer, setTaskDrawer] = useState<{ id: string | null; presetFrente?: string } | null>(null);
  const [frDrawer, setFrDrawer] = useState<{ focusNew: boolean } | null>(null);
  const [rsDrawer, setRsDrawer] = useState(false);
  const ganttRef = useRef<GanttHandle>(null);

  const frentes = useMemo(() => sortFrentes(frentesRaw), [frentesRaw]);
  const frenteById = useMemo(() => new Map(frentes.map((f) => [f.id, f])), [frentes]);
  const nombreFrente = (id: string) => frenteById.get(id)?.nombre ?? "Sin frente";
  const responsables = useMemo(() => sortResponsables(respRaw), [respRaw]);
  const respById = useMemo(() => new Map(responsables.map((r) => [r.id, r.nombre])), [responsables]);
  const respName = useCallback((id: string | null) => (id ? (respById.get(id) ?? "") : ""), [respById]);

  /* ---------- datos + tiempo real ---------- */
  const reload = useCallback(async () => {
    const [fr, rs, ts] = await Promise.all([
      supabase.from("frentes").select("id,nombre,color,orden"),
      supabase.from("responsables").select("id,nombre"),
      supabase.from("tasks").select(TASK_COLS),
    ]);
    if (fr.error || rs.error || ts.error) {
      setSync({ s: "error", txt: "Conexión perdida" });
      return;
    }
    setFrentes(fr.data as Frente[]);
    setResponsables(rs.data as Responsable[]);
    setTasks(ts.data as Task[]);
  }, [supabase]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(reload, 150);
    };
    const ch = supabase
      .channel("gantt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "frentes" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "responsables" }, schedule)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSync({ s: "live", txt: "Sincronizado" });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSync({ s: "error", txt: "Sin tiempo real" });
      });
    return () => {
      clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [supabase, reload]);

  useEffect(() => {
    if (tasks.length) ganttRef.current?.scrollToday(false);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- escritura ---------- */
  async function run(op: () => PromiseLike<{ error: unknown; data?: unknown }>): Promise<{ ok: boolean; data?: unknown }> {
    setSync({ s: "saving", txt: "Guardando…" });
    const { error, data } = await op();
    if (error) {
      setSync({ s: "error", txt: "No se guardó" });
      return { ok: false };
    }
    setSync({ s: "live", txt: "Sincronizado" });
    return { ok: true, data };
  }

  async function saveTask(id: string | null, body: TaskInput) {
    if (id) {
      const prev = tasks;
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...body } : t)));
      const r = await run(() => supabase.from("tasks").update(body).eq("id", id));
      if (!r.ok) setTasks(prev);
      return r.ok;
    }
    const r = await run(() => supabase.from("tasks").insert(body).select(TASK_COLS).single());
    if (r.ok && r.data) setTasks((ts) => [...ts, r.data as Task]);
    return r.ok;
  }

  async function deleteTask(id: string) {
    const r = await run(() => supabase.from("tasks").delete().eq("id", id));
    if (r.ok) setTasks((ts) => ts.filter((t) => t.id !== id));
    return r.ok;
  }

  async function createFrente(nombre: string) {
    const orden = Math.max(0, ...frentes.map((f) => +f.orden || 0)) + 1;
    const color = PAL[frentes.length % PAL.length][0];
    const r = await run(() => supabase.from("frentes").insert({ nombre, color, orden }).select("id,nombre,color,orden").single());
    if (!r.ok || !r.data) return null;
    const f = r.data as Frente;
    setFrentes((fs) => [...fs, f]);
    return f;
  }

  async function saveFrentes(draft: FrenteDraft[]) {
    setSync({ s: "saving", txt: "Guardando…" });
    try {
      for (const d of draft) {
        if (d.del && d.id) {
          const { error } = await supabase.from("frentes").delete().eq("id", d.id);
          if (error) throw error;
        }
      }
      let orden = 1;
      for (const d of draft) {
        if (d.del) continue;
        const body = { nombre: d.nombre.trim(), color: d.color, orden: orden++ };
        const prev = d.id ? frenteById.get(d.id) : null;
        if (prev && prev.nombre === body.nombre && prev.color === body.color && prev.orden === body.orden) continue;
        const { error } = d.id
          ? await supabase.from("frentes").update(body).eq("id", d.id)
          : await supabase.from("frentes").insert(body);
        if (error) throw error;
      }
      await reload();
      setSync({ s: "live", txt: "Sincronizado" });
      return true;
    } catch {
      await reload();
      setSync({ s: "error", txt: "No se guardó" });
      return false;
    }
  }

  async function createResponsable(nombre: string) {
    const r = await run(() => supabase.from("responsables").insert({ nombre }).select("id,nombre").single());
    if (!r.ok || !r.data) return null;
    const nr = r.data as Responsable;
    setResponsables((rs) => [...rs, nr]);
    return nr;
  }

  async function saveResponsables(draft: ResponsableDraft[]) {
    setSync({ s: "saving", txt: "Guardando…" });
    try {
      for (const d of draft) {
        if (d.del && d.id) {
          const { error } = await supabase.from("responsables").delete().eq("id", d.id);
          if (error) throw error;
        }
      }
      for (const d of draft) {
        if (d.del) continue;
        const nombre = d.nombre.trim();
        if (d.id && respById.get(d.id) === nombre) continue;
        const { error } = d.id
          ? await supabase.from("responsables").update({ nombre }).eq("id", d.id)
          : await supabase.from("responsables").insert({ nombre });
        if (error) throw error;
      }
      await reload();
      setSync({ s: "live", txt: "Sincronizado" });
      return true;
    } catch {
      await reload();
      setSync({ s: "error", txt: "No se guardó" });
      return false;
    }
  }

  /* ---------- derivados ---------- */
  const filtered = useMemo(() => {
    const q = F.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (F.frente && t.frente_id !== F.frente) return false;
      if (F.resp && t.responsable_id !== F.resp) return false;
      if (F.estado === "late") {
        if (!isLate(t, TODAY)) return false;
      } else if (F.estado && t.estado !== F.estado) return false;
      if (q && !`${t.actividad} ${respName(t.responsable_id)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, F, TODAY, respName]);

  const by = (e: string) => tasks.filter((t) => t.estado === e).length;
  const late = tasks.filter((t) => isLate(t, TODAY)).length;
  const tot = tasks.length;
  const p = weighted(tasks);
  const lateT = tasks.filter((t) => isLate(t, TODAY)).sort((a, b) => pd(a.fin) - pd(b.fin));
  const soon = tasks
    .filter((t) => t.estado !== "Cerrada" && pd(t.fin) >= TODAY && pd(t.fin) <= TODAY + 14 * DAY)
    .sort((a, b) => pd(a.fin) - pd(b.fin));
  const counts: Record<string, number> = { "": tot, Pendiente: by("Pendiente"), "En curso": by("En curso"), Cerrada: by("Cerrada"), late };

  function exportCsv() {
    const order = new Map(frentes.map((f, i) => [f.id, i]));
    const rows: (string | number)[][] = [["ID", "Frente", "Actividad", "Responsable", "Estado", "% avance", "Inicio", "Fin", "Días", "Atrasada", "Notas"]];
    for (const t of [...tasks].sort((a, b) => (order.get(a.frente_id) ?? 0) - (order.get(b.frente_id) ?? 0) || a.num - b.num))
      rows.push([t.num, nombreFrente(t.frente_id), t.actividad, respName(t.responsable_id), t.estado, t.avance, t.inicio, t.fin, dur(t), isLate(t, TODAY) ? "Sí" : "No", t.notas || ""]);
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Gantt_MATERAN_${fmt(TODAY)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const openTask = (id: string | null, presetFrente?: string) => setTaskDrawer({ id, presetFrente });
  const closeAll = () => {
    setTaskDrawer(null);
    setFrDrawer(null);
    setRsDrawer(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const li = (t: Task, lt: boolean) => (
    <div className="li" key={t.id} onClick={() => openTask(t.id)}>
      <b>{t.actividad}</b>
      <small>
        {nombreFrente(t.frente_id)} · {respName(t.responsable_id) || "Sin responsable"}
      </small>
      <span className={`d ${lt ? "lt" : ""}`}>{lt ? `${Math.round((TODAY - pd(t.fin)) / DAY)} d tarde` : human(pd(t.fin))}</span>
    </div>
  );

  return (
    <>
      <Band>
        <span className="sync" data-s={sync.s}>
          {sync.txt}
        </span>
        <span className="who">
          <span className="em" title={email}>
            {email}
          </span>
          <span className="role" data-r={role}>
            {role === "admin" ? "Admin" : "Lector"}
          </span>
          <form action={signOut}>
            <button className="out" type="submit">
              Salir
            </button>
          </form>
        </span>
      </Band>

      <main className="wrap">
        <div className="head">
          <div>
            <h1>
              Plan de trabajo <em>MATERAN</em>
            </h1>
            <span className="rule" aria-hidden="true" />
            <p className="sub">Creación, expectativa y lanzamiento de marca</p>
          </div>
          <span className="cut">
            Corte: {human(TODAY)} {new Date(TODAY).getUTCFullYear()}
          </span>
        </div>

        <section className="summary" aria-label="Resumen">
          <div className="panel prog">
            <div className="ring" style={{ "--p": p } as React.CSSProperties}>
              <span>{p}%</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="lbl">Avance ponderado por duración</p>
              <div className="counts">
                {(
                  [
                    ["Cerradas", by("Cerrada"), "var(--ok)"],
                    ["En curso", by("En curso"), "var(--run)"],
                    ["Pendientes", by("Pendiente"), "var(--todo)"],
                    ["Atrasadas", late, "var(--late)"],
                  ] as const
                ).map(([l, n, c]) => (
                  <div className="cnt" key={l}>
                    <b>{n}</b>
                    <small>
                      <i className="dot" style={{ background: c }} />
                      {l}
                    </small>
                  </div>
                ))}
                <div className="cnt" style={{ gridColumn: "1/-1" }}>
                  <small>
                    {tot} actividades · {tot ? Math.round((by("Cerrada") / tot) * 100) : 0}% cerradas por conteo
                  </small>
                </div>
              </div>
            </div>
          </div>
          <div className="panel">
            <p className="lbl">
              Avance por frente · clic para filtrar{" "}
              {canWrite && (
                <button className="lk" onClick={() => setFrDrawer({ focusNew: false })}>
                  Gestionar frentes
                </button>
              )}
            </p>
            <div className="fr-list">
              {frentes.map((fd) => {
                const ts = tasks.filter((t) => t.frente_id === fd.id);
                const n = ts.length;
                const c = ts.filter((t) => t.estado === "Cerrada").length;
                const r = ts.filter((t) => t.estado === "En curso").length;
                const l = ts.filter((t) => isLate(t, TODAY)).length;
                return (
                  <button
                    key={fd.id}
                    className="fr"
                    aria-pressed={F.frente === fd.id}
                    onClick={() => setF((f) => ({ ...f, frente: f.frente === fd.id ? "" : fd.id }))}
                  >
                    <span className="fr-top">
                      <span>
                        <i className="tag" style={{ background: fd.color }} />
                        {fd.nombre}
                      </span>
                      <span>{n ? `${weighted(ts)}%` : "—"}</span>
                    </span>
                    <span className="meter">
                      {n > 0 && (
                        <>
                          <i style={{ width: `${(c / n) * 100}%`, background: "var(--ok)" }} />
                          <i style={{ width: `${(r / n) * 100}%`, background: "var(--run)" }} />
                        </>
                      )}
                    </span>
                    <span className="fr-meta">
                      {n ? (
                        <>
                          {c}/{n} cerradas
                          {l > 0 && (
                            <>
                              {" · "}
                              <em>
                                {l} atrasada{l > 1 ? "s" : ""}
                              </em>
                            </>
                          )}
                        </>
                      ) : (
                        "Sin actividades aún"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filtrar por estado">
            {[
              ["", "Todas"],
              ["Pendiente", "Pendientes"],
              ["En curso", "En curso"],
              ["Cerrada", "Cerradas"],
              ["late", "Atrasadas"],
            ].map(([v, l]) => (
              <button key={v} className="chip" aria-pressed={F.estado === v} onClick={() => setF((f) => ({ ...f, estado: v }))}>
                {l}
                <span className="n">{counts[v]}</span>
              </button>
            ))}
          </div>
          <select className="field" aria-label="Responsable" value={F.resp} onChange={(e) => setF((f) => ({ ...f, resp: e.target.value }))}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <input
            className="field search"
            type="search"
            placeholder="Buscar actividad…"
            aria-label="Buscar actividad"
            value={F.q}
            onChange={(e) => setF((f) => ({ ...f, q: e.target.value }))}
          />
          <span className="spacer" />
          <div className="seg" role="group" aria-label="Escala">
            {[
              [4, "Mes"],
              [12, "Semana"],
              [28, "Día"],
            ].map(([z, l]) => (
              <button
                key={z}
                aria-pressed={ppd === z}
                onClick={() => {
                  setPpd(z as number);
                  requestAnimationFrame(() => ganttRef.current?.scrollToday(false));
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => ganttRef.current?.scrollToday(true)}>
            Ir a hoy
          </button>
          <button className="btn" onClick={exportCsv}>
            Exportar CSV
          </button>
          {canWrite && (
            <>
              <button className="btn" onClick={() => setFrDrawer({ focusNew: false })}>
                Frentes
              </button>
              <button className="btn" onClick={() => setRsDrawer(true)}>
                Responsables
              </button>
              <button className="btn primary" onClick={() => openTask(null)}>
                + Actividad
              </button>
            </>
          )}
        </div>

        <Gantt
          ref={ganttRef}
          tasks={tasks}
          filtered={filtered}
          frentes={frentes}
          respName={respName}
          filtersOn={!!(F.estado || F.frente || F.resp || F.q.trim())}
          ppd={ppd}
          today={TODAY}
          canWrite={canWrite}
          selected={taskDrawer?.id ?? null}
          onOpenTask={openTask}
          onNewFrente={() => setFrDrawer({ focusNew: true })}
          onReschedule={(t, inicio, fin) => saveTask(t.id, { ...stripId(t), inicio, fin })}
        />

        <div className="legend">
          <span>
            <i className="sw" style={{ background: "var(--ok-soft)", borderColor: "var(--ok)" }} />
            Cerrada
          </span>
          <span>
            <i className="sw" style={{ background: "var(--run-soft)", borderColor: "var(--run)" }} />
            En curso (relleno = % avance)
          </span>
          <span>
            <i className="sw" style={{ background: "var(--todo-soft)", borderColor: "var(--todo)" }} />
            Pendiente
          </span>
          <span>
            <i
              className="sw"
              style={{ background: "repeating-linear-gradient(135deg,var(--late-soft) 0 4px,transparent 4px 7px)", borderColor: "var(--late)" }}
            />
            Atrasada
          </span>
          <span>
            <i className="sw dia" />
            Hito (1 día)
          </span>
          {canWrite && <span className="hint">Arrastra una barra para moverla o sus bordes para cambiar fechas · clic para editar</span>}
        </div>

        <section className="lists">
          <div className="panel">
            <p className="lbl">Atrasadas</p>
            {lateT.length ? lateT.map((t) => li(t, true)) : <p className="none">Nada atrasado. Buen ritmo.</p>}
          </div>
          <div className="panel">
            <p className="lbl">Vencen en los próximos 14 días</p>
            {soon.length ? soon.map((t) => li(t, false)) : <p className="none">No hay entregas en las próximas dos semanas.</p>}
          </div>
        </section>
      </main>

      {(taskDrawer || frDrawer || rsDrawer) && <div className="scrim" onClick={closeAll} />}

      {taskDrawer && (
        <TaskDrawer
          key={taskDrawer.id ?? "new"}
          task={taskDrawer.id ? (tasks.find((t) => t.id === taskDrawer.id) ?? null) : null}
          presetFrente={taskDrawer.presetFrente || F.frente || frentes[0]?.id || ""}
          nextNum={Math.max(0, ...tasks.map((t) => +t.num || 0)) + 1}
          frentes={frentes}
          responsables={responsables}
          today={TODAY}
          canWrite={canWrite}
          onClose={closeAll}
          onSave={saveTask}
          onDelete={deleteTask}
          onCreateFrente={createFrente}
          onCreateResponsable={createResponsable}
        />
      )}

      {frDrawer && canWrite && (
        <FrentesDrawer frentes={frentes} tasks={tasks} focusNew={frDrawer.focusNew} onClose={closeAll} onSave={saveFrentes} />
      )}

      {rsDrawer && canWrite && <ResponsablesDrawer responsables={responsables} tasks={tasks} onClose={closeAll} onSave={saveResponsables} />}
    </>
  );
}

function stripId(t: Task): TaskInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = t;
  return rest;
}
