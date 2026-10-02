-- Diagnóstico de los scripts anteriores (que creaban tablas en el esquema `public`).
-- ⚠️ Este Supabase lo comparten varios proyectos: revisa antes de borrar nada.

-- 1. ¿Qué tablas de `public` tienen los nombres que usaban los scripts anteriores, y qué columnas tienen?
select table_name, string_agg(column_name, ', ' order by ordinal_position) as columnas
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tasks', 'frentes', 'responsables', 'profiles', 'login_attempts', 'audit_log')
group by table_name
order by table_name;
-- Las nuestras tienen estas columnas:
--   tasks: id, num, frente_id, actividad, … estado, avance, inicio, fin, notas …
--   frentes: id, nombre, color, orden, created_at
--   responsables: id, nombre, created_at
--   profiles: id, email, role, created_at
--   login_attempts: id, ip, created_at

-- 2. Si TODAS esas tablas son de este proyecto (y no de otro), puedes borrarlas.
--    Quita los guiones (--) de las líneas siguientes SOLO después de confirmarlo:
-- drop table if exists public.tasks;
-- drop table if exists public.responsables;
-- drop table if exists public.frentes;
-- drop table if exists public.profiles;
-- drop table if exists public.login_attempts;
-- drop function if exists public.is_admin();
-- drop function if exists public.handle_new_user();
-- drop trigger if exists on_auth_user_created on auth.users;
