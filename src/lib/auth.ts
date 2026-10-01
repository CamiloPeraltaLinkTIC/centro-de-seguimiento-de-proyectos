/*
 * Autenticación con usuario y contraseña definidos en variables de entorno del servidor.
 * Usa solo Web Crypto para funcionar igual en el proxy y en las server actions.
 * No importar desde componentes de cliente.
 */
import type { Role } from "@/lib/gantt";

export const SESSION_COOKIE = "cs_session";
export const SESSION_TTL_S = 12 * 60 * 60; // 12 horas

export type Session = { role: Role; user: string; exp: number };
type Cuenta = { role: Role; user: string; pass: string };

const enc = new TextEncoder();

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}.`);
  return v;
}

function cuentas(): Cuenta[] {
  const list: Cuenta[] = [
    { role: "admin", user: env("ADMIN_USERNAME"), pass: env("ADMIN_PASSWORD") },
    { role: "lector", user: env("LECTOR_USERNAME"), pass: env("LECTOR_PASSWORD") },
  ];
  if (list.some((c) => c.pass.length < 12)) throw new Error("Las contraseñas deben tener al menos 12 caracteres.");
  if (list[0].user.toLowerCase() === list[1].user.toLowerCase()) throw new Error("ADMIN_USERNAME y LECTOR_USERNAME deben ser distintos.");
  return list;
}

function sessionSecret() {
  const s = env("SESSION_SECRET");
  if (s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  return s;
}

/* ---------- utilidades ---------- */
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Comparación en tiempo constante (sobre los hashes, para no filtrar longitudes). */
async function safeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * La llave de firma depende del secreto y de la contraseña del rol:
 * al cambiar una contraseña se invalidan las sesiones abiertas de ese rol.
 */
async function signingKey(c: Cuenta) {
  return crypto.subtle.importKey("raw", enc.encode(`${sessionSecret()}\u0000${c.role}\u0000${c.user}\u0000${c.pass}`), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/* ---------- API ---------- */
export async function checkCredentials(user: string, pass: string): Promise<Cuenta | null> {
  let match: Cuenta | null = null;
  // Se evalúan todas las cuentas siempre, sin cortar antes, para no filtrar información por tiempo.
  for (const c of cuentas()) {
    const ok = (await safeEqual(user.trim().toLowerCase(), c.user.toLowerCase())) && (await safeEqual(pass, c.pass));
    if (ok) match = c;
  }
  return match;
}

export async function createSessionToken(c: Cuenta) {
  const payload: Session = { role: c.role, user: c.user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await signingKey(c), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let payload: Session;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
  const c = cuentas().find((x) => x.role === payload?.role);
  if (!c || payload.user !== c.user || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
  const ok = await crypto.subtle.verify("HMAC", await signingKey(c), fromB64url(sig), enc.encode(body));
  return ok ? payload : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_S,
};
