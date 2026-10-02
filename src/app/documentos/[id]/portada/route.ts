import { BUCKET } from "@/lib/documentos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Portada (primera página en JPEG) para el fondo de la tarjeta. Solo con sesión; no cuenta como visualización. */
export async function GET(_req: Request, ctx: RouteContext<"/documentos/[id]/portada">) {
  const { id } = await ctx.params;
  if (!(await getSession())) return new Response(null, { status: 401 });
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const { data: doc } = await db().from("documentos").select("portada").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc?.portada) return new Response(null, { status: 404 });
  const { data: blob } = await db().storage.from(BUCKET).download(doc.portada);
  if (!blob) return new Response(null, { status: 404 });
  return new Response(blob.stream(), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
