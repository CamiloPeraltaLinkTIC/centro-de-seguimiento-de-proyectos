import Image from "next/image";
import Band from "./Band";

/** Marco de las pantallas de acceso (ingreso y cierre de sesión). */
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Band />
      <main className="relative grid min-h-[calc(100vh-61px)] place-items-center overflow-hidden px-4 py-10">
        <div className="bg-hero-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_45%,#000,transparent)]" aria-hidden="true" />
        <div className="edge-gradient relative grid w-full max-w-[400px] animate-rise gap-4 rounded-[20px] bg-surface p-7 shadow-card">
          <Image src="/linky_white.svg" alt="" width={36} height={48} className="h-12 w-auto drop-shadow-[0_0_14px_rgba(0,148,255,.6)] light:invert" priority />
          {children}
        </div>
      </main>
    </>
  );
}
