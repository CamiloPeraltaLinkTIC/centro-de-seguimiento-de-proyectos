// Genera supabase/seed.sql a partir de supabase/data/materan-data.json.
// Uso: node scripts/generate-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../supabase/data/materan-data.json", import.meta.url), "utf8"));
const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;

const frentes = [...data.frentes].sort((a, b) => a.orden - b.orden);
const tasks = [...data.actividades].sort((a, b) => a.num - b.num);
const responsables = [...new Set(tasks.map((t) => t.responsable.trim()).filter(Boolean))];

const nombres = new Set(frentes.map((f) => f.nombre));
for (const t of tasks) if (!nombres.has(t.frente)) throw new Error(`Frente inexistente: ${t.frente} (actividad ${t.num})`);

let sql = `-- Datos iniciales del tablero Gantt MATERAN (exportado ${data.meta?.exportado ?? ""}).
-- Generado por scripts/generate-seed.mjs. Ejecutar después de las migraciones; si ya hay actividades, no inserta nada.

insert into public.frentes (nombre, color, orden) values
${frentes.map((f) => `  (${q(f.nombre)}, ${q(f.color)}, ${f.orden})`).join(",\n")}
on conflict (nombre) do nothing;

insert into public.responsables (nombre) values
${responsables.map((r) => `  (${q(r)})`).join(",\n")}
on conflict (nombre) do nothing;

insert into public.tasks (num, frente_id, responsable_id, actividad, estado, avance, inicio, fin, notas)
select v.num, f.id, r.id, v.actividad, v.estado, v.avance, v.inicio::date, v.fin::date, v.notas
from (values
${tasks
  .map((t) => `  (${t.num}, ${q(t.frente)}, ${q(t.responsable.trim())}, ${q(t.actividad)}, ${q(t.estado)}, ${+t.avance || 0}, ${q(t.inicio)}, ${q(t.fin)}, ${q(t.notas)})`)
  .join(",\n")}
) as v(num, frente, responsable, actividad, estado, avance, inicio, fin, notas)
join public.frentes f on f.nombre = v.frente
left join public.responsables r on r.nombre = v.responsable
where not exists (select 1 from public.tasks);
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql: ${frentes.length} frentes, ${responsables.length} responsables, ${tasks.length} actividades`);
