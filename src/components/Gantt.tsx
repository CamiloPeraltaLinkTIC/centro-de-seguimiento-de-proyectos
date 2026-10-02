"use client";

import { useImperativeHandle, useRef, useState } from "react";
import { DAY, dur, fmt, human, isLate, MES, pd } from "@/lib/gantt";
import type { Frente, Task } from "@/lib/gantt";
import { cn, estadoPill, ui } from "@/lib/ui";

export type GanttHandle = { scrollToday: (smooth: boolean) => void };

type Props = {
  ref?: React.Ref<GanttHandle>;
  tasks: Task[];
  filtered: Task[];
  frentes: Frente[];
  respName: (id: string | null) => string;
  filtersOn: boolean;
  ppd: number;
  today: number;
  canWrite: boolean;
  selected: string | null;
  onOpenTask: (id: string | null, presetFrente?: string) => void;
  onNewFrente: () => void;
  onReschedule: (t: Task, inicio: string, fin: string) => Promise<boolean>;
};

type Drag = { t: Task; mode: "move" | "l" | "r"; x0: number; s: number; f: number; dd: number; moved: boolean };

function computeRange(tasks: Task[], today: number) {
  let s = today;
  let e = today;
  for (const t of tasks) {
    s = Math.min(s, pd(t.inicio));
    e = Math.max(e, pd(t.fin));
  }
  const ds = new Date(s);
  const de = new Date(e);
  return { s: Date.UTC(ds.getUTCFullYear(), ds.getUTCMonth(), 1), e: Date.UTC(de.getUTCFullYear(), de.getUTCMonth() + 1, 0) };
}

