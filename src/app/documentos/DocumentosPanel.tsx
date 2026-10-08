"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { portadaDeArchivo, subirFirmado } from "@/lib/pdf-cover";
import { cn, ui } from "@/lib/ui";
import {
  confirmarSubida,
  crearCategoria,
  eliminarCategoria,
  eliminarDocumento,
  listarDocumentos,
  prepararSubida,
  renombrarCategoria,
  type Categoria,
  type Documento,
  type ListaDocumentos,
} from "./actions";

const MAX = 50 * 1024 * 1024;
const POLL_MS = 30000;
const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium" });
const esHtml = (archivo: string) => archivo.endsWith(".html");
const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function DocumentosPanel({ initial, isAdmin }: { initial: ListaDocumentos; isAdmin: boolean }) {
  const [lista, setLista] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState("");

  // Actualización automática: los documentos nuevos aparecen sin recargar.
  const refrescar = useCallback(async () => {
    const r = await listarDocumentos().catch(() => null);
    if (r?.ok) setLista(r.data);
  }, []);
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refrescar();
    const iv = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refrescar]);

  const vistos = useMemo(() => new Set(lista.vistos), [lista.vistos]);
  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of lista.docs) c[d.categoria] = (c[d.categoria] ?? 0) + 1;
    return c;
  }, [lista.docs]);
  // Los lectores solo ven las categorías que tienen documentos; los administradores, todas (para gestionarlas).
  const categorias = isAdmin ? lista.categorias : lista.categorias.filter((c) => conteo[c.nombre]);
  const filtroActivo = cat && lista.categorias.some((c) => c.nombre === cat) ? cat : "";
  const filtrados = lista.docs.filter((d) => (!filtroActivo || d.categoria === filtroActivo) && (!q.trim() || `${d.titulo} ${d.descripcion}`.toLowerCase().includes(q.trim().toLowerCase())));
  const nuevos = lista.docs.filter((d) => !vistos.has(d.id)).length;

  async function eliminar(id: string) {
    const r = await eliminarDocumento(id);
    if (!r.ok) return setMsg(r.error);
    setLista((l) => ({ ...l, docs: l.docs.filter((x) => x.id !== id) }));
  }

  return (
    <>
      {isAdmin && (
        <Subida
          categorias={lista.categorias}
          onSubido={(d) => {
            setLista((l) => ({ ...l, docs: [d, ...l.docs] }));
            setMsg("");
          }}
        />
      )}

      <div className={cn(ui.panel, "flex flex-wrap items-center gap-2.5 p-2.5")}>
        <input className={cn(ui.field, "flex-[1_1_220px] md:max-w-[320px]")} type="search" placeholder="Buscar documento…" aria-label="Buscar documento" value={q} onChange={(e) => setQ(e.target.value)} />
        <Filtros
          categorias={categorias}
          conteo={conteo}
          total={lista.docs.length}
          activo={filtroActivo}
          onElegir={setCat}
          isAdmin={isAdmin}
          onCambio={(renombre) => {
            if (renombre && renombre.antes === cat) setCat(renombre.despues);
            refrescar();
          }}
        />
        <span className="flex-1" />
        {nuevos > 0 && <span className="rounded-full bg-cyan/15 px-2.5 py-1 text-xs font-bold text-cyan">{nuevos} sin abrir</span>}
        <span className="font-mono text-xs text-muted">
          {filtrados.length} documento{filtrados.length === 1 ? "" : "s"}
        </span>
      </div>

      {msg && (
        <p className="m-0 font-bold text-late" role="alert">
          {msg}
        </p>
      )}

      {filtrados.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {filtrados.map((d, i) => (
            <Tarjeta key={d.id} d={d} i={i} nuevo={!vistos.has(d.id)} vistas={isAdmin ? (lista.vistas[d.id] ?? 0) : null} onEliminar={isAdmin ? () => eliminar(d.id) : undefined} />
          ))}
        </div>
      ) : (
        <div className={cn(ui.panel, ui.emptyState)}>
          <b className={ui.emptyTitle}>{lista.docs.length ? "Sin resultados" : "Aún no hay documentos"}</b>
          <span>{lista.docs.length ? "Ningún documento coincide con la búsqueda." : isAdmin ? "Sube el primero con el formulario de arriba." : "Cuando se carguen documentos aparecerán aquí."}</span>
        </div>
      )}
    </>
  );
}

