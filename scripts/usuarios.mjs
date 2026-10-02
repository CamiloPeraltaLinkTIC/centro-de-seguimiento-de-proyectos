// Genera el SQL para cargar o actualizar usuarios en seguimiento.usuarios (contraseñas con scrypt).
// Úsalo para la carga inicial; después, los administradores gestionan usuarios desde /usuarios.
//
// Uso: node scripts/usuarios.mjs usuarios.local.json > supabase/usuarios.local.sql
// El JSON es una lista: [{ "usuario": "Ana.Gómez", "rol": "admin|editor|lector", "password": "…" }]
// Si "password" se omite, se genera una aleatoria y se muestra UNA vez (por stderr).
// No subas esos archivos al repositorio (*.local.json y *.local.sql están en .gitignore).
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/usuarios.mjs usuarios.local.json > supabase/usuarios.local.sql");
  process.exit(1);
}
const ROLES = ["admin", "editor", "lector"];
const N = 16384, r = 8, p = 1;
const norm = (u) => u.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const generar = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%*?@&";
  return Array.from(randomBytes(18), (b) => abc[b % abc.length]).join("");
};

const filas = [];
for (const u of JSON.parse(readFileSync(file, "utf8"))) {
  const nombre = String(u.usuario ?? "").trim();
  const usuario = norm(nombre);
  if (!/^[a-z0-9._-]{3,60}$/.test(usuario)) throw new Error(`Usuario inválido: ${nombre}`);
  if (!ROLES.includes(u.rol)) throw new Error(`Rol inválido para ${nombre}: ${u.rol}`);
  let pass = u.password;
  if (!pass) {
    pass = generar();
    console.error(`Contraseña generada para ${nombre}: ${pass}`);
  }
  if (pass.length < 12) throw new Error(`La contraseña de ${nombre} debe tener al menos 12 caracteres.`);
  const salt = randomBytes(16);
  const hash = scryptSync(pass.normalize("NFC"), salt, 32, { N, r, p, maxmem: 128 * 1024 * 1024 });
  filas.push(`  (${q(usuario)}, ${q(nombre)}, ${q(u.rol)}, ${q(`scrypt.${N}.${r}.${p}.${salt.toString("base64url")}.${hash.toString("base64url")}`)})`);
}

console.log(`-- Usuarios del Centro de seguimiento de proyectos. Generado por scripts/usuarios.mjs.
-- Contiene hashes de contraseñas: no lo subas al repositorio. Ejecútalo en el SQL Editor y bórralo.
insert into seguimiento.usuarios (usuario, nombre, rol, password_hash) values
${filas.join(",\n")}
on conflict (usuario) do update set nombre = excluded.nombre, rol = excluded.rol, password_hash = excluded.password_hash, activo = true;`);
