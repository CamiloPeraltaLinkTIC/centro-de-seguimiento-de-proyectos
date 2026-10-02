-- Documentación del proyecto: PDFs en un bucket PRIVADO de Supabase Storage.
-- Solo el servidor de la app (service_role) puede leer o escribir los archivos; el navegador nunca recibe
-- un enlace directo. Cada visualización queda en seguimiento.historial (accion = 'documento_visto').

-- Bucket privado, solo PDF, máximo 50 MB por archivo. Nombre con prefijo para no chocar con otros proyectos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seguimiento-documentos', 'seguimiento-documentos', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Sin políticas sobre storage.objects para este bucket: anon/authenticated no tienen acceso; service_role sí.

create table if not exists seguimiento.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) between 1 and 200),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  categoria text not null default 'General' check (char_length(trim(categoria)) between 1 and 60),
  archivo text not null unique check (archivo ~ '^[0-9a-f-]{36}\.pdf$'),   -- ruta dentro del bucket
  tamano bigint not null check (tamano > 0 and tamano <= 52428800),
  subido_por text not null,
  created_at timestamptz not null default now(),
  eliminado_at timestamptz,
  eliminado_por text
);
create index if not exists documentos_activos_idx on seguimiento.documentos (created_at desc) where eliminado_at is null;

-- Para consultar rápido las visualizaciones de cada documento.
create index if not exists historial_entidad_idx on seguimiento.historial (entidad, entidad_id, created_at desc);

alter table seguimiento.documentos enable row level security;
revoke all on seguimiento.documentos from public, anon, authenticated;
grant select, insert, update on seguimiento.documentos to service_role;
