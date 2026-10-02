import Link from "next/link";
import Band from "@/components/Band";

export default function NotFound() {
  return (
    <>
      <Band />
      <main className="wrap">
        <div className="gantt">
          <div className="empty">
            <b>Página no encontrada</b>
            <span>No existe o no tienes permisos para verla.</span>
            <Link className="btn" href="/">
              Volver al tablero
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
