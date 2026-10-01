"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "" });

  return (
    <form className="login-card" action={action}>
      <div>
        <h1>
          Plan de trabajo <em>MATERAN</em>
        </h1>
        <span className="rule" aria-hidden="true" />
        <p className="sub">Ingresa con tu usuario y contraseña.</p>
      </div>
      <label>
        Usuario
        <input className="field" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} autoFocus />
      </label>
      <label>
        Contraseña
        <input className="field" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <p className="err" role="alert">
        {state.error}
      </p>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