/* ---------- Filtros por categoría (los administradores los crean, renombran y eliminan) ---------- */
const chip = "rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-muted transition hover:border-brand";
const chipActivo = "aria-pressed:border-transparent aria-pressed:bg-linear-to-r aria-pressed:from-brand aria-pressed:to-indigo aria-pressed:text-white";

function Filtros({
  categorias,
  conteo,
  total,
  activo,
  onElegir,
  isAdmin,
  onCambio,
}: {
  categorias: Categoria[];
  conteo: Record<string, number>;
  total: number;
  activo: string;
  onElegir: (c: string) => void;
  isAdmin: boolean;
  onCambio: (renombre?: { antes: string; despues: string }) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState("");

  if (!editando)
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button aria-pressed={!activo} onClick={() => onElegir("")} className={cn(chip, chipActivo)}>
          Todas <span className="font-mono text-[11px] opacity-70">{total}</span>
        </button>
        {categorias.map((c) => (
          <button key={c.id} aria-pressed={activo === c.nombre} onClick={() => onElegir(c.nombre)} className={cn(chip, chipActivo)}>
            {c.nombre} <span className="font-mono text-[11px] opacity-70">{conteo[c.nombre] ?? 0}</span>
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setEditando(true)} className={cn(chip, "border-dashed")} title="Crear, renombrar o eliminar filtros">
            ✎ Editar filtros
          </button>
        )}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categorias.map((c) => (
        <ChipEditable key={c.id} c={c} n={conteo[c.nombre] ?? 0} onError={setMsg} onCambio={onCambio} />
      ))}
      <NuevaCategoria onError={setMsg} onCambio={onCambio} />
      <button
        onClick={() => {
          setEditando(false);
          setMsg("");
        }}
        className={ui.btnPrimary}
      >
        Listo
      </button>
      {msg && (
        <span className="text-[13px] font-bold text-late" role="alert">
          {msg}
        </span>
      )}
    </div>
  );
}

function ChipEditable({ c, n, onError, onCambio }: { c: Categoria; n: number; onError: (m: string) => void; onCambio: (renombre?: { antes: string; despues: string }) => void }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [armado, setArmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const fija = c.nombre === "General";

  async function guardar() {
    const n2 = nombre.trim();
    if (!n2 || n2 === c.nombre) return setNombre(c.nombre);
    setOcupado(true);
    const r = await renombrarCategoria(c.id, n2);
    setOcupado(false);
    if (!r.ok) {
      setNombre(c.nombre);
      return onError(r.error);
    }
    onError("");
    onCambio({ antes: c.nombre, despues: r.data.nombre });
  }

  async function eliminar() {
    setOcupado(true);
    const r = await eliminarCategoria(c.id);
    setOcupado(false);
    if (!r.ok) return onError(r.error);
    onError("");
    onCambio();
  }

  if (fija)
    return (
      <span className={cn(chip, "cursor-default opacity-70")} title="Categoría por defecto: no se puede renombrar ni eliminar">
        {c.nombre} <span className="font-mono text-[11px]">{n}</span>
      </span>
    );

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-brand/50 bg-surface-2 py-1 pr-1 pl-2.5", ocupado && "opacity-60")}>
      <input
        className="w-[max(6ch,var(--w))] bg-transparent text-[13px] font-bold text-fg outline-none"
        style={{ "--w": `${nombre.length + 1}ch` } as React.CSSProperties}
        value={nombre}
        maxLength={60}
        disabled={ocupado}
        aria-label={`Nombre de la categoría ${c.nombre}`}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setNombre(c.nombre);
        }}
      />
      <button
        onClick={() => (armado ? eliminar() : setArmado(true))}
        onBlur={() => setArmado(false)}
        disabled={ocupado}
        className={cn(
          "grid min-w-6 place-items-center rounded-full font-bold transition",
          armado ? "h-6 bg-late px-2 text-[12px] text-white" : "size-6 text-[18px] leading-none text-muted hover:bg-late/15 hover:text-late",
        )}
        title={n ? `Sus ${n} documento${n === 1 ? "" : "s"} pasarán a General` : undefined}
        aria-label={armado ? `Confirmar eliminación de ${c.nombre}` : `Eliminar ${c.nombre}`}
      >
        {armado ? (n ? `¿Eliminar? ${n} doc. → General` : "¿Eliminar?") : "×"}
      </button>
    </span>
  );
}

