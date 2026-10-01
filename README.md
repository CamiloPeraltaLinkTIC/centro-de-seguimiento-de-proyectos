# Centro de seguimiento de proyectos

Tablero de seguimiento de proyectos de LinkTIC. Proyecto inicial: plan de trabajo MATERAN (creación, expectativa y lanzamiento de marca).
Next.js 16 + Supabase (Postgres), listo para desplegar en Vercel.

## Funcionalidades

- Gantt por frente con escalas Mes / Semana / Día, línea de "hoy", hitos y actividades atrasadas.
- Resumen de avance ponderado por duración, avance por frente, atrasadas y próximas a vencer.
- Filtros por estado, frente, responsable y búsqueda. Exportación a CSV.
- Ingreso con **usuario y contraseña definidos en variables de entorno**. Hay dos roles:
  - `admin`: crea, edita, elimina y arrastra actividades; gestiona frentes y responsables.
  - `lector`: ve todo en modo solo lectura.
- El tablero se actualiza solo cada 15 segundos (y al volver a la pestaña) con los cambios de otros usuarios.
- Para cerrar sesión, visita `/salir`.

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en este orden:
   1. `supabase/migrations/0001_schema.sql`: tablas, restricciones y cierre de acceso.
   2. `supabase/migrations/0002_actualizar_version_anterior.sql`: actualiza bases creadas con scripts anteriores (en una base nueva no hace nada).
   3. `supabase/seed.sql`: datos iniciales (6 frentes, 17 responsables, 38 actividades). Si ya hay actividades, no inserta nada.
3. En **Project Settings → API Keys**, copia la *Project URL* y la **Secret key** (`sb_secret_…`, o `service_role` en proyectos antiguos). **No** la publishable: con ella la app no arranca.

No hace falta crear usuarios en Supabase Auth: las credenciales están en variables de entorno.

### Regenerar la semilla

Los datos fuente están en `supabase/data/materan-data.json`. Si los cambias:

```bash
node scripts/generate-seed.mjs
```

## 2. Variables de entorno

Todas son **solo de servidor**: ninguna lleva el prefijo `NEXT_PUBLIC_`, así que nunca llegan al navegador.

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciales del administrador |
| `LECTOR_USERNAME` / `LECTOR_PASSWORD` | Credenciales del lector |
| `SESSION_SECRET` | 32 caracteres aleatorios o más, para firmar las sesiones |

- Las contraseñas deben tener 12 caracteres o más (recomendado: 16 o más). Los dos usuarios deben ser distintos.
- Genera `SESSION_SECRET` con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Cambiar una contraseña:** actualiza la variable y vuelve a desplegar. Las sesiones abiertas de ese rol se cierran solas.
**Cerrar todas las sesiones:** cambia `SESSION_SECRET`.

## 3. Desarrollo local

```bash
cp .env.example .env.local   # completa los valores
npm install
npm run dev
```

## 4. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio de GitHub.
2. En **Settings → Environment Variables**, agrega todas las variables de la tabla anterior (marca Production y Preview). Si quieres, usa credenciales distintas para Preview.
3. Despliega. Vercel detecta Next.js automáticamente.

## Estructura

```
src/
  app/
    page.tsx            # verifica la sesión y carga los datos (server)
    login/              # pantalla y acción de ingreso
    salir/              # cerrar sesión (POST)
    board/actions.ts    # lectura y escritura del tablero (server actions)
  components/
    Dashboard.tsx       # estado del tablero; llama a las server actions
    Gantt.tsx           # diagrama y arrastre para reprogramar
    TaskDrawer.tsx      # crear / editar actividad
    FrentesDrawer.tsx   # gestionar frentes
    ResponsablesDrawer.tsx
  lib/
    auth.ts             # credenciales, firma y verificación de la sesión
    session.ts          # lectura de la sesión en el servidor
    gantt.ts            # tipos y utilidades de fechas
    supabase/           # cliente de servidor (server-only) y tipos
  proxy.ts              # protección de rutas y CSP con nonce
supabase/
  migrations/           # esquema y seguridad
  seed.sql              # datos iniciales
  data/                 # export original del tablero
```

## Seguridad

- **Sin claves en el navegador.** El navegador nunca recibe la URL de Supabase, ninguna clave ni la librería de Supabase. Todo pasa por *server actions*.
- **Base de datos cerrada.** RLS está activo sin políticas y los roles `anon` y `authenticated` no tienen privilegios. Solo el servidor, con la secret key, puede leer o escribir. Aunque alguien obtenga la publishable key, no puede acceder a los datos.
- **Sesión firmada (HMAC-SHA256)** en una cookie `httpOnly`, `Secure` en producción y `SameSite=Lax`, con expiración de 12 horas. La firma depende de la contraseña del rol: al cambiarla, se cierran las sesiones de ese rol.
- **Autorización en el servidor:** cada server action y cada página verifican la firma de la sesión y el rol antes de tocar la base de datos.
- **Credenciales:** se comparan en tiempo constante y el error es genérico. Tras **10 intentos fallidos por IP en 15 minutos**, el ingreso se bloquea temporalmente (se registra en la tabla `login_attempts`).
- **Validación** de tipos, formatos (UUID, fechas, colores) y longitudes en el servidor, y restricciones `CHECK` en la base de datos.
- **Cabeceras:** Content-Security-Policy con nonce por petición (`connect-src 'self'`, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Además, se oculta `X-Powered-By`.
- **CSRF:** Next.js rechaza las server actions de otro origen, y el cierre de sesión se hace por POST.

> Las credenciales son compartidas: todos los administradores usan el mismo usuario y contraseña. Si más adelante necesitas trazabilidad por persona, conviene pasar a cuentas individuales.
