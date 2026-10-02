import { ui } from "@/lib/ui";

/** Encabezado de página: antetítulo, título con palabra destacada, descripción y acción a la derecha. */
export default function PageHeader({ eyebrow, title, highlight, sub, action }: { eyebrow: string; title: string; highlight: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-2">
        <p className={ui.eyebrow}>{eyebrow}</p>
        <h1 className={ui.h1}>
          {title} <em className="text-gradient-title not-italic">{highlight}</em>
        </h1>
        <p className="m-0 text-muted">{sub}</p>
      </div>
      {action}
    </div>
  );
}
