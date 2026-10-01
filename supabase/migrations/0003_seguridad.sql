-- Refuerzo de seguridad.
-- La app accede a Supabase solo desde el servidor; aun así la base de datos se protege por sí misma.

-- 1. El rol anónimo (sin sesión) no tiene ningún acceso a las tablas ni a las funciones.
revoke all on public.profiles, public.frentes, public.tasks, public.responsables from anon;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.is_admin() to authenticated;

-- 2. Los usuarios autenticados solo tienen los privilegios que necesitan (RLS decide además qué filas).
revoke all on public.profiles, public.frentes, public.tasks, public.responsables from authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.frentes, public.tasks, public.responsables to authenticated;
-- Nadie puede cambiarse el rol desde la app: profiles no tiene políticas de escritura.

-- 3. Límites de longitud y formato a nivel de base de datos.
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

-- 4. Sin tiempo real: el navegador ya no se conecta a Supabase, así que se retiran las tablas de la publicación.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'frentes', 'responsables'] loop
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
