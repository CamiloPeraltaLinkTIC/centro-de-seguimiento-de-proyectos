/** Une clases condicionales: cn("a", cond && "b"). */
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* Piezas reutilizables del sistema visual (Tailwind). */
export const ui = {
  panel: "rounded-2xl border border-line bg-surface",
  eyebrow:
    "m-0 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[.2em] text-muted before:h-0.5 before:w-[18px] before:rounded-sm before:bg-linear-to-r before:from-brand before:to-cyan before:shadow-[0_0_10px_rgba(0,148,255,.7)] before:content-['']",
  btn: "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface-2 px-3 py-[7px] text-[13px] font-bold text-fg no-underline transition hover:border-brand disabled:opacity-45",
  btnPrimary:
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-transparent bg-brand px-3 py-[7px] text-[13px] font-bold text-white no-underline shadow-[0_4px_16px_rgba(0,148,255,.3)] transition hover:-translate-y-px hover:bg-linear-to-r hover:from-brand hover:to-cyan hover:shadow-[0_6px_22px_rgba(0,148,255,.45)] disabled:translate-y-0 disabled:opacity-45",
  btnDanger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] border border-late/30 bg-transparent px-3 py-[7px] text-[13px] font-bold text-late transition hover:border-late",
  btnDangerArmed: "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] border border-late bg-late px-3 py-[7px] text-[13px] font-bold text-white",
  field:
    "min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 py-[7px] text-fg outline-none transition placeholder:text-dim focus:border-brand/70 focus:ring-3 focus:ring-brand/20 disabled:opacity-70",
  label: "grid gap-1.5 text-xs font-bold text-muted",
  /** Botón de la barra superior (fondo oscuro siempre). */
  out: "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-white/15 bg-white/5 px-2.5 py-[5px] text-[12.5px] font-bold text-white no-underline transition hover:border-cyan/50 hover:bg-white/10",
  fieldFull:
    "w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm text-fg outline-none transition placeholder:text-dim focus:border-brand/70 focus:ring-3 focus:ring-brand/20 disabled:opacity-70",
  /* Panel lateral (drawer) */
  drawer:
    "fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] animate-slide-in flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-card before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-linear-to-b before:from-cyan before:via-transparent before:to-indigo before:content-['']",
  dHead: "flex items-start gap-3 border-b border-line px-5 py-[18px]",
  dTitle: "m-0 flex-1 font-display text-lg font-semibold tracking-tight text-balance",
  dClose: "px-1.5 py-0.5 text-[22px] leading-none text-muted transition hover:text-fg",
  dBody: "scrollbar-thin grid flex-1 content-start gap-3.5 overflow-auto px-5 py-[18px]",
  dFoot: "flex items-center gap-2 border-t border-line px-5 py-3.5",
  dMsg: "flex-1 text-xs text-late",
  /* Editor de listas (frentes y responsables) */
  feRow: "grid items-center gap-2 rounded-[10px] border border-line bg-surface-2 p-2",
  iconBtn: "grid size-7 place-items-center rounded-md border border-transparent text-sm text-muted transition enabled:hover:border-line enabled:hover:text-fg disabled:opacity-30",
  iconBtnRm: "enabled:hover:border-late/30 enabled:hover:text-late",
  swatch: "size-7 rounded-[7px] border-2 border-surface p-0 ring-1 ring-line transition hover:ring-brand disabled:opacity-50",
  /* Páginas */
  page: "mx-auto grid max-w-[1440px] gap-5 px-4 pt-7 pb-14 *:animate-rise",
  h1: "m-0 font-display text-[clamp(28px,3.6vw,44px)] leading-[1.05] font-semibold tracking-[-.035em] text-balance",
  sub: "m-0 mt-2 text-muted",
  /* Tablas */
  tableWrap: "scrollbar-thin overflow-auto rounded-2xl border border-line bg-surface",
  table: "w-full border-collapse text-[13px]",
  th: "sticky top-0 border-b border-line bg-surface-2 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.08em] text-dim",
  td: "border-b border-grid px-3 py-2.5 align-top",
  tdDate: "border-b border-grid px-3 py-2.5 align-top font-mono text-xs whitespace-nowrap text-muted",
  emptyState: "grid justify-items-center gap-3 px-6 py-12 text-center text-muted",
  emptyTitle: "font-display text-[17px] font-semibold text-fg",
};

/* Colores por estado de actividad. */
export const estadoPill = {
  Cerrada: "bg-ok/15 text-ok border-ok/35",
  "En curso": "bg-run/15 text-run border-run/35",
  Pendiente: "bg-todo/15 text-muted border-transparent",
  late: "bg-late/15 text-late border-late/35",
} as const;

/* Etiquetas del historial y estados de usuario. */
export const tag = {
  base: "inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap",
  login: "bg-ok/15 text-ok",
  fallo: "bg-late/15 text-late",
  crea: "bg-run/15 text-run",
  edita: "bg-accent-soft text-link",
  elimina: "bg-late/15 text-late",
  neutral: "bg-todo/15 text-muted",
} as const;
