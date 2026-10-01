-- Gantt MATERAN · esquema, roles y políticas de acceso
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).

-- ---------- Perfiles y roles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'lector' check (role in ('admin', 'lector')),
  created_at timestamptz not null default now()
);

-- Crea el perfil (rol lector) automáticamente al registrar un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- ---------- Frentes ----------
create table if not exists public.frentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#86858A',
  orden int not null default 999,
  created_at timestamptz not null default now()
);

-- ---------- Actividades ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  num int not null,
  frente_id uuid not null references public.frentes (id) on delete restrict,
  actividad text not null,
  responsable text not null default '',
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Cerrada')),
  avance int not null default 0 check (avance between 0 and 100),
  inicio date not null,
  fin date not null,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_fechas check (fin >= inicio)
);
create index if not exists tasks_frente_idx on public.tasks (frente_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.frentes enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "leer frentes" on public.frentes;
create policy "leer frentes" on public.frentes for select to authenticated using (true);
drop policy if exists "admin escribe frentes" on public.frentes;
create policy "admin escribe frentes" on public.frentes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "leer tasks" on public.tasks;
create policy "leer tasks" on public.tasks for select to authenticated using (true);
drop policy if exists "admin escribe tasks" on public.tasks;
create policy "admin escribe tasks" on public.tasks for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Realtime (cambios en vivo entre usuarios) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'frentes') then
    alter publication supabase_realtime add table public.frentes;
  end if;
end $$;
