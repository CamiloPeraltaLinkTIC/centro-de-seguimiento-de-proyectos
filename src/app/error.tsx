"use client";

import Band from "@/components/Band";
import SyncBadge from "@/components/SyncBadge";
import { cn, ui } from "@/lib/ui";

// El detalle del error queda en los logs del servidor; aquí solo se muestra un mensaje genérico.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <Band>
        <SyncBadge s="error" txt="Sin conexión" />
      </Band>
      <main className={ui.page}>
        <div className={cn(ui.panel, ui.emptyState)}>
          <b className={ui.emptyTitle}>No se pudo cargar el plan</b>
          <span>Revisa la conexión con la base del proyecto (variables SUPABASE_URL y SUPABASE_SECRET_KEY) e intenta de nuevo.</span>
          <button className={ui.btn} onClick={reset}>
            Reintentar
          </button>
        </div>
      </main>
    </>
  );
}
