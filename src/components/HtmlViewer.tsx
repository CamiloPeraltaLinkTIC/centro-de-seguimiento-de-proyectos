"use client";

import { useEffect, useRef, useState } from "react";
import { cn, ui } from "@/lib/ui";
import { BirdPulse } from "./Loader";

/**
 * Visor de presentaciones HTML de solo lectura.
 * - El archivo se carga en un iframe aislado (sandbox sin allow-same-origin): sus scripts corren, pero no pueden leer
 *   la sesión ni tocar la app. La ruta que lo entrega rechaza cualquier petición que no venga de este iframe.
 * - Clic derecho, guardar e imprimir se bloquean aquí y dentro de la presentación.
 * Nota: ninguna web puede impedir del todo una captura de pantalla.
 */
export default function HtmlViewer({ docId, titulo }: { docId: string; titulo: string }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="grid gap-3" data-protegido>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface/95 p-2.5 backdrop-blur md:top-[61px]">
        <span className="font-mono text-xs text-muted">Presentación HTML</span>
        <span className="flex-1" />
        <span className="hidden text-[11.5px] text-dim md:inline">Solo lectura</span>
        <button className={ui.btn} onClick={() => marco.current?.requestFullscreen?.().catch(() => {})}>
          Pantalla completa
        </button>
      </div>

      <div className="relative h-[min(80vh,900px)] min-h-[60vh] overflow-hidden rounded-2xl border border-line bg-surface-2 print:hidden" onContextMenu={(e) => e.preventDefault()}>
        {!cargado && (
          <div className="absolute inset-0 grid place-items-center">
            <BirdPulse label="Abriendo documento" />
          </div>
        )}
        <iframe
          ref={marco}
          src={`/documentos/${docId}/presentacion`}
          title={titulo}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen"
          referrerPolicy="no-referrer"
          onLoad={() => setCargado(true)}
          className={cn("block size-full bg-white transition-opacity duration-500", cargado ? "opacity-100" : "opacity-0")}
        />
      </div>
      <p className="hidden print:block">La impresión de este documento no está permitida.</p>
    </div>
  );
}
