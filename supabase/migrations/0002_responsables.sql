-- Responsables como catálogo editable: renombrar un responsable actualiza todas sus actividades.

create table if not exists public.responsables (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists responsable_id uuid references public.responsables (id) on delete restrict;
create index if not exists tasks_responsable_idx on public.tasks (responsable_id);

-- Migra los textos existentes (si los hay) al catálogo.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'responsable') then
    insert into public.responsables (nombre)
      select distinct trim(responsable) from public.tasks where trim(responsable) <> ''
      on conflict (nombre) do nothing;
    update public.tasks t set responsable_id = r.id from public.responsables r where r.nombre = trim(t.responsable);
    alter table public.tasks drop column responsable;
  end if;
end $$;

alter table public.responsables enable row level security;

drop policy if exists "leer responsables" on public.responsables;
create policy "leer responsables" on public.responsables for select to authenticated using (true);
drop policy if exists "admin escribe responsables" on public.responsables;
create policy "admin escribe responsables" on public.responsables for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'responsables') then
    alter publication supabase_realtime add table public.responsables;
  end if;
end $$;
