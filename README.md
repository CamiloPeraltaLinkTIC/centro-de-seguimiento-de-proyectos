# Centro de seguimiento de proyectos

Tablero de seguimiento de proyectos de LinkTIC. Proyecto inicial: plan de trabajo MATERAN (creación, expectativa y lanzamiento de marca).
Next.js 16 + Supabase (Postgres, Auth y Realtime), listo para desplegar en Vercel.

## Funcionalidades

- Gantt por frente con escalas Mes / Semana / Día, línea de "hoy", hitos y actividades atrasadas.
- Resumen de avance ponderado por duración, avance por frente, atrasadas y próximas a vencer.
- Filtros por estado, frente, responsable y búsqueda. Exportación a CSV.
- **Roles**
  - `admin`: crea, edita, elimina y arrastra actividades; gestiona frentes y responsables.
  - `lector`: ve todo en modo solo lectura.
- Cambios en tiempo real entre todos los usuarios conectados.
- Para cerrar sesión, visita `/salir`. Al pasar el cursor sobre el indicador de sincronización se ve el usuario y su rol.

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en este orden:
   1. `supabase/migrations/0001_schema.sql`: tablas, roles y políticas RLS.
   2. `supabase/migrations/0002_responsables.sql`: catálogo de responsables.
   3. `supabase/seed.sql`: datos iniciales (6 frentes, 17 responsables, 38 actividades).
3. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* para que solo entren los usuarios que crees.
4. Crea los usuarios en **Authentication → Users → Add user → Create new user** (marca *Auto Confirm User*). Todos nacen como `lector`.
5. Promueve a los administradores en el SQL Editor (ver `supabase/roles.sql`):

   ```sql
   update public.profiles set role = 'admin' where email = 'tu-correo@linktic.com';
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
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (o la `anon` key en proyectos antiguos) |

## 3. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio de GitHub.
2. Agrega las dos variables de entorno anteriores (Production, Preview y Development).
3. Despliega. Vercel detecta Next.js automáticamente.
4. En Supabase → **Authentication → URL Configuration**, pon la URL de Vercel como *Site URL*.

## Estructura

```
src/
  app/
    page.tsx            # carga datos y rol del usuario (server)
    login/              # pantalla de ingreso
    salir/route.ts      # cerrar sesión (/salir)
  components/
    Dashboard.tsx       # estado, tiempo real y escritura en Supabase
    Gantt.tsx           # diagrama y arrastre para reprogramar
    TaskDrawer.tsx      # crear / editar actividad
    FrentesDrawer.tsx   # gestionar frentes
    ResponsablesDrawer.tsx
  lib/
    gantt.ts            # tipos y utilidades de fechas
    supabase/           # clientes browser / server / proxy
  proxy.ts              # refresca la sesión y protege las rutas
supabase/
  migrations/           # esquema, RLS y realtime
  seed.sql              # datos iniciales
  data/                 # export original del tablero
```

La seguridad se aplica en la base de datos con Row Level Security: aunque alguien manipule el cliente, solo los perfiles `admin` pueden escribir.
