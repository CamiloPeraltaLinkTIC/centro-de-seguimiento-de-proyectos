import { entregarPresentacion } from "@/lib/presentacion";

/** La misma presentación, para la miniatura de su tarjeta. No cuenta como visualización. */
export async function GET(req: Request, ctx: RouteContext<"/documentos/[id]/miniatura">) {
  return entregarPresentacion(req, (await ctx.params).id, { registrar: false });
}
