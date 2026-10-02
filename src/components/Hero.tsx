"use client";

import { useEffect, useState } from "react";
import { DAY, dur, human, isLate, MES, pd, weighted } from "@/lib/gantt";
import type { Frente, Task } from "@/lib/gantt";
import { cn, ui } from "@/lib/ui";
import type { Filters } from "./Dashboard";

type Props = {
  tasks: Task[];
  frentes: Frente[];
  today: number;
  F: Filters;
  setF: (f: (prev: Filters) => Filters) => void;
  onOpenTask: (id: string) => void;
  respName: (id: string | null) => string;
};

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Cuenta animada hasta `value` (respeta prefers-reduced-motion). */
function useCountUp(value: number, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduceMotion()) return;
    let raf = 0;
    const from = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return reduceMotion() ? value : n;
}

type Bucket = "Cerrada" | "En curso" | "Pendiente" | "late";
const BUCKETS: { key: Bucket; label: string; seg: string; dot: string }[] = [
  { key: "Cerrada", label: "Cerradas", seg: "bg-ok", dot: "bg-ok" },
  { key: "En curso", label: "En curso", seg: "bg-run shadow-[0_0_8px_rgba(0,148,255,.55)]", dot: "bg-run" },
  { key: "Pendiente", label: "Pendientes", seg: "bg-todo/55", dot: "bg-todo" },
  { key: "late", label: "Atrasadas", seg: "bg-late shadow-[0_0_8px_rgba(255,90,95,.5)]", dot: "bg-late" },
];

/* Cápsulas de la pista por estado. */
const CAP: Record<"ok" | "run" | "todo" | "late", string> = {
  ok: "bg-ok/90",
  run: "bg-run shadow-[0_0_12px_rgba(0,148,255,.7)]",
  todo: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--todo)]",
  late: "bg-late-stripes shadow-[0_0_12px_rgba(255,90,95,.55)]",
};
const MILE: Record<"ok" | "mile" | "late", string> = {
  ok: "bg-ok",
  mile: "bg-mile shadow-[0_0_12px_rgba(243,177,22,.6)]",
  late: "bg-late shadow-[0_0_12px_rgba(255,90,95,.55)]",
};

/** Columna de nombres de carril y posición sobre la pista (fracción 0..1 del ancho de la pista). */
const LANE = "var(--lane-l)";
const onTrack = (n: number) => `calc(${LANE} + (100% - ${LANE}) * ${n})`;

