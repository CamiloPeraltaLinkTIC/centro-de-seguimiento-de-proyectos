-- Asignar roles. Los usuarios se crean en Supabase → Authentication → Users
-- (Add user → Create new user, con "Auto Confirm User"). Todos nacen como 'lector'.

-- Promover a administrador:
update public.profiles set role = 'admin' where email = 'admin@ejemplo.com';

-- Volver a lector:
-- update public.profiles set role = 'lector' where email = 'persona@ejemplo.com';

-- Ver usuarios y roles:
-- select email, role, created_at from public.profiles order by created_at;
