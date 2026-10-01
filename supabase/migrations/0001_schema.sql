-- Centro de seguimiento de proyectos · esquema y seguridad
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`), y después supabase/seed.sql.
--
-- Modelo de acceso: SOLO el servidor de la app (con la secret key) lee y escribe.
-- RLS está activo sin políticas y los roles anon/authenticated no tienen privilegios:
-- nadie puede usar la API de datos con la publishable key.

-- ---------- Frentes ----------
create table if not exists public.frentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 120),
  color text not null default '#86858A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden int not null default 999,
  created_at timestamptz not null default now()
);

-- ---------- Responsables ----------
create table if not exists public.responsables (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- ---------- Actividades ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  num int not null check (num > 0),
  frente_id uuid not null references public.frentes (id) on delete restrict,
  responsable_id uuid references public.responsables (id) on delete restrict,
  actividad text not null check (char_length(trim(actividad)) between 1 and 300),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Cerrada')),
  avance int not null default 0 check (avance between 0 and 100),
  inicio date not null,
  fin date not null,
  notas text not null default '' check (char_length(notas) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_fechas check (fin >= inicio)
);
create index if not exists tasks_frente_idx on public.tasks (frente_id);
create index if not exists tasks_responsable_idx on public.tasks (responsable_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- Intentos de ingreso fallidos (límite contra fuerza bruta) ----------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip, created_at);

-- ---------- Cierre de acceso ----------
alter table public.frentes enable row level security;
alter table public.responsables enable row level security;
alter table public.tasks enable row level security;
alter table public.login_attempts enable row level security;

revoke all on public.frentes, public.responsables, public.tasks, public.login_attempts from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
