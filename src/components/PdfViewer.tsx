"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { confirmarPortada, prepararPortada } from "@/app/documentos/actions";
import { canvasAPortada, cargarPdfjs, subirFirmado } from "@/lib/pdf-cover";
import { cn, ui } from "@/lib/ui";
import { BirdPulse } from "./Loader";

type Props = { docId: string; generarPortada?: boolean };

/**
 * Visor de PDF de solo lectura.
 * - El archivo llega por fetch (nunca hay un enlace directo) y se dibuja página a página en <canvas> con PDF.js:
 *   no existe el visor nativo del navegador ni su botón de descarga.
 * - Se bloquean clic derecho, arrastrar, Ctrl/Cmd+S y Ctrl/Cmd+P, y la impresión muestra una página en blanco.
 * Nota: ninguna web puede impedir del todo una captura de pantalla.
 */
export default function PdfViewer({ docId, generarPortada = false }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Carga del documento.
  useEffect(() => {
    let cancel = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const res = await fetch(`/documentos/${docId}/archivo`, { headers: { "x-visor": "1" }, cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error((await res.text()) || "No se pudo cargar el documento.");
        const data = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await cargarPdfjs();
        const loading = pdfjs.getDocument({
          data,
          enableXfa: false,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        task = loading;
        const doc = await loading.promise;
        if (!cancel) setPdf(doc);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "No se pudo cargar el documento.");
      }
    })();
    return () => {
      cancel = true;
      task?.destroy();
    };
  }, [docId]);

  // Ancho disponible (para ajustar las páginas al contenedor).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Bloqueo de atajos de guardar / imprimir mientras el visor está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const pages = pdf ? Array.from({ length: pdf.numPages }, (_, i) => i + 1) : [];

  return (
    <div className="grid gap-3" data-protegido>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface/95 p-2.5 backdrop-blur md:top-[61px]">
        <span className="font-mono text-xs text-muted">{pdf ? `${pdf.numPages} página${pdf.numPages === 1 ? "" : "s"}` : "—"}</span>
        <span className="flex-1" />
        <span className="hidden text-[11.5px] text-dim md:inline">Solo lectura</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-line bg-surface-2">
          <button className="px-3 py-1.5 font-bold text-muted hover:text-fg disabled:opacity-40" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Alejar">
            −
          </button>
          <button className="border-x border-line px-3 py-1.5 font-mono text-xs text-fg" onClick={() => setZoom(1)} title="Ajustar al ancho">
            {Math.round(zoom * 100)}%
          </button>
          <button className="px-3 py-1.5 font-bold text-muted hover:text-fg disabled:opacity-40" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} aria-label="Acercar">
            +
          </button>
        </div>
      </div>

      <div
        ref={box}
        className="scrollbar-thin relative min-h-[60vh] overflow-auto rounded-2xl border border-line bg-surface-2 p-3 select-none md:p-6 print:hidden"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {error ? (
          <div className={ui.emptyState}>
            <b className={ui.emptyTitle}>No se pudo abrir el documento</b>
            <span>{error}</span>
          </div>
        ) : !pdf ? (
          <div className="grid min-h-[50vh] place-items-center">
            <BirdPulse label="Abriendo documento" />
          </div>
        ) : (
          <div className="grid justify-items-center gap-4">
            {width > 0 && pages.map((n) => <Pagina key={`${n}-${zoom}-${width}`} pdf={pdf} n={n} ancho={(width - 8) * zoom} onLista={n === 1 && generarPortada ? (c) => guardarPortada(docId, c) : undefined} />)}
          </div>
        )}
      </div>
      <p className="hidden print:block">La impresión de este documento no está permitida.</p>
    </div>
  );
}

/** Una página: se dibuja solo cuando entra en pantalla (o está cerca). */
function Pagina({ pdf, n, ancho, onLista }: { pdf: PDFDocumentProxy; n: number; ancho: number; onLista?: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let task: { cancel: () => void } | null = null;
    let done = false;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || done) return;
        done = true;
        io.disconnect();
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (ancho / base.width) * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const render = page.render({ canvas, viewport });
        task = render;
        try {
          await render.promise;
        } catch {
          return;
        }
        setLista(true);
        onLista?.(canvas);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(canvas);
    return () => {
      io.disconnect();
      task?.cancel();
    };
    // onLista solo se usa una vez, al terminar de dibujar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, n, ancho]);

  return (
    <div className="relative max-w-none rounded-md bg-white shadow-[0_8px_30px_rgba(0,0,0,.35)]" style={{ width: ancho, height: ancho * ratio }}>
      <canvas ref={ref} className={cn("block size-full rounded-md transition-opacity duration-500", lista ? "opacity-100" : "opacity-0")} aria-label={`Página ${n}`} />
      {!lista && <div className="skeleton absolute inset-0 rounded-md!" aria-hidden="true" />}
      <span className="absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">{n}</span>
    </div>
  );
}

/** Documentos subidos antes de existir las portadas: el visor de un administrador genera la suya una sola vez. */
let portadaEnCurso = "";
async function guardarPortada(docId: string, canvas: HTMLCanvasElement) {
  if (portadaEnCurso === docId) return;
  portadaEnCurso = docId;
  const blob = await canvasAPortada(canvas);
  const prep = blob ? await prepararPortada(docId) : null;
  if (!blob || !prep?.ok) return;
  if (await subirFirmado(prep.data.url, blob)) await confirmarPortada(docId, prep.data.path);
}
