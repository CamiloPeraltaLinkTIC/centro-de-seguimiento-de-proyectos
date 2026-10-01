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
      <Band />
      <div className="wrap">
        <div className="gantt">
          <div className="empty">
            <b>Cargando el plan…</b>
          </div>
        </div>
      </div>
    </>
  ),
});

export default function DashboardLoader(props: ComponentProps<typeof DashboardType>) {
  return <Dashboard {...props} />;
}
