-- Actualiza una base creada con versiones anteriores de los scripts (con Supabase Auth, perfiles y realtime)
-- al modelo actual. Es seguro ejecutarlo también en una base nueva: si no hay nada que migrar, no hace nada.

-- 1. Responsables: de texto libre en tasks.responsable al catálogo public.responsables.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'tasks' and column_name = 'responsable') then
    insert into public.responsables (nombre)
      select distinct trim(responsable) from public.tasks where trim(coalesce(responsable, '')) <> ''
      on conflict (nombre) do nothing;
    update public.tasks t set responsable_id = r.id
      from public.responsables r
      where t.responsable_id is null and r.nombre = trim(t.responsable);
    alter table public.tasks drop column responsable;
  end if;
end $$;

-- 2. Quitar políticas RLS antiguas (dependían de perfiles de Supabase Auth).
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('frentes', 'tasks', 'responsables', 'profiles', 'login_attempts') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3. Quitar perfiles, roles y el disparador sobre auth.users (ya no se usa Supabase Auth).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
  end if;
end $$;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop table if exists public.profiles;

-- 4. Restricciones de datos (las tablas antiguas no las tenían).
alter table public.frentes drop constraint if exists frentes_nombre_len;
alter table public.frentes add constraint frentes_nombre_len check (char_length(trim(nombre)) between 1 and 120);
alter table public.frentes drop constraint if exists frentes_color_hex;
alter table public.frentes add constraint frentes_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.responsables drop constraint if exists responsables_nombre_len;
alter table public.responsables add constraint responsables_nombre_len check (char_length(trim(nombre)) between 1 and 120);
alter table public.tasks drop constraint if exists tasks_actividad_len;
alter table public.tasks add constraint tasks_actividad_len check (char_length(trim(actividad)) between 1 and 300);
alter table public.tasks drop constraint if exists tasks_notas_len;
alter table public.tasks add constraint tasks_notas_len check (char_length(notas) <= 5000);
alter table public.tasks drop constraint if exists tasks_num_pos;
alter table public.tasks add constraint tasks_num_pos check (num > 0);

-- 5. Sin realtime: la app ya no se conecta desde el navegador.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tasks', 'frentes', 'responsables'] loop
      if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime drop table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- 6. Cierre de acceso: solo el servidor (secret key) lee y escribe.
alter table public.frentes enable row level security;
alter table public.responsables enable row level security;
alter table public.tasks enable row level security;
alter table public.login_attempts enable row level security;
revoke all on public.frentes, public.responsables, public.tasks, public.login_attempts from anon, authenticated;

-- El servidor (secret key = rol service_role) conserva acceso explícito.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.frentes, public.responsables, public.tasks, public.login_attempts to service_role;
grant usage, select on all sequences in schema public to service_role;
