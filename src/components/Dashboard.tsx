"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/app/board/actions";
import { DAY, dur, fmt, human, isLate, pd, PAL, sortFrentes, sortResponsables, todayUTC, weighted } from "@/lib/gantt";
import type { Frente, Responsable, Role, Task, TaskInput } from "@/lib/gantt";
import { cn, ui } from "@/lib/ui";
import Band from "./Band";
import FrentesDrawer, { type FrenteDraft } from "./FrentesDrawer";
import Gantt, { type GanttHandle } from "./Gantt";
import Hero from "./Hero";
import SyncBadge, { type SyncState } from "./SyncBadge";
import ResponsablesDrawer, { type ResponsableDraft } from "./ResponsablesDrawer";
import TaskDrawer from "./TaskDrawer";
import UserMenu from "./UserMenu";

type Props = { user: string; role: Role; initialFrentes: Frente[]; initialResponsables: Responsable[]; initialTasks: Task[] };
type Sync = { s: SyncState; txt: string };
const POLL_MS = 15000;
export type Filters = { estado: string; frente: string; resp: string; q: string };

export default function Dashboard({ user, role, initialFrentes, initialResponsables, initialTasks }: Props) {
  const canWrite = role === "admin" || role === "editor";
  const TODAY = useMemo(() => todayUTC(), []);

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [frentesRaw, setFrentes] = useState<Frente[]>(initialFrentes);
  const [respRaw, setResponsables] = useState<Responsable[]>(initialResponsables);
  const [sync, setSync] = useState<Sync>({ s: "idle", txt: "Conectando…" });
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

  /* ---------- datos (vía servidor; el navegador no habla con Supabase) ---------- */
  const busy = useRef(0);
  const reload = useCallback(async () => {
    const r = await api.getBoard().catch(() => null);
    if (r && !r.ok && r.error === "Sesión expirada.") {
      // Navegación completa: /sesion/expirada es un route handler que limpia la cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sesion/expirada");
      return false;
    }
    if (!r?.ok) {
      setSync({ s: "error", txt: "Conexión perdida" });
      return false;
    }
    // No pisar los cambios optimistas mientras hay una escritura en curso.
    if (busy.current) return true;
    setFrentes(r.data.frentes);
    setResponsables(r.data.responsables);
    setTasks(r.data.tasks);
    setSync({ s: "live", txt: "Sincronizado" });
    return true;
  }, []);

  // Actualización periódica para ver los cambios de otros usuarios.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") reload();
    };
    tick();
    const iv = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [reload]);

  useEffect(() => {
    if (tasks.length) ganttRef.current?.scrollToday(false);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- escritura ---------- */
  async function run<T>(op: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    busy.current++;
    setSync({ s: "saving", txt: "Guardando…" });
    const r = await op().catch(() => ({ ok: false as const, error: "" }));
    busy.current--;
    setSync(r.ok ? { s: "live", txt: "Sincronizado" } : { s: "error", txt: "No se guardó" });
    return r;
  }

  async function saveTask(id: string | null, body: TaskInput) {
    const prev = tasks;
    if (id) setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...body } : t)));
    const r = await run(() => api.saveTask(id, body));
    if (!r.ok) {
      setTasks(prev);
      return false;
    }
    setTasks((ts) => (id ? ts.map((t) => (t.id === id ? r.data : t)) : [...ts, r.data]));
    return true;
  }

  async function deleteTask(id: string) {
    const r = await run(() => api.deleteTask(id));
    if (r.ok) setTasks((ts) => ts.filter((t) => t.id !== id));
    return r.ok;
  }

  async function createFrente(nombre: string) {
    const r = await run(() => api.createFrente(nombre, PAL[frentes.length % PAL.length][0]));
    if (!r.ok) return null;
    setFrentes((fs) => [...fs, r.data]);
    return r.data;
  }

  async function saveFrentes(draft: FrenteDraft[]) {
    const r = await run(() => api.saveFrentes(draft.map(({ id, nombre, color, del }) => ({ id, nombre, color, del }))));
    await reload();
    return r.ok;
  }

  async function createResponsable(nombre: string) {
    const r = await run(() => api.createResponsable(nombre));
    if (!r.ok) return null;
    setResponsables((rs) => [...rs, r.data]);
    return r.data;
  }

  async function saveResponsables(draft: ResponsableDraft[]) {
    const r = await run(() => api.saveResponsables(draft.map(({ id, nombre, del }) => ({ id, nombre, del }))));
    await reload();
    return r.ok;
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
    <button
      key={t.id}
      onClick={() => openTask(t.id)}
      className="-mx-2 grid w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-[10px] border-t border-line px-2 py-2.5 text-left transition first:border-t-0 hover:bg-surface-2"
    >
      <b className="truncate font-bold">{t.actividad}</b>
      <small className="col-start-1 truncate text-xs text-muted">
        {nombreFrente(t.frente_id)} · {respName(t.responsable_id) || "Sin responsable"}
      </small>
      <span
        className={cn(
          "col-start-2 row-span-2 row-start-1 self-center justify-self-end font-mono text-xs font-medium",
          lt ? "rounded-full bg-late/15 px-2 py-[3px] text-late" : "text-muted",
        )}
      >
        {lt ? `${Math.round((TODAY - pd(t.fin)) / DAY)} d tarde` : human(pd(t.fin))}
      </span>
    </button>
  );

  return (
    <>
      <Band>
        <SyncBadge s={sync.s} txt={sync.txt} />
        <UserMenu user={user} role={role} />
      </Band>

      <main className="mx-auto grid max-w-[1440px] gap-[22px] px-4 pt-7 pb-14 *:animate-rise [&>*:nth-child(2)]:[animation-delay:.06s] [&>*:nth-child(3)]:[animation-delay:.12s] [&>*:nth-child(n+4)]:[animation-delay:.18s]">
        <Hero tasks={tasks} frentes={frentes} today={TODAY} F={F} setF={setF} onOpenTask={(id) => openTask(id)} respName={respName} />

        <section aria-label="Avance por frente">
          <div className="mb-3 flex items-center gap-3">
            <p className={ui.eyebrow}>Avance por frente</p>
            {canWrite && (
              <span className="ml-auto flex gap-4">
                <button className="text-[12.5px] font-bold text-link hover:underline" onClick={() => setRsDrawer(true)}>
                  Gestionar responsables
                </button>
                <button className="text-[12.5px] font-bold text-link hover:underline" onClick={() => setFrDrawer({ focusNew: false })}>
                  Gestionar frentes
                </button>
              </span>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {frentes.map((fd) => {
              const ts = tasks.filter((t) => t.frente_id === fd.id);
              const n = ts.length;
              const c = ts.filter((t) => t.estado === "Cerrada").length;
              const l = ts.filter((t) => isLate(t, TODAY)).length;
              const fp = n ? weighted(ts) : 0;
              const next = ts.filter((t) => t.estado !== "Cerrada").sort((a, b) => pd(a.fin) - pd(b.fin))[0];
              return (
                <button
                  key={fd.id}
                  aria-pressed={F.frente === fd.id}
                  style={{ "--c": fd.color } as React.CSSProperties}
                  onClick={() => setF((f) => ({ ...f, frente: f.frente === fd.id ? "" : fd.id }))}
                  className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-line bg-surface bg-linear-135 from-[color-mix(in_srgb,var(--c)_12%,transparent)] to-transparent to-55% p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--c)_55%,var(--line))] hover:shadow-[0_10px_30px_color-mix(in_srgb,var(--c)_18%,transparent)] aria-pressed:border-(--c) aria-pressed:ring-3 aria-pressed:ring-[color-mix(in_srgb,var(--c)_22%,transparent)]"
                >
                  <svg className="size-[52px] -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                    <circle cx="24" cy="24" r="20" fill="none" strokeWidth="5" className="stroke-surface-3" />
                    {fp > 0 && <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      strokeWidth="5"
                      strokeLinecap="round"
                      pathLength={100}
                      className="stroke-(--c) drop-shadow-[0_0_4px_var(--c)] transition-[stroke-dasharray] duration-1000"
                      style={{ strokeDasharray: `${fp} 100` }}
                    />}
                  </svg>
                  <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5">
                    <span className="truncate font-bold">{fd.nombre}</span>
                    <span className="font-display text-lg font-semibold tracking-tight tabular-nums">{n ? `${fp}%` : "—"}</span>
                    <span className="col-span-2 text-xs text-muted">
                      {n ? `${c}/${n} cerradas` : "Sin actividades aún"}
                      {l > 0 && (
                        <em className="font-bold text-late not-italic">
                          {" "}
                          · {l} atrasada{l > 1 ? "s" : ""}
                        </em>
                      )}
                    </span>
                    {next && (
                      <span className="col-span-2 truncate text-[11.5px] text-dim" title={next.actividad}>
                        Próxima: {next.actividad}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface p-2.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {[
              ["", "Todas"],
              ["Pendiente", "Pendientes"],
              ["En curso", "En curso"],
              ["Cerrada", "Cerradas"],
              ["late", "Atrasadas"],
            ].map(([v, l]) => (
              <button
                key={v}
                aria-pressed={F.estado === v}
                onClick={() => setF((f) => ({ ...f, estado: v }))}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-muted transition hover:border-brand aria-pressed:border-transparent aria-pressed:bg-linear-to-r aria-pressed:from-brand aria-pressed:to-indigo aria-pressed:text-white aria-pressed:shadow-[0_4px_16px_rgba(0,148,255,.3)]"
              >
                {l}
                <span className="font-mono text-[11px] font-normal opacity-75">{counts[v]}</span>
              </button>
            ))}
          </div>
          <select className={cn(ui.field, "max-w-[220px]")} aria-label="Responsable" value={F.resp} onChange={(e) => setF((f) => ({ ...f, resp: e.target.value }))}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <input
            className={cn(ui.field, "flex-[1_1_160px] md:max-w-[220px]")}
            type="search"
            placeholder="Buscar actividad…"
            aria-label="Buscar actividad"
            value={F.q}
            onChange={(e) => setF((f) => ({ ...f, q: e.target.value }))}
          />
          <span className="flex-1" />
          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-surface-2" role="group" aria-label="Escala">
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
                className="px-3 py-[7px] text-[13px] font-bold text-muted transition hover:text-fg aria-pressed:bg-accent-soft aria-pressed:text-fg aria-pressed:shadow-[inset_0_-2px_0_var(--color-brand)]"
              >
                {l}
              </button>
            ))}
          </div>
          <button className={ui.btn} onClick={() => ganttRef.current?.scrollToday(true)}>
            Ir a hoy
          </button>
          <button className={cn(ui.btn, "px-2.5")} onClick={exportCsv} title="Exportar CSV" aria-label="Exportar CSV">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            CSV
          </button>
          {canWrite && (
            <button className={ui.btnPrimary} onClick={() => openTask(null)}>
              + Actividad
            </button>
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

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
          {(
            [
              ["Cerrada", "bg-ok/15 shadow-[inset_0_0_0_1.5px_var(--ok)]"],
              ["En curso (relleno = % avance)", "bg-run/15 shadow-[inset_0_0_0_1.5px_var(--run)]"],
              ["Pendiente", "bg-todo/15 shadow-[inset_0_0_0_1.5px_var(--todo)]"],
              ["Atrasada", "bg-late-soft-stripes shadow-[inset_0_0_0_1.5px_var(--late)]"],
            ] as const
          ).map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-[7px]">
              <i className={cn("inline-block h-3 w-[22px] rounded-full", c)} aria-hidden="true" />
              {l}
            </span>
          ))}
          <span className="inline-flex items-center gap-[7px]">
            <i className="inline-block size-[11px] rotate-45 rounded-[2px] bg-mile" aria-hidden="true" />
            Hito (1 día)
          </span>
          {canWrite && <span className="ml-auto max-md:hidden">Arrastra una barra para moverla o sus bordes para cambiar fechas · clic para editar</span>}
        </div>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          {(
            [
              ["Atrasadas", lateT, true, "Nada atrasado. Buen ritmo."],
              ["Vencen en los próximos 14 días", soon, false, "No hay entregas en las próximas dos semanas."],
            ] as const
          ).map(([titulo, lista, lt, vacio]) => (
            <div key={titulo} className={cn(ui.panel, "p-[18px]")}>
              <p className={cn(ui.eyebrow, "mb-2.5")}>
                {titulo}
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tracking-normal">{lista.length}</span>
              </p>
              {lista.length ? lista.map((t) => li(t, lt)) : <p className="m-0 text-[13px] text-muted">{vacio}</p>}
            </div>
          ))}
        </section>
      </main>

      {(taskDrawer || frDrawer || rsDrawer) && <div className="fixed inset-0 z-40 bg-[rgba(3,6,16,.6)] backdrop-blur-[3px]" onClick={closeAll} />}

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
