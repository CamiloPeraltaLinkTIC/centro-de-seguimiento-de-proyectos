-- Centro de seguimiento de proyectos · esquema propio "seguimiento"
--
-- Todo vive en el esquema `seguimiento` para no chocar con otros proyectos del mismo Supabase.
-- Modelo de acceso: SOLO el servidor de la app (secret key = rol service_role) lee y escribe.
-- Los roles anon/authenticated no tienen ningún privilegio sobre este esquema.
--
-- Después de ejecutarlo: Project Settings → API → Data API → "Exposed schemas": agrega `seguimiento`.

create schema if not exists seguimiento;

-- ---------- Usuarios de la app ----------
create table if not exists seguimiento.usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,60}$'),   -- normalizado: minúsculas, sin tildes
  nombre text not null check (char_length(trim(nombre)) between 1 and 100), -- como se muestra (p. ej. "Audry.muñoz")
  rol text not null check (rol in ('admin', 'editor', 'lector')),
  password_hash text not null check (password_hash like 'scrypt.%'),
  activo boolean not null default true,
  ultimo_ingreso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Frentes ----------
create table if not exists seguimiento.frentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 120),
  color text not null default '#86858A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden int not null default 999,
  created_at timestamptz not null default now()
);

-- ---------- Responsables ----------
create table if not exists seguimiento.responsables (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- ---------- Actividades ----------
create table if not exists seguimiento.actividades (
  id uuid primary key default gen_random_uuid(),
  num int not null check (num > 0),
  frente_id uuid not null references seguimiento.frentes (id) on delete restrict,
  responsable_id uuid references seguimiento.responsables (id) on delete restrict,
  actividad text not null check (char_length(trim(actividad)) between 1 and 300),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Cerrada')),
  avance int not null default 0 check (avance between 0 and 100),
  inicio date not null,
  fin date not null,
  notas text not null default '' check (char_length(notas) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actividades_fechas check (fin >= inicio)
);
create index if not exists actividades_frente_idx on seguimiento.actividades (frente_id);
create index if not exists actividades_responsable_idx on seguimiento.actividades (responsable_id);

create or replace function seguimiento.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists actividades_touch on seguimiento.actividades;
create trigger actividades_touch before update on seguimiento.actividades
  for each row execute function seguimiento.touch_updated_at();
drop trigger if exists usuarios_touch on seguimiento.usuarios;
create trigger usuarios_touch before update on seguimiento.usuarios
  for each row execute function seguimiento.touch_updated_at();

-- ---------- Historial (solo insertar y leer) ----------
create table if not exists seguimiento.historial (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  usuario text not null check (char_length(usuario) <= 100),
  rol text check (rol in ('admin', 'editor', 'lector')),
  accion text not null check (char_length(accion) <= 60),
  entidad text check (char_length(entidad) <= 40),
  entidad_id text check (char_length(entidad_id) <= 100),
  resumen text not null default '' check (char_length(resumen) <= 500),
  detalle jsonb,
  ip text check (char_length(ip) <= 64)
);
create index if not exists historial_fecha_idx on seguimiento.historial (created_at desc);
create index if not exists historial_usuario_idx on seguimiento.historial (usuario, created_at desc);
create index if not exists historial_accion_idx on seguimiento.historial (accion, created_at desc);

create or replace function seguimiento.historial_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial no se puede modificar ni eliminar.';
end;
$$;
drop trigger if exists historial_inmutable on seguimiento.historial;
create trigger historial_inmutable before update or delete on seguimiento.historial
  for each row execute function seguimiento.historial_inmutable();

-- ---------- Intentos de ingreso fallidos (límite contra fuerza bruta) ----------
create table if not exists seguimiento.intentos_ingreso (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists intentos_ingreso_ip_idx on seguimiento.intentos_ingreso (ip, created_at);

-- ---------- Acceso: solo service_role ----------
alter table seguimiento.usuarios enable row level security;
alter table seguimiento.frentes enable row level security;
alter table seguimiento.responsables enable row level security;
alter table seguimiento.actividades enable row level security;
alter table seguimiento.historial enable row level security;
alter table seguimiento.intentos_ingreso enable row level security;

revoke all on schema seguimiento from public, anon, authenticated;
revoke all on all tables in schema seguimiento from public, anon, authenticated;
revoke all on all sequences in schema seguimiento from public, anon, authenticated;
revoke all on all functions in schema seguimiento from public, anon, authenticated;

grant usage on schema seguimiento to service_role;
grant select, insert, update, delete on seguimiento.usuarios, seguimiento.frentes, seguimiento.responsables, seguimiento.actividades, seguimiento.intentos_ingreso to service_role;
grant select, insert on seguimiento.historial to service_role;
grant usage, select on all sequences in schema seguimiento to service_role;
