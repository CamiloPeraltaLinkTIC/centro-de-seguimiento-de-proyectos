-- Login solo con contraseña: la app usa dos cuentas fijas.
-- 1. Créalas en Supabase → Authentication → Users → Add user → Create new user (marca "Auto Confirm User"),
--    con los mismos correos de AUTH_ADMIN_EMAIL y AUTH_LECTOR_EMAIL y una contraseña DISTINTA para cada una.
-- 2. Ejecuta esto para dar el rol de administrador (ajusta el correo si usaste otro):

update public.profiles set role = 'admin' where email = 'admin@seguimiento.linktic.com';
update public.profiles set role = 'lector' where email = 'lector@seguimiento.linktic.com';

-- Verificar:
-- select email, role from public.profiles;

-- Cambiar una contraseña: Authentication → Users → (usuario) → Reset password / Update user.
