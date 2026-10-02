/*
 * Sesiones firmadas (HMAC-SHA256, Web Crypto) para funcionar igual en el proxy y en el servidor.
 * El proxy solo verifica la firma; getSession() (session.ts) además confirma contra la tabla
 * seguimiento.usuarios que el usuario siga activo y no haya cambiado su rol ni su contraseña.
 * No importar desde componentes de cliente.
 */
import type { Role } from "@/lib/gantt";

export const SESSION_COOKIE = "cs_session";
export const SESSION_TTL_S = 12 * 60 * 60; // 12 horas

/** uid: id del usuario · v: huella de su contraseña/rol/estado · exp: expiración (epoch s). */
export type SessionToken = { uid: string; role: Role; v: string; exp: number };

const enc = new TextEncoder();

/** Normaliza el usuario: sin tildes, sin mayúsculas ("Audry.Muñoz" → "audry.munoz"). */
export const normUser = (u: string) =>
  u
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

function secret() {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  return s;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const hmacKey = () => crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** Huella que cambia si cambia la contraseña, el rol o el estado del usuario (invalida sus sesiones). */
export async function fingerprint(u: { password_hash: string; rol: string; activo: boolean }) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(`${u.password_hash}|${u.rol}|${u.activo}`));
  return b64url(h).slice(0, 22);
}

export async function createSessionToken(t: Omit<SessionToken, "exp">) {
  const payload: SessionToken = { ...t, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

/** Verifica firma y expiración (sin consultar la base de datos). */
export async function verifySessionToken(token: string | undefined): Promise<SessionToken | null> {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(body)))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionToken;
    if (typeof p.uid !== "string" || typeof p.v !== "string" || typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_S,
};
