"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Band from "./Band";
import type DashboardType from "./Dashboard";

// El tablero depende de la fecha local del navegador ("hoy"), así que se renderiza solo en el cliente.
const Dashboard = dynamic(() => import("./Dashboard"), {
  ssr: false,
  loading: () => (
    <>
      <Band>
        <span className="sync" data-s="idle">
          Conectando…
        </span>
      </Band>
      <main className="wrap">
        <div className="gantt">
          <div className="empty">
            <b>Cargando el plan…</b>
            <span>Las actividades aparecen aquí en cuanto se conecta la base del proyecto.</span>
          </div>
        </div>
      </main>
    </>
  ),
});

export default function DashboardLoader(props: ComponentProps<typeof DashboardType>) {
  return <Dashboard {...props} />;
}
