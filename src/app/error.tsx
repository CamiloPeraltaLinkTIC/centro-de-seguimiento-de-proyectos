"use client";

import Band from "@/components/Band";

// El detalle del error queda en los logs del servidor; aquí solo se muestra un mensaje genérico.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <Band>
        <span className="sync" data-s="error">
          Sin conexión
        </span>
      </Band>
      <main className="wrap">
        <div className="gantt">
          <div className="empty">
            <b>No se pudo cargar el plan</b>
            <span>Revisa la conexión con la base del proyecto (variables SUPABASE_URL y SUPABASE_SECRET_KEY) e intenta de nuevo.</span>
            <button className="btn" onClick={reset}>
              Reintentar
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
