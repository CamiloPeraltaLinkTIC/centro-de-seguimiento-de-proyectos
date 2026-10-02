"use client";

/** Utilidades del navegador para generar la portada (primera página) de un PDF como JPEG. */

const ANCHO = 640;

export async function cargarPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

/** Reduce un canvas ya dibujado a una portada JPEG liviana. */
export function canvasAPortada(origen: HTMLCanvasElement): Promise<Blob | null> {
  const c = document.createElement("canvas");
  const k = Math.min(1, ANCHO / origen.width);
  c.width = Math.round(origen.width * k);
  c.height = Math.round(origen.height * k);
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(origen, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
}

/** Dibuja la primera página de un PDF (archivo local) y devuelve la portada en JPEG. */
export async function portadaDeArchivo(file: File): Promise<Blob | null> {
  try {
    const pdfjs = await cargarPdfjs();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      enableXfa: false,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
    });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: ANCHO / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await canvasAPortada(canvas);
    await task.destroy();
    return blob;
  } catch {
    return null;
  }
}

/** Sube un archivo a Storage con un permiso firmado (sin llaves), con el mismo formato que usa Supabase. */
export function subirFirmado(url: string, archivo: Blob, onProgreso?: (pct: number) => void) {
  return new Promise<boolean>((resolve) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", archivo);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    if (onProgreso) xhr.upload.onprogress = (e) => e.lengthComputable && onProgreso(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(body);
  });
}
