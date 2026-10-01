"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="login-card" onSubmit={onSubmit}>
      <div>
        <h1>
          Plan de trabajo <em>MATERAN</em>
        </h1>
        <span className="rule" aria-hidden="true" />
        <p className="sub">Ingresa con tu cuenta para ver el plan.</p>
      </div>
      <label>
        Correo
        <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Contraseña
        <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <p className="err" role="alert">{error}</p>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
