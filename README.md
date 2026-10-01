# Centro de seguimiento de proyectos

Tablero de seguimiento de proyectos de LinkTIC. Proyecto inicial: plan de trabajo MATERAN (creación, expectativa y lanzamiento de marca).
Next.js 16 + Supabase (Postgres y Auth), listo para desplegar en Vercel.

## Funcionalidades

- Gantt por frente con escalas Mes / Semana / Día, línea de "hoy", hitos y actividades atrasadas.
- Resumen de avance ponderado por duración, avance por frente, atrasadas y próximas a vencer.
- Filtros por estado, frente, responsable y búsqueda. Exportación a CSV.
- **Roles**
  - `admin`: crea, edita, elimina y arrastra actividades; gestiona frentes y responsables.
  - `lector`: ve todo en modo solo lectura.
- El tablero se actualiza solo cada 15 segundos (y al volver a la pestaña) con los cambios de otros usuarios.
- Para cerrar sesión, visita `/salir`. Al pasar el cursor sobre el indicador de sincronización se ve el usuario y su rol.

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en este orden:
   1. `supabase/migrations/0001_schema.sql`: tablas, roles y políticas RLS.
   2. `supabase/migrations/0002_responsables.sql`: catálogo de responsables.
   3. `supabase/migrations/0003_seguridad.sql`: permisos mínimos, límites y cierre de acceso anónimo.
   4. `supabase/seed.sql`: datos iniciales (6 frentes, 17 responsables, 38 actividades).
3. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* para que solo entren los usuarios que crees.
4. El ingreso es **solo con contraseña**: hay una de administrador y otra de lector. Crea dos usuarios en **Authentication → Users → Add user → Create new user** (marca *Auto Confirm User*):
   - `admin@seguimiento.linktic.com` con la contraseña de administrador.
   - `lector@seguimiento.linktic.com` con la contraseña de lector.

   Usa contraseñas **distintas** y largas (16 caracteres o más). Los correos no se muestran en ninguna parte; si usas otros, cámbialos también en las variables `AUTH_*_EMAIL`.
5. Asigna los roles en el SQL Editor (`supabase/roles.sql`):

   ```sql
   update public.profiles set role = 'admin' where email = 'admin@seguimiento.linktic.com';
   ```

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) también puedes usar `supabase link` y `supabase db push`.

### Regenerar la semilla

Los datos fuente están en `supabase/data/materan-data.json`. Si los cambias:

```bash
node scripts/generate-seed.mjs
```

## 2. Desarrollo local

```bash
cp .env.example .env.local   # completa con los datos de Project Settings → API
npm install
npm run dev
```

| Variable | Dónde se encuentra |
| --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_KEY` | Project Settings → API Keys → Publishable key (o la `anon` key en proyectos antiguos). **Nunca** la secret / service_role. |

| `AUTH_ADMIN_EMAIL` | Correo de la cuenta de administrador creada en el paso 4 |
| `AUTH_LECTOR_EMAIL` | Correo de la cuenta de lector creada en el paso 4 |

Todas son variables **solo de servidor** (no llevan el prefijo `NEXT_PUBLIC_`): Next.js no las incluye en el código que se envía al navegador.

## 3. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio de GitHub.
2. Agrega `SUPABASE_URL`, `SUPABASE_KEY`, `AUTH_ADMIN_EMAIL` y `AUTH_LECTOR_EMAIL` en **Settings → Environment Variables** (Production, Preview y Development). No las marques como expuestas al cliente.
3. Despliega. Vercel detecta Next.js automáticamente.
4. En Supabase → **Authentication → URL Configuration**, pon la URL de Vercel como *Site URL*.

## Estructura

```
src/
  app/
    page.tsx            # carga datos y rol del usuario (server)
    login/              # pantalla de ingreso
    salir/              # cerrar sesión (/salir, por POST)
    board/actions.ts    # lectura y escritura del tablero (server actions)
  components/
    Dashboard.tsx       # estado del tablero; llama a las server actions
    Gantt.tsx           # diagrama y arrastre para reprogramar
    TaskDrawer.tsx      # crear / editar actividad
    FrentesDrawer.tsx   # gestionar frentes
    ResponsablesDrawer.tsx
  lib/
    gantt.ts            # tipos y utilidades de fechas
    supabase/           # clientes de servidor (server-only)
  proxy.ts              # sesión, protección de rutas y CSP con nonce
supabase/
  migrations/           # esquema, RLS y refuerzo de seguridad
  seed.sql              # datos iniciales
  data/                 # export original del tablero
```

## Seguridad

- **Sin claves en el navegador.** El navegador nunca recibe la URL ni ninguna clave de Supabase, ni carga su librería. Login, lecturas y escrituras se hacen con *server actions*.
- **Sesión en cookies `httpOnly`**, `Secure` en producción y `SameSite=Lax`: JavaScript no puede leerlas.
- **Autorización en dos capas:** cada server action valida la sesión, el rol `admin` y los datos recibidos. La base de datos lo verifica otra vez con Row Level Security.
- **Permisos mínimos en Postgres:** el rol anónimo no tiene acceso; el rol de cada usuario no se puede modificar desde la app.
- **Validación** de tipos, formatos (UUID, fechas, colores) y longitudes en el servidor y con restricciones en la base de datos.
- **Cabeceras:** Content-Security-Policy con nonce por petición (`connect-src 'self'`, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Además, se oculta `X-Powered-By`.
- **CSRF:** Next.js rechaza las server actions de otro origen, y el cierre de sesión se hace por POST.
- **Login solo con contraseña:** la contraseña define el rol (admin o lector). Los correos de las cuentas viven solo en el servidor, el mensaje de error es genérico, el registro público está desactivado y Supabase Auth limita los intentos. Para cambiar una contraseña, usa Authentication → Users en Supabase.

> Nota: como el login pasa por el servidor, Supabase ve las IP de Vercel. Sus límites de intentos por IP alcanzan para un equipo pequeño. Si crece, ajusta los *Rate Limits* en Authentication.
