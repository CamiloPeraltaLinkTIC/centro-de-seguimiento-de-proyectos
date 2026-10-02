-- Copia los datos editados en la versión anterior (tablas public.frentes, public.responsables y public.tasks)
-- al esquema nuevo `seguimiento`, reemplazando los datos de la semilla.
--
-- · Solo LEE de `public`: no modifica ni borra las tablas anteriores.
-- · Conserva los mismos ids, fechas de creación y de actualización.
-- · Se detiene sin cambiar nada si ya se hicieron cambios desde la app nueva (para no perderlos).
-- · Todo ocurre en una transacción: o se copia todo, o nada.
--
-- Ejecutar UNA vez en el SQL Editor, después de 0001_seguimiento.sql (y de seed.sql si ya lo corriste).

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tasks' and column_name = 'responsable_id') then
    raise exception 'No se encontró public.tasks con la columna responsable_id: no hay datos de la versión anterior para migrar.';
  end if;
  if exists (select 1 from seguimiento.historial
             where accion ~ '^(actividad|frente|responsable)_' or accion = 'migracion') then
    raise exception 'Ya hay cambios hechos en la app nueva o una migración previa (ver seguimiento.historial). No se migró nada para no sobrescribirlos.';
  end if;
end $$;

-- Reemplaza los datos de la semilla.
delete from seguimiento.actividades;
delete from seguimiento.responsables;
delete from seguimiento.frentes;

insert into seguimiento.frentes (id, nombre, color, orden, created_at)
select id, trim(nombre), color, orden, created_at
from public.frentes;

insert into seguimiento.responsables (id, nombre, created_at)
select id, trim(nombre), created_at
from public.responsables;

insert into seguimiento.actividades (id, num, frente_id, responsable_id, actividad, estado, avance, inicio, fin, notas, created_at, updated_at)
select id, num, frente_id, responsable_id, trim(actividad), estado, avance, inicio, fin, coalesce(notas, ''), created_at, updated_at
from public.tasks;

-- Deja constancia en el historial.
insert into seguimiento.historial (usuario, rol, accion, resumen, detalle)
select 'sistema', null, 'migracion', 'Datos migrados desde la versión anterior (esquema public)',
       jsonb_build_object(
         'frentes', (select count(*) from seguimiento.frentes),
         'responsables', (select count(*) from seguimiento.responsables),
         'actividades', (select count(*) from seguimiento.actividades));

commit;

-- Verificación: debe coincidir con la versión anterior.
select
  (select count(*) from seguimiento.frentes)      as frentes,
  (select count(*) from seguimiento.responsables) as responsables,
  (select count(*) from seguimiento.actividades)  as actividades,
  (select count(*) from public.frentes)           as frentes_anterior,
  (select count(*) from public.responsables)      as responsables_anterior,
  (select count(*) from public.tasks)             as actividades_anterior;
