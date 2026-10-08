-- Categorías (filtros) de la documentación, gestionadas por los administradores desde /documentos.
-- documentos.categoria sigue guardando el nombre, ahora con llave foránea: al renombrar una categoría
-- sus documentos se actualizan solos (on update cascade). Antes de eliminar una, la app pasa sus documentos a "General".

create table if not exists seguimiento.documento_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 60 and nombre = trim(nombre)),
  created_at timestamptz not null default now()
);
create unique index if not exists documento_categorias_nombre_ci on seguimiento.documento_categorias (lower(nombre));

-- "General" siempre existe: es la categoría por defecto y el destino de los documentos de una categoría eliminada.
insert into seguimiento.documento_categorias (nombre) values ('General') on conflict do nothing;

-- Categorías que ya usan los documentos (sin duplicar por mayúsculas/minúsculas).
update seguimiento.documentos set categoria = trim(categoria) where categoria <> trim(categoria);
insert into seguimiento.documento_categorias (nombre)
select distinct on (lower(categoria)) categoria from seguimiento.documentos order by lower(categoria), created_at
on conflict do nothing;
update seguimiento.documentos d set categoria = c.nombre
from seguimiento.documento_categorias c
where lower(c.nombre) = lower(d.categoria) and d.categoria <> c.nombre;

alter table seguimiento.documentos drop constraint if exists documentos_categoria_fk;
alter table seguimiento.documentos add constraint documentos_categoria_fk
  foreign key (categoria) references seguimiento.documento_categorias (nombre) on update cascade on delete restrict;

alter table seguimiento.documento_categorias enable row level security;
revoke all on seguimiento.documento_categorias from public, anon, authenticated;
grant select, insert, update, delete on seguimiento.documento_categorias to service_role;
