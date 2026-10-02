"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { portadaDeArchivo, subirFirmado } from "@/lib/pdf-cover";
import { cn, ui } from "@/lib/ui";
import { confirmarSubida, eliminarDocumento, listarDocumentos, prepararSubida, type Documento, type ListaDocumentos } from "./actions";

const MAX = 50 * 1024 * 1024;
const POLL_MS = 30000;
const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium" });
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
  const categorias = useMemo(() => [...new Set(lista.docs.map((d) => d.categoria))].sort((a, b) => a.localeCompare(b, "es")), [lista.docs]);
  const filtrados = lista.docs.filter((d) => (!cat || d.categoria === cat) && (!q.trim() || `${d.titulo} ${d.descripcion}`.toLowerCase().includes(q.trim().toLowerCase())));
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
          categorias={categorias}
          onSubido={(d) => {
            setLista((l) => ({ ...l, docs: [d, ...l.docs] }));
            setMsg("");
          }}
        />
      )}

      <div className={cn(ui.panel, "flex flex-wrap items-center gap-2.5 p-2.5")}>
        <input className={cn(ui.field, "flex-[1_1_220px] md:max-w-[320px]")} type="search" placeholder="Buscar documento…" aria-label="Buscar documento" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {["", ...categorias].map((c) => (
            <button
              key={c || "todas"}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-muted transition hover:border-brand aria-pressed:border-transparent aria-pressed:bg-linear-to-r aria-pressed:from-brand aria-pressed:to-indigo aria-pressed:text-white"
            >
              {c || "Todas"}
            </button>
          ))}
        </div>
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

/* ---------- Tarjeta con la portada de fondo ---------- */
function Tarjeta({ d, i, nuevo, vistas, onEliminar }: { d: Documento; i: number; nuevo: boolean; vistas: number | null; onEliminar?: () => void }) {
  const [armado, setArmado] = useState(false);
  return (
    <article className="group relative isolate aspect-[3/4] animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_18px_40px_rgba(0,148,255,.22)]" style={{ animationDelay: `${i * 0.05}s` }}>
      {/* portada o, si no hay, un fondo de marca */}
      {d.portada ? (
        <div className="absolute inset-0 -z-10 bg-white bg-cover bg-top transition duration-700 group-hover:scale-105" style={{ backgroundImage: `url(/documentos/${d.id}/portada)` }} aria-hidden="true" />
      ) : (
        <div className="absolute inset-0 -z-10 grid place-items-center bg-linear-to-br from-brand/30 via-surface-2 to-indigo/40" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="72" height="72" className="text-sky/50">
            <path fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5" />
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
          {fecha.format(new Date(d.created_at))} · {peso(d.tamano)}
        </span>
        <Link
          href={`/documentos/${d.id}`}
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-white/10 py-2 text-[13px] font-bold text-white ring-1 ring-white/20 backdrop-blur transition group-hover:bg-brand group-hover:ring-transparent after:absolute after:inset-0 after:content-['']"
        >
          Abrir documento
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}

/* ---------- Formulario de subida (solo administradores) ---------- */
function Subida({ categorias, onSubido }: { categorias: string[]; onSubido: (d: Documento) => void }) {
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
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setMsg("Solo se pueden subir archivos PDF.");
    if (f.size > MAX) return setMsg("El PDF debe pesar como máximo 50 MB.");
    setFile(f);
    setPortada(null);
    if (!titulo) setTitulo(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
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
    const prep = await prepararSubida(file.size);
    if (!prep.ok) {
      setEstado({ fase: "", pct: 0 });
      return setMsg(prep.error);
    }
    const okPdf = await subirFirmado(prep.data.url, file, (pct) => setEstado({ fase: "subiendo", pct }));
    if (!okPdf) {
      setEstado({ fase: "", pct: 0 });
      return setMsg("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
    }
    const okPortada = portada ? await subirFirmado(prep.data.portadaUrl, portada.blob) : false;
    setEstado({ fase: "verificando", pct: 100 });
    const r = await confirmarSubida({ path: prep.data.path, portada: okPortada ? prep.data.portadaPath : null, titulo, descripcion, categoria });
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
              <b className="text-sm">{file ? "Generando portada…" : "Arrastra un PDF o haz clic"}</b>
              <small className="text-xs text-muted">Solo PDF · máximo 50 MB</small>
            </span>
          )}
          {file && <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-[11px] text-white">{file.name} · {peso(file.size)}</span>}
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
        </label>
        <div className="grid content-start gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className={ui.label}>
              Título
              <input className={ui.fieldFull} required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Manual de marca MATERAN" />
            </label>
            <label className={ui.label}>
              Categoría
              <input className={ui.fieldFull} list="doc-cats" required maxLength={60} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              <datalist id="doc-cats">
                {["General", "Estrategia", "Marca", "Legal", "Contratos", "Producto", ...categorias]
                  .filter((c, i, a) => a.indexOf(c) === i)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
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