function NuevaCategoria({ onError, onCambio }: { onError: (m: string) => void; onCambio: () => void }) {
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || ocupado) return;
    setOcupado(true);
    const r = await crearCategoria(nombre);
    setOcupado(false);
    if (!r.ok) return onError(r.error);
    onError("");
    setNombre("");
    onCambio();
  }

  return (
    <form onSubmit={crear} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line bg-surface-2 py-1 pr-1 pl-2.5 focus-within:border-brand">
      <input className="w-32 bg-transparent text-[13px] font-bold text-fg outline-none placeholder:text-dim" placeholder="Nuevo filtro…" maxLength={60} value={nombre} disabled={ocupado} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del nuevo filtro" />
      <button type="submit" disabled={!nombre.trim() || ocupado} className="rounded-full bg-brand px-2 text-[12px] font-bold text-white disabled:opacity-40">
        + Crear
      </button>
    </form>
  );
}

/* ---------- Tarjeta con la portada de fondo ---------- */
function Tarjeta({ d, i, nuevo, vistas, onEliminar }: { d: Documento; i: number; nuevo: boolean; vistas: number | null; onEliminar?: () => void }) {
  const [armado, setArmado] = useState(false);
  return (
    <article className="group relative isolate aspect-[3/4] animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_18px_40px_rgba(0,148,255,.22)]" style={{ animationDelay: `${i * 0.05}s` }}>
      {/* portada (o miniatura en vivo si es HTML) o, si no hay, un fondo de marca */}
      {esHtml(d.archivo) ? (
        <MiniaturaHtml id={d.id} />
      ) : d.portada ? (
        <div className="absolute inset-0 -z-10 bg-white bg-cover bg-top transition duration-700 group-hover:scale-105" style={{ backgroundImage: `url(/documentos/${d.id}/portada)` }} aria-hidden="true" />
      ) : (
        <div className="absolute inset-0 -z-10 grid place-items-center bg-linear-to-br from-brand/30 via-surface-2 to-indigo/40" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="72" height="72" className="text-sky/50">
            {esHtml(d.archivo) ? (
              <path fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h18v12H3zM12 16v4m-4 0h8M9.5 8 7.5 10l2 2m5-4 2 2-2 2" />
            ) : (
              <path fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5" />
            )}
          </svg>
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-[#070a16] via-[#070a16]/70 via-45% to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 -z-10 h-16 bg-linear-to-b from-black/45 to-transparent" aria-hidden="true" />

      {/* esquina superior */}
      <div className="absolute inset-x-3 top-3 flex items-start gap-2">
        {nuevo && <span className="rounded-full bg-cyan px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.1em] text-[#04121f] shadow-[0_0_14px_rgba(0,225,255,.6)]">Nuevo</span>}
        <span className="flex-1" />
        {vistas !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur" title="Visualizaciones">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            {vistas}
          </span>
        )}
        {onEliminar && (
          <button
            onClick={() => (armado ? onEliminar() : setArmado(true))}
            onBlur={() => setArmado(false)}
            className={cn(
              "relative z-10 rounded-full px-2 py-0.5 text-[11px] font-bold backdrop-blur transition",
              armado ? "bg-late text-white" : "bg-black/55 text-white/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
            aria-label={armado ? `Confirmar eliminación de ${d.titulo}` : `Eliminar ${d.titulo}`}
          >
            {armado ? "¿Eliminar?" : "Eliminar"}
          </button>
        )}
      </div>

      {/* contenido inferior */}
      <div className="absolute inset-x-0 bottom-0 grid gap-1.5 p-4 text-white">
        <span className="justify-self-start rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.12em] backdrop-blur">{d.categoria}</span>
        <h2 className="m-0 line-clamp-2 font-display text-lg leading-tight font-semibold tracking-tight" title={d.titulo}>
          {d.titulo}
        </h2>
        {d.descripcion && <p className="m-0 line-clamp-2 text-xs text-white/70">{d.descripcion}</p>}
        <span className="font-mono text-[11px] text-white/60">
          {fecha.format(new Date(d.created_at))} · {peso(d.tamano)} · {esHtml(d.archivo) ? "HTML" : "PDF"}
        </span>
        <Link
          href={`/documentos/${d.id}`}
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-white/10 py-2 text-[13px] font-bold text-white ring-1 ring-white/20 backdrop-blur transition group-hover:bg-brand group-hover:ring-transparent after:absolute after:inset-0 after:content-['']"
        >
          {esHtml(d.archivo) ? "Abrir presentación" : "Abrir documento"}
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}

/* ---------- Miniatura en vivo de una presentación HTML ---------- */
const VIEWPORT = 1100; // ancho al que se dibuja la presentación antes de reducirla al tamaño de la tarjeta

function MiniaturaHtml({ id }: { id: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [cargada, setCargada] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = tam ? tam.w / VIEWPORT : 0;
  return (
    <div ref={caja} className="absolute inset-0 -z-10 overflow-hidden bg-linear-to-br from-brand/30 via-surface-2 to-indigo/40" aria-hidden="true">
      {tam && (
        <iframe
          src={`/documentos/${id}/miniatura`}
          title=""
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          onLoad={() => setCargada(true)}
          className={cn("pointer-events-none origin-top-left border-0 bg-white transition-opacity duration-700", cargada ? "opacity-100" : "opacity-0")}
          style={{ width: VIEWPORT, height: tam.h / k, transform: `scale(${k})` }}
        />
      )}
    </div>
  );
}

/* ---------- Formulario de subida (solo administradores) ---------- */
const tipoArchivo = (f: File) => {
  const n = f.name.toLowerCase();
  if (f.type === "application/pdf" || n.endsWith(".pdf")) return "pdf" as const;
  if (f.type === "text/html" || n.endsWith(".html") || n.endsWith(".htm")) return "html" as const;
  return null;
};

function Subida({ categorias, onSubido }: { categorias: Categoria[]; onSubido: (d: Documento) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [portada, setPortada] = useState<{ blob: Blob; url: string } | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [estado, setEstado] = useState<{ fase: "" | "subiendo" | "verificando"; pct: number }>({ fase: "", pct: 0 });
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (portada) URL.revokeObjectURL(portada.url);
    },
    [portada],
  );

  async function elegir(f: File | undefined) {
    setMsg("");
    if (!f) return;
    if (!tipoArchivo(f)) return setMsg("Solo se pueden subir archivos PDF o HTML.");
    if (f.size > MAX) return setMsg("El archivo debe pesar como máximo 50 MB.");
    setFile(f);
    setPortada(null);
    if (!titulo) setTitulo(f.name.replace(/\.(pdf|html?)$/i, "").replace(/[_-]+/g, " ").trim());
    if (tipoArchivo(f) !== "pdf") return;
    const blob = await portadaDeArchivo(f);
    if (blob) setPortada({ blob, url: URL.createObjectURL(blob) });
  }

  function limpiar() {
    setFile(null);
    setPortada(null);
    setTitulo("");
    setDescripcion("");
    if (input.current) input.current.value = "";
  }

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!file || estado.fase) return;
    setMsg("");
    setEstado({ fase: "subiendo", pct: 0 });
    const prep = await prepararSubida(file.size, tipoArchivo(file) ?? "pdf");
    if (!prep.ok) {
      setEstado({ fase: "", pct: 0 });
      return setMsg(prep.error);
    }
    // Tipo explícito: algunos sistemas no lo informan y el bucket solo acepta PDF y HTML.
    const tipo = tipoArchivo(file) === "html" ? "text/html" : "application/pdf";
    const okArchivo = await subirFirmado(prep.data.url, new File([file], file.name, { type: tipo }), (pct) => setEstado({ fase: "subiendo", pct }));
    if (!okArchivo) {
      setEstado({ fase: "", pct: 0 });
      return setMsg("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
    }
    const okPortada = portada ? await subirFirmado(prep.data.portadaUrl, portada.blob) : false;
    setEstado({ fase: "verificando", pct: 100 });
    const cat = categorias.some((c) => c.nombre === categoria) ? categoria : "General";
    const r = await confirmarSubida({ path: prep.data.path, portada: okPortada ? prep.data.portadaPath : null, titulo, descripcion, categoria: cat });
    setEstado({ fase: "", pct: 0 });
    if (!r.ok) return setMsg(r.error);
    onSubido(r.data);
    limpiar();
  }

  return (
    <form className={cn(ui.panel, "grid gap-3 p-4")} onSubmit={subir}>
      <p className={ui.eyebrow}>Subir documento</p>
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            elegir(e.dataTransfer.files[0]);
          }}
          className={cn(
            "relative grid aspect-[3/4] cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-surface-2 text-center transition hover:border-brand max-lg:max-w-[200px]",
            drag && "border-brand bg-accent-soft",
            portada && "border-solid border-brand/60",
          )}
        >
          {portada ? (
            <span className="absolute inset-0 animate-fade-in bg-white bg-cover bg-top" style={{ backgroundImage: `url(${portada.url})` }} aria-hidden="true" />
          ) : (
            <span className="grid justify-items-center gap-1.5 p-4">
              <svg viewBox="0 0 24 24" width="28" height="28" className="text-brand" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
              </svg>
              <b className="text-sm">{!file ? "Arrastra un PDF o HTML, o haz clic" : tipoArchivo(file) === "html" ? "Presentación HTML" : "Generando portada…"}</b>
              <small className="text-xs text-muted">PDF o HTML · máximo 50 MB</small>
            </span>
          )}
          {file && <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-[11px] text-white">{file.name} · {peso(file.size)}</span>}
          <input ref={input} type="file" accept="application/pdf,.pdf,text/html,.html,.htm" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
        </label>
        <div className="grid content-start gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className={ui.label}>
              Título
              <input className={ui.fieldFull} required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Manual de marca MATERAN" />
            </label>
            <label className={ui.label}>
              Categoría
              <select className={ui.fieldFull} required value={categorias.some((c) => c.nombre === categoria) ? categoria : "General"} onChange={(e) => setCategoria(e.target.value)}>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={ui.label}>
            <span>
              Descripción <small className="font-normal">(opcional)</small>
            </span>
            <textarea className={cn(ui.fieldFull, "min-h-20 resize-y")} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué sirve o qué versión es" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className={ui.btnPrimary} type="submit" disabled={!file || !!estado.fase}>
              {estado.fase && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {estado.fase === "subiendo" ? `Subiendo… ${estado.pct}%` : estado.fase === "verificando" ? "Verificando…" : "Subir documento"}
            </button>
            {file && !estado.fase && (
              <button type="button" className={ui.btn} onClick={limpiar}>
                Quitar
              </button>
            )}
            {estado.fase && (
              <span className="relative h-1.5 w-48 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-brand to-cyan transition-[width]" style={{ width: `${estado.pct}%` }} />
              </span>
            )}
            {msg && (
              <span className="text-[13px] font-bold text-late" role="alert">
                {msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
