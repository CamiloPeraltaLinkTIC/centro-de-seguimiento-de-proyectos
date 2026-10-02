import Link from "next/link";
import Band from "@/components/Band";
import { cn, ui } from "@/lib/ui";

export default function NotFound() {
  return (
    <>
      <Band />
      <main className={ui.page}>
        <div className={cn(ui.panel, ui.emptyState)}>
          <b className={ui.emptyTitle}>Página no encontrada</b>
          <span>No existe o no tienes permisos para verla.</span>
          <Link className={ui.btn} href="/">
            Volver al tablero
          </Link>
        </div>
      </main>
    </>
  );
}
