"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { cn, ui } from "@/lib/ui";
import { confirmarSubida, eliminarDocumento, prepararSubida, type Documento } from "./actions";

const MAX = 50 * 1024 * 1024;
const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium" });
const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Props = { initial: Documento[]; canUpload: boolean; isAdmin: boolean; vistas: Record<string, number> };

export default function DocumentosPanel({ initial, canUpload, isAdmin, vistas }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [estado, setEstado] = useState<{ fase: "" | "subiendo" | "verificando"; pct: number }>({ fase: "", pct: 0 });
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(false);
  const [armado, setArmado] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const categorias = useMemo(() => [...new Set(docs.map((d) => d.categoria))].sort((a, b) => a.localeCompare(b, "es")), [docs]);
  const lista = docs.filter((d) => (!cat || d.categoria === cat) && (!q.trim() || `${d.titulo} ${d.descripcion}`.toLowerCase().includes(q.trim().toLowerCase())));

  function elegir(f: File | undefined) {
    setMsg("");
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setMsg("Solo se pueden subir archivos PDF.");
    if (f.size > MAX) return setMsg("El PDF debe pesar como máximo 50 MB.");
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  }

  /** Sube el archivo directo a Storage con un permiso firmado (sin llaves) mostrando el progreso. */
  function subirArchivo(url: string, f: File) {
    return new Promise<boolean>((resolve) => {
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", f);
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => e.lengthComputable && setEstado({ fase: "subiendo", pct: Math.round((e.loaded / e.total) * 100) });
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(body);
    });
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
    if (!(await subirArchivo(prep.data.url, file))) {
      setEstado({ fase: "", pct: 0 });
      return setMsg("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
    }
    setEstado({ fase: "verificando", pct: 100 });
    const r = await confirmarSubida({ path: prep.data.path, titulo, descripcion, categoria });
    setEstado({ fase: "", pct: 0 });
    if (!r.ok) return setMsg(r.error);
    setDocs((d) => [r.data, ...d]);
    setFile(null);
    setTitulo("");
    setDescripcion("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function eliminar(id: string) {
    if (armado !== id) return setArmado(id);
    setArmado(null);
    const r = await eliminarDocumento(id);
    if (!r.ok) return setMsg(r.error);
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <>
      {canUpload && (
        <form className={cn(ui.panel, "grid gap-3 p-4")} onSubmit={subir}>
          <p className={ui.eyebrow}>Subir documento</p>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)]">
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
                "grid cursor-pointer place-items-center gap-1.5 rounded-xl border-2 border-dashed border-line bg-surface-2 p-5 text-center transition hover:border-brand",
                drag && "border-brand bg-accent-soft",
              )}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" className="text-brand" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
              </svg>
              <b className="text-sm">{file ? file.name : "Arrastra un PDF o haz clic para elegirlo"}</b>
              <small className="text-xs text-muted">{file ? peso(file.size) : "Solo PDF · máximo 50 MB"}</small>
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
                    {["General", "Estrategia", "Marca", "Legal", "Contratos", "Producto", ...categorias].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label className={ui.label}>
                <span>
                  Descripción <small className="font-normal">(opcional)</small>
                </span>
                <input className={ui.fieldFull} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué sirve o qué versión es" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className={ui.btnPrimary} type="submit" disabled={!file || !!estado.fase}>
                  {estado.fase && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                  {estado.fase === "subiendo" ? `Subiendo… ${estado.pct}%` : estado.fase === "verificando" ? "Verificando…" : "Subir documento"}
                </button>
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
        <span className="font-mono text-xs text-muted">
          {lista.length} documento{lista.length === 1 ? "" : "s"}
        </span>
      </div>

      {!canUpload && msg && (
        <p className="m-0 font-bold text-late" role="alert">
          {msg}
        </p>
      )}

      {lista.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {lista.map((d, i) => (
            <article
              key={d.id}
              className="group relative grid animate-rise gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-[0_10px_30px_rgba(0,148,255,.15)]"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 flex-none place-items-center rounded-xl bg-linear-to-br from-brand/25 to-indigo/30 font-mono text-[10px] font-bold tracking-wider text-sky ring-1 ring-brand/30">PDF</span>
                <div className="grid min-w-0 gap-0.5">
                  <h2 className="m-0 truncate font-display text-base font-semibold tracking-tight" title={d.titulo}>
                    {d.titulo}
                  </h2>
                  <span className="text-xs text-muted">
                    {d.categoria} · {peso(d.tamano)} · {fecha.format(new Date(d.created_at))}
                  </span>
                </div>
              </div>
              {d.descripcion && <p className="m-0 line-clamp-2 text-[13px] text-muted">{d.descripcion}</p>}
              <span className="text-xs text-dim">Subido por {d.subido_por}</span>
              <div className="flex items-center gap-2 border-t border-line pt-3">
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted" title="Visualizaciones">
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    {vistas[d.id] ?? 0} vista{(vistas[d.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                )}
                <span className="flex-1" />
                {isAdmin && (
                  <button className={armado === d.id ? ui.btnDangerArmed : ui.btnDanger} onClick={() => eliminar(d.id)} onBlur={() => setArmado(null)}>
                    {armado === d.id ? "Confirmar" : "Eliminar"}
                  </button>
                )}
                <Link className={ui.btnPrimary} href={`/documentos/${d.id}`}>
                  Ver
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={cn(ui.panel, ui.emptyState)}>
          <b className={ui.emptyTitle}>{docs.length ? "Sin resultados" : "Aún no hay documentos"}</b>
          <span>{docs.length ? "Ningún documento coincide con la búsqueda." : canUpload ? "Sube el primero con el formulario de arriba." : "Cuando se suban documentos aparecerán aquí."}</span>
        </div>
      )}
    </>
  );
}
