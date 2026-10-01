"use client";

import { useImperativeHandle, useRef, useState } from "react";
import { DAY, dur, fmt, human, isLate, MES, pd, sk } from "@/lib/gantt";
import type { Frente, Task } from "@/lib/gantt";

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
      <div className="gantt">
        <div className="empty">
          <b>Aún no hay actividades</b>
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
      <span key={d.getTime()} style={{ left: x, width: last * ppd }}>
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
      <span key={i} style={{ left: i * ppd }}>
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
    const row = h.closest<HTMLElement>(".g-task");
    const t = tasks.find((x) => x.id === row?.dataset.id);
    if (!t) return;
    const bar = h.classList.contains("h") ? h.parentElement! : h;
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
    const gr = el.closest<HTMLElement>(".g-group");
    if (gr && el.closest(".g-left")) {
      const id = gr.dataset.g!;
      setClosed((c) => {
        const n = new Set(c);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    const r = el.closest<HTMLElement>(".g-task");
    if (r) onOpenTask(r.dataset.id!);
  }

  const rows: React.ReactNode[] = [];
  if (filtersOn && !filtered.length)
    rows.push(
      <div className="empty" key="noresults">
        <b>Sin resultados</b>
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
          style={{
            position: "absolute",
            top: 19,
            height: 6,
            borderRadius: 3,
            background: fd.color,
            opacity: 0.55,
            left: ((gs - RANGE.s) / DAY) * ppd,
            width: ((ge - gs) / DAY + 1) * ppd,
          }}
        />
      );
    }
    rows.push(
      <div className={`g-row g-group ${isC ? "closed" : ""}`} data-g={fd.id} key={`g-${fd.id}`}>
        <div
          className="g-left"
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
          <span className="caret">▾</span>
          <i className="tag" style={{ background: fd.color }} />
          <span className="gname">{fd.nombre}</span>
          <span className="gmeta">
            {c}/{all.length}
          </span>
        </div>
        <div className="g-tl">{span}</div>
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
            className={`mile ${t.estado === "Cerrada" ? "done" : ""} ${late ? "late" : ""}`}
            data-drag="move"
            style={{ left: x + w / 2 - 9 }}
            title={`${t.actividad} · ${human(s)}`}
          />
          <span className={`blabel ${late ? "lt" : ""}`} style={{ left: x + w / 2 + 14 }}>
            {human(s)}
            {late ? ` · ${label}` : ""}
          </span>
        </>
      ) : (
        <>
          <div
            className={`bar b-${sk(t.estado)} ${late && !pv ? "late" : ""} ${pv ? "dragging" : ""}`}
            data-drag="move"
            style={{ left: x, width: w }}
            title={`${t.actividad} · ${human(s)} → ${human(f)}`}
          >
            <div className="fill" style={{ width: `${late ? 0 : +t.avance || 0}%` }} />
            <span className="h l" data-drag="l" />
            <span className="h r" data-drag="r" />
          </div>
          <span className={`blabel ${late && !pv ? "lt" : ""}`} style={{ left: x + w + 6 }}>
            {label}
          </span>
        </>
      );
      rows.push(
        <div className={`g-row g-task ${selected === t.id ? "sel" : ""}`} data-id={t.id} key={t.id}>
          <div className="g-left">
            <span className="num">{t.num ?? ""}</span>
            <span className="act">
              <b>{t.actividad}</b>
              <small>{respName(t.responsable_id) || "Sin responsable"}</small>
            </span>
            <span className={`pill ${late ? "p-late" : `p-${sk(t.estado)}`}`}>{late ? "Atrasada" : t.estado}</span>
            <span className="pct">{+t.avance || 0}%</span>
          </div>
          <div className="g-tl">{shape}</div>
        </div>,
      );
    }

    if (canWrite)
      rows.push(
        <div className="g-row g-add" key={`a-${fd.id}`}>
          <div className="g-left">
            <button className="addrow" data-addf={fd.id}>
              + Agregar actividad{ts.length ? "" : " a este frente"}
            </button>
          </div>
          <div className="g-tl" />
        </div>,
      );
    else if (!ts.length)
      rows.push(
        <div className="g-row g-add" key={`a-${fd.id}`}>
          <div className="g-left">
            <span className="muted">Sin actividades aún</span>
          </div>
          <div className="g-tl" />
        </div>,
      );
  }

  if (!filtersOn && canWrite)
    rows.push(
      <div className="g-row g-add" key="newfr">
        <div className="g-left">
          <button className="addrow" data-newfr>
            + Nuevo frente
          </button>
        </div>
        <div className="g-tl" />
      </div>,
    );

  const tx = ((today - RANGE.s) / DAY) * ppd + ppd / 2;

  return (
    <div
      className="gantt"
      ref={box}
      style={{ "--tlw": `${W}px`, "--wk": `${7 * ppd}px`, "--wkoff": `${firstMon * ppd}px` } as React.CSSProperties}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="g-inner">
        <div className="g-row g-head">
          <div className="g-left">
            <span>ID</span>
            <span>Actividad · responsable</span>
            <span className="hc">Estado</span>
            <span className="hc" style={{ textAlign: "right" }}>
              %
            </span>
          </div>
          <div className="g-tl">
            <div className="months">{months}</div>
            <div className="weeks">{weeks}</div>
          </div>
        </div>
        {rows}
        <div className="today" style={{ left: `calc(var(--left) + ${tx}px)` }} />
      </div>
    </div>
  );
}
