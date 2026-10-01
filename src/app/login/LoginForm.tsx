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
        <p className="sub">Ingresa la contraseña para ver el plan.</p>
      </div>
      <label>
        Contraseña
        <input className="field" name="password" type="password" autoComplete="current-password" required maxLength={128} autoFocus />
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
