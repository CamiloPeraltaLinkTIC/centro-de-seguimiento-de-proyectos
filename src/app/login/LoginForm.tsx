"use client";

import { useActionState } from "react";
import { ui } from "@/lib/ui";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "" });

  return (
    <form className="grid gap-4" action={action}>
      <div className="grid gap-2">
        <p className={ui.eyebrow}>Centro de seguimiento</p>
        <h1 className="m-0 font-display text-[28px] leading-tight font-semibold tracking-[-.03em]">
          Plan de trabajo <em className="text-gradient-title not-italic">MATERAN</em>
        </h1>
        <p className="m-0 text-muted">Ingresa con tu usuario y contraseña.</p>
      </div>
      <label className={ui.label}>
        Usuario
        <input className={ui.fieldFull} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} autoFocus />
      </label>
      <label className={ui.label}>
        Contraseña
        <input className={ui.fieldFull} name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <p className="m-0 min-h-[1em] text-[13px] text-late" role="alert">
        {state.error}
      </p>
      <button className={`${ui.btnPrimary} py-2.5 text-sm`} type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
