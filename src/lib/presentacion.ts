import "server-only";
import { audit } from "@/lib/audit";
import { BUCKET, tipoDe } from "@/lib/documentos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mismas protecciones del visor de PDF, dentro de la presentación: sin clic derecho, guardar ni imprimir. */
const PROTECCION = Buffer.from(
  `<style>@media print{html,body{display:none!important}}</style>` +
    `<script>(()=>{const no=e=>e.preventDefault();addEventListener("contextmenu",no,true);addEventListener("dragstart",no,true);` +
    `addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&["s","p"].includes(e.key.toLowerCase()))e.preventDefault()},true)})()</script>`,
);

/**
 * Entrega una presentación HTML SOLO dentro del iframe del visor de la app (mismo origen, destino "iframe").
 * Abrir esta URL directamente en el navegador no funciona.
 * El documento corre aislado: la CSP `sandbox` (ver src/proxy.ts) le da un origen propio, así que no puede leer la sesión
 * ni llamar a la app aunque traiga scripts. Con `registrar`, la entrega queda en el historial como una visualización
 * (las miniaturas de las tarjetas no cuentan).
 */
export async function entregarPresentacion(req: Request, id: string, { registrar }: { registrar: boolean }) {
  const s = await getSession();
  if (!s) return new Response("Sesión expirada.", { status: 401 });

  const dest = req.headers.get("sec-fetch-dest");
  const site = req.headers.get("sec-fetch-site");
  if ((dest && dest !== "iframe") || (site && site !== "same-origin"))
    return new Response("Este documento solo se puede ver dentro del visor de la app.", { status: 403 });
  if (!UUID.test(id)) return new Response("No encontrado.", { status: 404 });

  const { data: doc } = await db().from("documentos").select("id,titulo,archivo").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc || tipoDe(doc.archivo) !== "html") return new Response("No encontrado.", { status: 404 });

  const { data: blob, error } = await db().storage.from(BUCKET).download(doc.archivo);
  if (error || !blob) {
    console.error("[documentos] no se pudo leer el archivo:", error?.message);
    return new Response("No se pudo cargar el documento.", { status: 502 });
  }

  if (registrar) await audit({ usuario: s.user, rol: s.role, accion: "documento_visto", entidad: "documento", entidadId: doc.id, resumen: doc.titulo });

  // Los bytes se entregan tal cual (sin re-codificar); si el archivo no declara su codificación, se asume UTF-8.
  const html = Buffer.from(await blob.arrayBuffer());
  const declara = /<meta[^>]+charset/i.test(html.subarray(0, 2048).toString("latin1"));
  return new Response(Buffer.concat([html, PROTECCION]), {
    headers: {
      "Content-Type": declara ? "text/html" : "text/html; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
