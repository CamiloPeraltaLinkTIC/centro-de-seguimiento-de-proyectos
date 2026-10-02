import { audit } from "@/lib/audit";
import { BUCKET } from "@/lib/documentos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entrega el PDF SOLO al visor de la app (fetch del mismo origen con la cabecera x-visor).
 * Abrir esta URL directamente en el navegador no funciona, así que no aparece el visor nativo con su botón de descarga.
 * Cada entrega queda en el historial como una visualización.
 */
export async function GET(req: Request, ctx: RouteContext<"/documentos/[id]/archivo">) {
  const { id } = await ctx.params;
  const s = await getSession();
  if (!s) return new Response("Sesión expirada.", { status: 401 });

  const dest = req.headers.get("sec-fetch-dest");
  const site = req.headers.get("sec-fetch-site");
  if (req.headers.get("x-visor") !== "1" || (dest && dest !== "empty") || (site && site !== "same-origin"))
    return new Response("Este documento solo se puede ver dentro del visor de la app.", { status: 403 });
  if (!UUID.test(id)) return new Response("No encontrado.", { status: 404 });

  const { data: doc } = await db().from("documentos").select("id,titulo,archivo").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc) return new Response("No encontrado.", { status: 404 });

  const { data: blob, error } = await db().storage.from(BUCKET).download(doc.archivo);
  if (error || !blob) {
    console.error("[documentos] no se pudo leer el archivo:", error?.message);
    return new Response("No se pudo cargar el documento.", { status: 502 });
  }

  await audit({ usuario: s.user, rol: s.role, accion: "documento_visto", entidad: "documento", entidadId: doc.id, resumen: doc.titulo });

  return new Response(blob.stream(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