export default function Hero({ tasks, frentes, today, F, setF, onOpenTask, respName }: Props) {
  const p = weighted(tasks);
  const shown = useCountUp(p);
  const bucket = (t: Task): Bucket => (isLate(t, today) ? "late" : t.estado);
  const groups = BUCKETS.map((b) => ({ ...b, items: tasks.filter((t) => bucket(t) === b.key).sort((a, z) => pd(a.fin) - pd(z.fin)) }));

  /* ---------- rango del plan ---------- */
  const hasTasks = tasks.length > 0;
  const start = hasTasks ? Math.min(...tasks.map((t) => pd(t.inicio))) : today;
  const end = hasTasks ? Math.max(...tasks.map((t) => pd(t.fin))) : today;
  const s = Math.min(start, today) - 3 * DAY;
  const e = Math.max(end, today) + 3 * DAY;
  const span = e - s;
  const pct = (t: number) => ((t - s) / span) * 100;
  const todayPct = pct(today + DAY / 2);

  // Ritmo: tiempo transcurrido del plan frente al avance real.
  const elapsed = hasTasks ? Math.max(0, Math.min(100, Math.round(((today - start) / (end - start || DAY)) * 100))) : 0;
  const gap = p - elapsed;
  const diasCierre = Math.round((end - today) / DAY);

  const months: { left: number; label: string }[] = [];
  for (let d = new Date(s); d.getTime() <= e; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    if (m >= s) months.push({ left: pct(m), label: MES[d.getUTCMonth()] });
  }

  const proximas = tasks
    .filter((t) => t.estado !== "Cerrada" && pd(t.fin) >= today)
    .sort((a, z) => pd(a.fin) - pd(z.fin))
    .slice(0, 3);

  const toggleEstado = (k: string) => setF((f) => ({ ...f, estado: f.estado === k ? "" : k }));
  const toggleFrente = (id: string) => setF((f) => ({ ...f, frente: f.frente === id ? "" : id }));

  return (
    <section className="edge-gradient grid overflow-hidden rounded-[22px] bg-surface shadow-card lg:grid-cols-[minmax(300px,.85fr)_minmax(0,1.6fr)]" aria-label="Resumen del plan">
      <div className="bg-hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      {/* ---------- Columna de cifras ---------- */}
      <div className="grid content-start gap-[18px] border-line p-7 max-lg:border-b lg:border-r">
        <p className={ui.eyebrow}>Plan de lanzamiento de marca</p>
        <h1 className="-mt-1.5 font-display text-[clamp(30px,4.2vw,52px)] leading-[1.02] font-semibold tracking-[-.035em] text-balance">
          Plan de trabajo <em className="text-gradient-title not-italic">MATERAN</em>
        </h1>
        <p className="-mt-2 text-[13.5px] text-muted">
          Creación, expectativa y lanzamiento de marca · corte {human(today)} {new Date(today).getUTCFullYear()}
        </p>

        <div className="grid gap-4">
          <div className="grid gap-0.5">
            <span className="text-gradient-figure font-display text-[clamp(64px,7vw,96px)] leading-[.9] font-semibold tracking-[-.05em] tabular-nums">
              {shown}
              <small className="relative top-[.25em] ml-0.5 align-top text-[.42em] tracking-normal">%</small>
            </span>
            <span className="text-xs tracking-wide text-muted">avance ponderado por duración</span>
          </div>
          <dl className="m-0 grid overflow-hidden rounded-xl border border-line bg-surface-2 sm:grid-cols-3">
            {[
              { dt: "Tiempo transcurrido", dd: <>{elapsed}%</> },
              {
                dt: "Ritmo",
                dd: (
                  <span className={gap >= 0 ? "text-ok" : "text-late"}>
                    {gap >= 0 ? "+" : "−"}
                    {Math.abs(gap)} pts {gap >= 0 ? "adelante" : "detrás"}
                  </span>
                ),
              },
              {
                dt: "Cierre del plan",
                dd: (
                  <>
                    {hasTasks ? human(end) : "—"}
                    {hasTasks && <small className="font-sans text-[11.5px] font-normal text-muted">{diasCierre >= 0 ? ` · faltan ${diasCierre} d` : ` · hace ${-diasCierre} d`}</small>}
                  </>
                ),
              },
            ].map((x) => (
              <div key={x.dt} className="min-w-0 border-line px-3 py-2.5 max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:first:border-l-0">
                <dt className="text-[10px] leading-tight font-bold uppercase tracking-[.1em] text-dim">{x.dt}</dt>
                <dd className="m-0 mt-1 font-display text-[17px] font-semibold tracking-tight whitespace-nowrap">{x.dd}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Barra de estados: un segmento por actividad */}
        <div className="grid gap-2.5" role="group" aria-label="Actividades por estado">
          <div className="flex h-4 gap-0.5">
            {groups.flatMap((g) =>
              g.items.map((t) => (
                <button
                  key={t.id}
                  className={cn("min-w-[3px] flex-1 rounded-[3px] transition hover:scale-y-[1.45] hover:brightness-125", g.seg, F.estado && F.estado !== g.key && "opacity-20")}
                  title={`#${t.num} ${t.actividad} · ${g.label.toLowerCase()}`}
                  aria-label={`#${t.num} ${t.actividad}, ${g.label}`}
                  onClick={() => onOpenTask(t.id)}
                />
              )),
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g.key}
                aria-pressed={F.estado === g.key}
                onClick={() => toggleEstado(g.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-2.5 pl-2 text-xs text-muted transition hover:border-brand aria-pressed:border-brand aria-pressed:bg-accent-soft aria-pressed:text-fg"
              >
                <i className={cn("size-2 rounded-full", g.dot)} aria-hidden="true" />
                <b className="font-display text-sm font-semibold text-fg tabular-nums">{g.items.length}</b>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Pista de lanzamiento ---------- */}
      <div className="flex min-w-0 flex-col gap-3 p-6" aria-label="Pista de lanzamiento: actividades por frente en el tiempo">
        <div className="flex flex-wrap items-center gap-3">
          <p className={ui.eyebrow}>Pista de lanzamiento</p>
          <span className="ml-auto text-[11.5px] text-dim max-md:hidden">Clic en un carril para filtrar · en una cápsula para abrirla</span>
        </div>
        <div className="relative grid flex-1 auto-rows-fr gap-1.5 pt-[22px] [--lane-l:92px] md:[--lane-l:132px]">
          <div className="absolute top-0 right-0 left-(--lane-l) h-4" aria-hidden="true">
            {months.map((m) => (
              <span key={m.left} className="absolute top-0 translate-x-1 font-mono text-[10.5px] leading-none font-medium uppercase tracking-[.12em] text-dim" style={{ left: `${m.left}%` }}>
                {m.label}
              </span>
            ))}
          </div>

          {frentes.map((f) => {
            const ts = tasks.filter((t) => t.frente_id === f.id);
            const on = F.frente === f.id;
            return (
              <div
                key={f.id}
                className={cn("grid grid-cols-[var(--lane-l)_minmax(0,1fr)] items-center transition-opacity", F.frente && !on && "opacity-30")}
                style={{ "--c": f.color } as React.CSSProperties}
              >
                <button
                  onClick={() => toggleFrente(f.id)}
                  aria-pressed={on}
                  className="flex min-w-0 items-center gap-2 truncate pr-2.5 text-left text-[12.5px] font-bold text-muted transition hover:text-fg aria-pressed:text-fg"
                >
                  <i className="size-2 flex-none rounded-[2px] bg-(--c) shadow-[0_0_10px_var(--c)]" aria-hidden="true" />
                  <span className="truncate">{f.nombre}</span>
                </button>
                <div
                  className={cn(
                    "relative h-full min-h-[30px] rounded-lg border border-line bg-surface-2 bg-linear-to-r from-[color-mix(in_srgb,var(--c)_10%,transparent)] to-transparent to-70%",
                    on && "border-[color-mix(in_srgb,var(--c)_60%,transparent)] ring-3 ring-[color-mix(in_srgb,var(--c)_18%,transparent)]",
                  )}
                >
                  {months.map((m) => (
                    <span key={m.left} className="absolute inset-y-0 w-px bg-line" style={{ left: `${m.left}%` }} aria-hidden="true" />
                  ))}
                  {ts.map((t) => {
                    const one = dur(t) === 1;
                    const left = pct(pd(t.inicio));
                    const width = Math.max(((dur(t) * DAY) / span) * 100, 0.6);
                    const b = bucket(t);
                    const title = `#${t.num} ${t.actividad}\n${human(pd(t.inicio))} → ${human(pd(t.fin))} · ${t.avance}% · ${respName(t.responsable_id) || "Sin responsable"}`;
                    if (one)
                      return (
                        <button
                          key={t.id}
                          className={cn("absolute top-1/2 -mt-[6.5px] -ml-[6.5px] size-[13px] rotate-45 rounded-[3px] transition hover:scale-125 hover:brightness-125", MILE[b === "late" ? "late" : b === "Cerrada" ? "ok" : "mile"])}
                          style={{ left: `${left + width / 2}%` }}
                          title={title}
                          aria-label={title}
                          onClick={() => onOpenTask(t.id)}
                        />
                      );
                    const k = b === "late" ? "late" : b === "Cerrada" ? "ok" : b === "En curso" ? "run" : "todo";
                    return (
                      <button
                        key={t.id}
                        className={cn("absolute top-1/2 -mt-1.5 h-3 min-w-[5px] overflow-hidden rounded-full transition hover:z-10 hover:scale-y-[1.35] hover:brightness-125", CAP[k])}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={title}
                        aria-label={title}
                        onClick={() => onOpenTask(t.id)}
                      >
                        {k === "run" && <span className="absolute inset-y-0 left-0 rounded-full bg-white/45" style={{ width: `${t.avance}%` }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* barrido inicial hasta hoy, línea de hoy y cierre del plan */}
          <div
            className="pointer-events-none absolute top-[22px] bottom-0 left-(--lane-l) origin-left animate-sweep rounded-lg bg-linear-to-r from-transparent via-cyan/5 to-cyan/15"
            style={{ width: `calc((100% - var(--lane-l)) * ${todayPct / 100})` }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-3.5 -bottom-1.5 w-0.5 bg-linear-to-b from-cyan to-cyan/25 shadow-[0_0_14px_var(--color-cyan)]"
            style={{ left: onTrack(todayPct / 100) }}
            aria-hidden="true"
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-cyan px-1.5 py-[3px] font-mono text-[10px] leading-none font-semibold tracking-[.14em] text-[#04121f] shadow-[0_0_14px_rgba(0,225,255,.6)]">
              HOY
            </span>
          </div>
          {hasTasks && (
            <div className="pointer-events-none absolute top-3.5 -bottom-1.5 w-0 border-l-2 border-dashed border-mile" style={{ left: onTrack(pct(end + DAY) / 100) }} aria-hidden="true">
              <span className="absolute -top-4 -left-px -translate-x-1/2 rounded bg-mile px-1.5 py-[3px] font-mono text-[10px] leading-none font-semibold uppercase tracking-[.12em] text-[#1e1400]">
                Cierre
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[11.5px] text-muted">
          <span className="font-bold uppercase tracking-[.1em] text-dim">Próximas entregas</span>
          {proximas.length ? (
            proximas.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-2.5 pl-1.5 transition hover:border-brand"
                title={t.actividad}
              >
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] text-link">{human(pd(t.fin))}</span>
                <span className="truncate text-fg">{t.actividad}</span>
              </button>
            ))
          ) : (
            <span>Nada pendiente por entregar.</span>
          )}
        </div>
      </div>
    </section>
  );
}
