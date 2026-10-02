import { cn } from "@/lib/ui";

export type SyncState = "idle" | "live" | "saving" | "error";

const DOT: Record<SyncState, string> = {
  idle: "bg-[#8892b0]",
  live: "bg-[#2eb88a] shadow-[0_0_0_3px_rgba(46,184,138,.25)] animate-pulse-dot",
  saving: "bg-cyan",
  error: "bg-[#ff5a5f]",
};

/** Estado de sincronización con la base de datos. */
export default function SyncBadge({ s, txt }: { s: SyncState; txt: string }) {
  return (
    <span className="inline-flex items-center gap-[7px] rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#c0c8de]" role="status">
      <i className={cn("size-[7px] rounded-full", DOT[s])} aria-hidden="true" />
      {txt}
    </span>
  );
}