export default function Gantt(props: Props) {
  const { ref, tasks, filtered, frentes, respName, filtersOn, ppd, today, canWrite, selected, onOpenTask, onNewFrente, onReschedule } = props;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const [preview, setPreview] = useState<{ id: string; s: number; f: number } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const RANGE = computeRange(tasks, today);

  useImperativeHandle(ref, () => ({
    scrollToday(smooth) {
      const g = box.current;
      if (!g) return;
      const left = parseFloat(getComputedStyle(g).getPropertyValue("--left")) || 400;
      const x = ((today - RANGE.s) / DAY) * ppd;
      g.scrollTo({ left: Math.max(0, x - (g.clientWidth - left) * 0.3), behavior: smooth ? "smooth" : "auto" });
    },
  }));

  if (!tasks.length && !frentes.length)
    return (
      <div className={ui.panel}>
        <div className={ui.emptyState}>
          <b className={ui.emptyTitle}>Aún no hay actividades</b>
          <span>Crea un frente y agrega la primera actividad con “+ Actividad”.</span>
        </div>
      </div>
    );

  const days = (RANGE.e - RANGE.s) / DAY + 1;
  const W = days * ppd;
  const dow = new Date(RANGE.s).getUTCDay();
  const firstMon = (8 - dow) % 7;

  const months: React.ReactNode[] = [];
  for (let d = new Date(RANGE.s); d.getTime() <= RANGE.e; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const x = ((d.getTime() - RANGE.s) / DAY) * ppd;
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    months.push(
      <span key={d.getTime()} className={cn(HEAD_CELL, "font-bold uppercase tracking-[.1em] text-muted")} style={{ left: x, width: last * ppd }}>
        {ppd < 6 ? MES[d.getUTCMonth()] : `${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`}
      </span>,
    );
  }
  const step = ppd >= 20 ? 1 : 7;
  const weeks: React.ReactNode[] = [];
  for (let i = step === 7 ? firstMon : 0; i < days; i += step) {
    if (ppd < 6 && step === 7 && (i - firstMon) % 14) continue;
    const dd = new Date(RANGE.s + i * DAY);
    weeks.push(
      <span key={i} className={cn(HEAD_CELL, "font-mono text-[10.5px] text-dim")} style={{ left: i * ppd }}>
        {dd.getUTCDate()}
        {step === 1 ? "" : ` ${MES[dd.getUTCMonth()]}`}
      </span>,
    );
  }

  /* ---------- arrastrar para reprogramar ---------- */
  function onPointerDown(e: React.PointerEvent) {
    if (!canWrite) return;
    const h = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
    if (!h) return;
    const row = h.closest<HTMLElement>("[data-task]");
    const t = tasks.find((x) => x.id === row?.dataset.task);
    if (!t) return;
    const bar = h.dataset.drag === "move" ? h : h.parentElement!;
    drag.current = { t, mode: h.dataset.drag as Drag["mode"], x0: e.clientX, s: pd(t.inicio), f: pd(t.fin), dd: 0, moved: false };
    bar.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dd = Math.round((e.clientX - d.x0) / ppd);
    if (dd === d.dd) return;
    d.dd = dd;
    d.moved = true;
    let s = d.s;
    let f = d.f;
    if (d.mode === "move") {
      s += dd * DAY;
      f += dd * DAY;
    } else if (d.mode === "l") s = Math.min(d.s + dd * DAY, f);
    else f = Math.max(d.f + dd * DAY, s);
    setPreview({ id: d.t.id, s, f });
  }
  async function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    const p = preview;
    if (!p || (p.s === d.s && p.f === d.f)) {
      setPreview(null);
      return;
    }
    await onReschedule(d.t, fmt(p.s), fmt(p.f));
    setPreview(null);
  }

  function onClick(e: React.MouseEvent) {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    const el = e.target as HTMLElement;
    const ad = el.closest<HTMLElement>("[data-addf]");
    if (ad) return onOpenTask(null, ad.dataset.addf);
    if (el.closest("[data-newfr]")) return onNewFrente();
    const gr = el.closest<HTMLElement>("[data-group]");
    if (gr && el.closest("[data-left]")) {
      const id = gr.dataset.group!;
      setClosed((c) => {
        const n = new Set(c);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    const r = el.closest<HTMLElement>("[data-task]");
    if (r) onOpenTask(r.dataset.task!);
  }

  const rows: React.ReactNode[] = [];
  if (filtersOn && !filtered.length)
    rows.push(
      <div className={ui.emptyState} key="noresults">
        <b className={ui.emptyTitle}>Sin resultados</b>
        <span>Ningún resultado con estos filtros.</span>
      </div>,
    );

  for (const fd of frentes) {
    const ts = filtered.filter((t) => t.frente_id === fd.id).sort((a, b) => (a.num || 0) - (b.num || 0));
    if (!ts.length && filtersOn) continue;
    const all = tasks.filter((t) => t.frente_id === fd.id);
    const c = all.filter((t) => t.estado === "Cerrada").length;
    const isC = closed.has(fd.id);
    let span: React.ReactNode = null;
    if (ts.length) {
      const gs = Math.min(...ts.map((t) => pd(t.inicio)));
      const ge = Math.max(...ts.map((t) => pd(t.fin)));
      span = (
        <div
          className="absolute top-[19px] h-1.5 rounded-full opacity-60 shadow-[0_0_10px_var(--c)]"
          style={{ background: fd.color, "--c": fd.color, left: ((gs - RANGE.s) / DAY) * ppd, width: ((ge - gs) / DAY + 1) * ppd } as React.CSSProperties}
        />
      );
    }
    rows.push(
      <div className={cn(ROW, "h-(--rowh)")} data-group={fd.id} key={`g-${fd.id}`}>
        <div
          data-left
          className={cn(LEFT, "cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto]! border-line bg-surface-2 font-bold")}
          style={{ boxShadow: `inset 3px 0 0 ${fd.color}` }}
          role="button"
          tabIndex={0}
          aria-expanded={!isC}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.target as HTMLElement).click();
            }
          }}
        >
          <span className={cn("inline-block text-muted transition-transform", isC && "-rotate-90")}>▾</span>
          <i className="inline-block size-2.5 rounded-[3px]" style={{ background: fd.color, boxShadow: `0 0 8px ${fd.color}` }} />
          <span className="truncate">{fd.nombre}</span>
          <span className="font-mono text-xs font-medium text-muted">
            {c}/{all.length}
          </span>
        </div>
        <div className={cn(TL, "border-line bg-surface-2 bg-none!")}>{span}</div>
      </div>,
    );
    if (isC) continue;

    for (const t of ts) {
      const pv = preview?.id === t.id ? preview : null;
      const s = pv ? pv.s : pd(t.inicio);
      const f = pv ? pv.f : pd(t.fin);
      const x = ((s - RANGE.s) / DAY) * ppd;
      const w = ((f - s) / DAY + 1) * ppd;
      const late = isLate(t, today);
      const one = dur(t) === 1 && !pv;
      const label = pv
        ? human(s) + (f !== s ? ` → ${human(f)}` : "")
        : late
          ? `${Math.round((today - pd(t.fin)) / DAY)} d tarde`
          : t.estado === "Cerrada"
            ? "✓"
            : `${+t.avance || 0}%`;
      const shape = one ? (
        <>
          <div
            className={cn(
              "absolute top-[13px] size-[18px] rotate-45 cursor-grab touch-none rounded-[3px] border-2 border-surface",
              t.estado === "Cerrada" ? "bg-ok shadow-[0_0_0_1.5px_var(--ok)]" : late ? "bg-late shadow-[0_0_0_1.5px_var(--late),0_0_12px_rgba(255,90,95,.5)]" : "bg-mile shadow-[0_0_0_1.5px_var(--mile),0_0_12px_rgba(243,177,22,.5)]",
            )}
            data-drag="move"
            style={{ left: x + w / 2 - 9 }}
            title={`${t.actividad} · ${human(s)}`}
          />
          <span className={cn(BLABEL, late && "font-medium text-late")} style={{ left: x + w / 2 + 14 }}>
            {human(s)}
            {late ? ` · ${label}` : ""}
          </span>
        </>
      ) : (
        <>
          <div
            className={cn(
              "absolute top-[11px] h-[22px] min-w-1.5 cursor-grab touch-none overflow-hidden rounded-full",
              BAR[t.estado],
              late && !pv && "bg-late-soft-stripes shadow-[inset_0_0_0_1.5px_var(--late),0_0_12px_rgba(255,90,95,.3)]",
              pv && "z-[2] cursor-grabbing shadow-[0_4px_14px_rgba(0,0,0,.35)]",
            )}
            data-drag="move"
            style={{ left: x, width: w }}
            title={`${t.actividad} · ${human(s)} → ${human(f)}`}
          >
            <div className={cn("absolute inset-y-0 left-0 rounded-full", FILL[t.estado])} style={{ width: `${late ? 0 : +t.avance || 0}%` }} />
            <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" data-drag="l" />
            <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" data-drag="r" />
          </div>
          <span className={cn(BLABEL, late && !pv && "font-medium text-late")} style={{ left: x + w + 6 }}>
            {label}
          </span>
        </>
      );
      rows.push(
        <div className={cn(ROW, "group h-(--rowh) cursor-pointer")} data-task={t.id} key={t.id}>
          <div className={cn(LEFT, "group-hover:bg-[color-mix(in_srgb,var(--color-brand)_7%,var(--surface))]", selected === t.id && "shadow-[inset_3px_0_0_var(--color-brand)]")}>
            <span className="font-mono text-xs text-muted">{t.num ?? ""}</span>
            <span className="flex min-w-0 flex-col">
              <b className="truncate font-bold">{t.actividad}</b>
              <small className="truncate text-xs text-muted">{respName(t.responsable_id) || "Sin responsable"}</small>
            </span>
            <span className={cn("inline-flex items-center gap-[5px] justify-self-start rounded-full border px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current before:content-[''] max-md:hidden", estadoPill[late ? "late" : t.estado])}>
              {late ? "Atrasada" : t.estado}
            </span>
            <span className="text-right font-mono text-xs tabular-nums max-md:hidden">{+t.avance || 0}%</span>
          </div>
          <div className={cn(TL, "group-hover:bg-[color-mix(in_srgb,var(--color-brand)_7%,var(--surface))]")}>{shape}</div>
        </div>,
      );
    }

    if (canWrite)
      rows.push(
        <div className={cn(ROW, "h-[34px]")} key={`a-${fd.id}`}>
          <div className={cn(LEFT, "grid-cols-1!")}>
            <button className={ADDROW} data-addf={fd.id}>
              + Agregar actividad{ts.length ? "" : " a este frente"}
            </button>
          </div>
          <div className={cn(TL, "bg-none")} />
        </div>,
      );
    else if (!ts.length)
      rows.push(
        <div className={cn(ROW, "h-[34px]")} key={`a-${fd.id}`}>
          <div className={cn(LEFT, "grid-cols-1! text-[12.5px] text-muted")}>Sin actividades aún</div>
          <div className={cn(TL, "bg-none")} />
        </div>,
      );
  }

  if (!filtersOn && canWrite)
    rows.push(
      <div className={cn(ROW, "h-[34px]")} key="newfr">
        <div className={cn(LEFT, "grid-cols-1!")}>
          <button className={ADDROW} data-newfr>
            + Nuevo frente
          </button>
        </div>
        <div className={cn(TL, "bg-none")} />
      </div>,
    );

  const tx = ((today - RANGE.s) / DAY) * ppd + ppd / 2;

  return (
    <div
      className="scrollbar-thin relative max-h-[calc(100vh-140px)] min-h-60 overflow-auto rounded-2xl border border-line bg-surface [--left:200px] [--rowh:46px] md:[--left:400px] md:[--rowh:44px]"
      ref={box}
      style={{ "--tlw": `${W}px`, "--wk": `${7 * ppd}px`, "--wkoff": `${firstMon * ppd}px` } as React.CSSProperties}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="relative w-max min-w-full">
        <div className={cn(ROW, "sticky top-0 z-[5]")}>
          <div className={cn(LEFT, "z-[6] h-[52px] border-line bg-surface-2 text-[11px] font-bold uppercase tracking-[.08em] text-dim")}>
            <span>ID</span>
            <span>Actividad · responsable</span>
            <span className="max-md:hidden">Estado</span>
            <span className="text-right max-md:hidden">%</span>
          </div>
          <div className={cn(TL, "h-[52px] border-line bg-surface-2 bg-none!")}>
            <div className="absolute inset-x-0 top-0 h-[26px]">{months}</div>
            <div className="absolute inset-x-0 top-[26px] h-[26px]">{weeks}</div>
          </div>
        </div>
        {rows}
        <div
          className="pointer-events-none absolute inset-y-0 z-[1] w-0.5 bg-cyan shadow-[0_0_12px_var(--color-cyan)] before:absolute before:top-[30px] before:left-1 before:rounded before:bg-cyan before:px-[5px] before:py-[3px] before:font-mono before:text-[10px] before:leading-none before:font-semibold before:tracking-[.06em] before:text-[#04121f] before:content-['HOY']"
          style={{ left: `calc(var(--left) + ${tx}px)` }}
        />
      </div>
    </div>
  );
}

