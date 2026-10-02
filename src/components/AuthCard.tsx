import Image from "next/image";
import Band from "./Band";

/**
 * Marco de las pantallas de acceso con entrada coreografiada:
 * grilla de fondo → resplandor → ave que cae → tarjeta que se enfoca (los hijos entran en cascada).
 */
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Band />
      <main className="relative grid min-h-[calc(100vh-61px)] place-items-center overflow-hidden px-4 py-10">
        <div className="bg-hero-grid pointer-events-none absolute inset-0 animate-grid-in [mask-image:radial-gradient(60%_60%_at_50%_45%,#000,transparent)]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-full bg-[radial-gradient(circle,rgba(0,148,255,.18),transparent_60%)] [animation-delay:.2s] [animation-duration:1.4s]"
          aria-hidden="true"
        />
        <div className="edge-gradient relative grid w-full max-w-[400px] animate-blur-in gap-4 rounded-[20px] bg-surface p-7 shadow-card [animation-delay:.25s]">
          <div className="animate-drop-in [animation-delay:.55s]">
            <Image
              src="/linky_white.svg"
              alt=""
              width={36}
              height={48}
              priority
              className="h-12 w-auto animate-glow drop-shadow-[0_0_14px_rgba(0,148,255,.6)] [animation-delay:1.6s] light:invert"
            />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
