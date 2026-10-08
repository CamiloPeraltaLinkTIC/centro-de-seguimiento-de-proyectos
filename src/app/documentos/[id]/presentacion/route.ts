import { entregarPresentacion } from "@/lib/presentacion";

/** Presentación HTML completa para el visor. Cada apertura queda en el historial. */
export async function GET(req: Request, ctx: RouteContext<"/documentos/[id]/presentacion">) {
  return entregarPresentacion(req, (await ctx.params).id, { registrar: true });
}
