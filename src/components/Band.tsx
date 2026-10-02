import Image from "next/image";

/** Barra superior: marca, contexto y acciones del usuario (children, a la derecha). */
export default function Band({ children, contexto = "Plan MATERAN" }: { children?: React.ReactNode; contexto?: string }) {
  return (
    <header className="relative top-0 z-30 bg-topbar md:sticky px-4 text-white backdrop-blur-md backdrop-saturate-150 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-transparent after:via-brand/70 after:to-transparent after:content-['']">
      <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-center gap-3.5 py-2.5">
        <Image className="block h-10 w-auto" src="/logo-linktic.png" alt="LinkTIC" width={84} height={40} priority />
        <span className="h-7 w-px bg-white/20" aria-hidden="true" />
        <span className="grid leading-tight">
          <small className="text-[10.5px] font-bold uppercase tracking-[.18em] text-[#aab3cf]">Centro de seguimiento</small>
          <b className="font-display text-[15px] font-semibold tracking-tight">{contexto}</b>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[13px]">{children}</div>
      </div>
    </header>
  );
}
