import Image from "next/image";
import { cn, ui } from "@/lib/ui";

/** Ave de LinkTIC con anillos de pulso: indicador de carga de marca. */
export function BirdPulse({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="grid justify-items-center gap-4" role="status" aria-live="polite">
      <div className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 animate-ring rounded-full border border-cyan/60" aria-hidden="true" />
        <span className="absolute inset-0 animate-ring rounded-full border border-brand/60 [animation-delay:.8s]" aria-hidden="true" />
        <span className="absolute inset-0 animate-ring rounded-full border border-indigo/60 [animation-delay:1.6s]" aria-hidden="true" />
        <span className="absolute inset-4 rounded-full bg-brand/15 blur-md" aria-hidden="true" />
        <Image src="/linky_white.svg" alt="" width={44} height={58} priority className="relative h-14 w-auto animate-float drop-shadow-[0_0_14px_rgba(0,148,255,.7)] light:invert" />
      </div>
      <div className="grid justify-items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.3em] text-muted">{label}</span>
        <span className="relative h-0.5 w-28 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 w-full origin-left animate-progress rounded-full bg-linear-to-r from-brand to-cyan" />
        </span>
      </div>
    </div>
  );
}

/** Esqueleto del tablero (hero, frentes y Gantt) con el ave al centro mientras se cargan los datos. */
export function DashboardSkeleton({ label = "Conectando con el plan" }: { label?: string }) {
  return (
    <main className={ui.page} aria-busy="true">
      <div className="edge-gradient relative grid min-h-[420px] overflow-hidden rounded-[22px] bg-surface lg:grid-cols-[minmax(300px,.85fr)_minmax(0,1.6fr)]">
        <div className="grid content-start gap-4 border-line p-7 max-lg:border-b lg:border-r">
          <div className="skeleton h-3 w-44" />
          <div className="skeleton h-12 w-72 max-w-full" />
          <div className="skeleton h-3 w-60 max-w-full" />
          <div className="skeleton mt-2 h-20 w-36" />
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-4 w-full" />
        </div>
        <div className="grid content-start gap-2.5 p-6">
          <div className="skeleton mb-3 h-3 w-40" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr] items-center gap-3">
              <div className="skeleton h-3" style={{ animationDelay: `${i * 90}ms` }} />
              <div className="skeleton h-[30px]" style={{ animationDelay: `${i * 90}ms` }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 grid place-items-center bg-surface/40 backdrop-blur-[2px]">
          <BirdPulse label={label} />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn(ui.panel, "flex items-center gap-3 p-3.5")}>
            <div className="skeleton size-[52px] rounded-full!" style={{ animationDelay: `${i * 70}ms` }} />
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="skeleton h-[52px] rounded-[14px]!" />
      <div className="skeleton h-[420px] rounded-2xl!" />
    </main>
  );
}

/** Esqueleto genérico para páginas de tabla (historial, usuarios). */
export function TableSkeleton({ label = "Cargando" }: { label?: string }) {
  return (
    <main className={ui.page} aria-busy="true">
      <div className="grid gap-2.5">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-10 w-80 max-w-full" />
        <div className="skeleton h-3 w-96 max-w-full" />
      </div>
      <div className={cn(ui.panel, "relative grid gap-0 overflow-hidden")}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="grid grid-cols-[160px_1fr_120px_2fr] gap-4 border-b border-grid px-3 py-3.5 max-md:grid-cols-2">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="skeleton h-3" style={{ animationDelay: `${(i + j) * 60}ms` }} />
            ))}
          </div>
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <BirdPulse label={label} />
        </div>
      </div>
    </main>
  );
}
