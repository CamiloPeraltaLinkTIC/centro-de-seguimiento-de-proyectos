import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { normUser } from "./auth";
import { db } from "./supabase/server";
import type { UsuarioRow } from "./supabase/types";

/* Formato del hash: scrypt.N.r.p.salt.hash (base64url). */
const N = 16384, R = 8, P = 1, LEN = 32;

const scryptAsync = (pass: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scrypt(pass.normalize("NFC"), salt, len, opts, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pass: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pass, salt, LEN, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
  return `scrypt.${N}.${R}.${P}.${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

async function verifyHash(pass: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split(".");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const got = await scryptAsync(pass, Buffer.from(salt, "base64url"), expected.length, { N: +n, r: +r, p: +p, maxmem: 128 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Contraseña aleatoria legible (sin caracteres ambiguos). */
export function generatePassword(len = 18) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%*?@&";
  return Array.from(randomBytes(len), (b) => abc[b % abc.length]).join("");
}

// Hash de relleno para que un usuario inexistente o inactivo tarde lo mismo que uno real.
const DUMMY = `scrypt.${N}.${R}.${P}.${randomBytes(16).toString("base64url")}.${randomBytes(LEN).toString("base64url")}`;

export async function checkCredentials(user: string, pass: string): Promise<UsuarioRow | null> {
  const { data } = await db().from("usuarios").select("*").eq("usuario", normUser(user)).maybeSingle();
  const u = data && data.activo ? data : null;
  const ok = await verifyHash(pass, u?.password_hash ?? DUMMY);
  return ok && u ? u : null;
}