/* ---------- clases ---------- */
const ROW = "grid grid-cols-[var(--left)_var(--tlw)]";
const LEFT =
  "sticky left-0 z-[3] grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2 border-r border-b border-r-line border-b-grid bg-surface px-2 md:grid-cols-[34px_minmax(0,1fr)_96px_46px] md:px-3";
const TL = "bg-gantt-weeks relative border-b border-grid";
const HEAD_CELL = "absolute top-0 flex h-[26px] items-center border-l border-line pl-1.5 text-[11px] whitespace-nowrap";
const BLABEL = "pointer-events-none absolute top-[13px] font-mono text-[11.5px] whitespace-nowrap text-muted";
const ADDROW =
  "justify-self-start rounded-md border border-dashed border-line px-2.5 py-1 text-[12.5px] font-bold text-link transition hover:border-brand hover:bg-accent-soft";
const BAR: Record<Task["estado"], string> = {
  Cerrada: "bg-ok/15 shadow-[inset_0_0_0_1.5px_var(--ok)]",
  "En curso": "bg-run/15 shadow-[inset_0_0_0_1.5px_var(--run)]",
  Pendiente: "bg-todo/15 shadow-[inset_0_0_0_1.5px_var(--todo)]",
};
const FILL: Record<Task["estado"], string> = {
  Cerrada: "bg-ok",
  "En curso": "bg-linear-to-r from-run to-[color-mix(in_srgb,var(--run)_70%,#fff)] shadow-[0_0_12px_rgba(0,148,255,.6)]",
  Pendiente: "bg-todo",
};
