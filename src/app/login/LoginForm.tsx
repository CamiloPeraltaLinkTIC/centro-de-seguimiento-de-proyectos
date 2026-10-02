"use client";

import { useActionState } from "react";
import { cn, ui } from "@/lib/ui";
import { login, type LoginState } from "./actions";

/** Entrada en cascada: cada bloque aparece un poco después del anterior. */
const step = (i: number) => ({ animationDelay: `${0.7 + i * 0.09}s` });
const STEP = "animate-rise";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "" });

  return (
    <form className="grid gap-4" action={action}>
      {/* barra de progreso mientras se verifica el ingreso */}
      <span className={cn("absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-[20px] transition-opacity", pending ? "opacity-100" : "opacity-0")} aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-full origin-left animate-progress bg-linear-to-r from-brand via-cyan to-indigo" />
      </span>

      <div className="grid gap-2">
        <p className={cn(ui.eyebrow, STEP)} style={step(0)}>
          Centro de seguimiento
        </p>
        <h1 className={cn("m-0 font-display text-[28px] leading-tight font-semibold tracking-[-.03em]", STEP)} style={step(1)}>
          Plan de trabajo{" "}
          <em className="not-italic" aria-label="MATERAN">
            {"MATERAN".split("").map((ch, i) => (
              <span key={i} className="text-gradient-title inline-block animate-letter" style={{ animationDelay: `${0.95 + i * 0.05}s` }} aria-hidden="true">
                {ch}
              </span>
            ))}
          </em>
        </h1>
        <p className={cn("m-0 text-muted", STEP)} style={step(2)}>
          Ingresa con tu usuario y contraseña.
        </p>
      </div>
      <label className={cn(ui.label, STEP)} style={step(3)}>
        Usuario
        <input className={ui.fieldFull} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} autoFocus disabled={pending} />
      </label>
      <label className={cn(ui.label, STEP)} style={step(4)}>
        Contraseña
        <input className={ui.fieldFull} name="password" type="password" autoComplete="current-password" required maxLength={200} disabled={pending} />
      </label>
      <p key={state.error} className={cn("m-0 min-h-[1em] text-[13px] text-late", state.error && "animate-[rise_.35s_ease-out_both]")} role="alert">
        {state.error}
      </p>
      <button className={cn(ui.btnPrimary, "py-2.5 text-sm", STEP)} style={step(5)} type="submit" disabled={pending}>
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
        {pending ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
