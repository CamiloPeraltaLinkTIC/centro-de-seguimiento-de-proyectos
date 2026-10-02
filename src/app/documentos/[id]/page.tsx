import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Band from "@/components/Band";
import PdfViewer from "@/components/PdfViewer";
import UserMenu from "@/components/UserMenu";
import { ROLE_LABEL } from "@/lib/gantt";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import { cn, ui } from "@/lib/ui";

export const metadata = { title: "Documento · Centro de seguimiento de proyectos", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

export default async function DocumentoPage({ params }: PageProps<"/documentos/[id]">) {
  const s = await getSession();
  if (!s) redirect("/sesion/expirada");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { data: doc } = await db().from("documentos").select("id,titulo,descripcion,categoria,subido_por,created_at").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc) notFound();

  const vistas =
    s.role === "admin"
      ? ((await db().from("historial").select("id,created_at,usuario,rol,ip").eq("accion", "documento_visto").eq("entidad_id", id).order("created_at", { ascending: false }).limit(200)).data ?? [])
      : null;

  const marca = `${s.user} · ${fecha.format(new Date())} · Confidencial`;

  return (
    <>
      <Band contexto="Documentación">
        <UserMenu user={s.user} role={s.role} current="documentos" />
      </Band>
      <main className={ui.page}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <p className={ui.eyebrow}>{doc.categoria}</p>
            <h1 className={cn(ui.h1, "text-[clamp(24px,3vw,36px)]")}>{doc.titulo}</h1>
            <p className="m-0 text-muted">
              {doc.descripcion ? `${doc.descripcion} · ` : ""}Subido por {doc.subido_por} el {fecha.format(new Date(doc.created_at))}
            </p>
          </div>
          <Link className={ui.btn} href="/documentos">
            ← Volver a documentos
          </Link>
        </div>

        <div className={cn("grid gap-5", vistas && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
          <PdfViewer docId={doc.id} marca={marca} />
          {vistas && (
            <aside className={cn(ui.panel, "grid content-start gap-3 self-start p-4 xl:sticky xl:top-[78px]")}>
              <p className={ui.eyebrow}>
                Visualizaciones
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] tracking-normal">{vistas.length}</span>
              </p>
              <p className="m-0 text-xs text-muted">Aperturas anteriores a esta. Solo los administradores ven esta lista.</p>
              <ul className="scrollbar-thin m-0 grid max-h-[60vh] list-none gap-0 overflow-auto p-0">
                {vistas.map((v) => (
                  <li key={v.id} className="grid gap-0.5 border-t border-line py-2 first:border-t-0">
                    <b className="text-[13px]">{v.usuario}</b>
                    <span className="font-mono text-[11px] text-muted">
                      {fecha.format(new Date(v.created_at))} · {v.rol ? ROLE_LABEL[v.rol] : "—"}
                      {v.ip ? ` · ${v.ip}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="text-[12.5px] font-bold text-link hover:underline" href={`/historial?accion=documento_visto`}>
                Ver en el historial →
              </Link>
            </aside>
          )}
        </div>
      </main>
    </>
  );
}
