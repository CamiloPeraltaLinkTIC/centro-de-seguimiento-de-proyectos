# Centro de seguimiento de proyectos

Tablero de seguimiento de proyectos de LinkTIC. Proyecto inicial: plan de trabajo MATERAN (creación, expectativa y lanzamiento de marca).
Next.js 16 + Supabase (Postgres), listo para desplegar en Vercel.

## Funcionalidades

- Gantt por frente con escalas Mes / Semana / Día, línea de "hoy", hitos y actividades atrasadas.
- Resumen de avance ponderado por duración, avance por frente, atrasadas y próximas a vencer.
- Filtros por estado, frente, responsable y búsqueda. Exportación a CSV.
- Ingreso con **usuario y contraseña** guardados en la tabla `seguimiento.usuarios` (contraseñas hasheadas con scrypt). Hay tres roles:

  | Rol | Ver tablero | Editar actividades, frentes y responsables | Historial y usuarios |
  | --- | :---: | :---: | :---: |
  | `admin` (Administrador) | ✅ | ✅ | ✅ |
  | `editor` (Editor) | ✅ | ✅ | ❌ |
  | `lector` (Lector) | ✅ | ❌ | ❌ |

- **Usuarios** (`/usuarios`, solo administradores): crear usuarios, cambiar el rol, activar o desactivar, y restablecer contraseñas (la nueva se muestra una sola vez). Nadie puede cambiar su propio rol ni desactivarse, y siempre queda al menos un administrador activo.

- **Historial** (`/historial`, solo administradores): inicios y cierres de sesión, ingresos fallidos o bloqueados, y cada creación, edición o eliminación, con el usuario, la IP y los valores de antes y después. El historial no se puede modificar ni borrar.
- El tablero se actualiza solo cada 15 segundos (y al volver a la pestaña) con los cambios de otros usuarios.
- En la barra superior: usuario, rol, accesos a **Usuarios** e **Historial** (administradores) y botón **Cerrar sesión**.

## 1. Configurar Supabase

Todo vive en el esquema propio **`seguimiento`**, así no choca con otros proyectos del mismo Supabase.

1. En **SQL Editor**, ejecuta en orden:
   1. `supabase/migrations/0001_seguimiento.sql`: esquema, tablas, historial y permisos.
   2. `supabase/seed.sql`: datos iniciales (6 frentes, 17 responsables, 38 actividades). Si ya hay actividades, no inserta nada.
   3. El SQL de usuarios iniciales (ver *Usuarios iniciales*).
2. En **Project Settings → API → Data API → Exposed schemas**, agrega `seguimiento` y guarda. Es seguro: el esquema solo da permisos al rol del servidor (`service_role`).
3. En **Project Settings → API Keys**, copia la *Project URL* y la **Secret key** (`sb_secret_…`, o `service_role` en proyectos antiguos). **No** la publishable: con ella la app no arranca.

Si ejecutaste scripts de versiones anteriores (que creaban tablas en `public`), revisa `supabase/diagnostico_version_anterior.sql` **antes** de borrar nada: confirma que esas tablas no son de otro proyecto.

### Usuarios iniciales

Después, los administradores gestionan los usuarios desde `/usuarios`. Para la primera carga:

1. Crea un archivo `usuarios.local.json` (git lo ignora):

   ```json
   [
     { "usuario": "Ana.Gómez", "rol": "admin", "password": "una-contraseña-larga" },
     { "usuario": "pedro.ruiz", "rol": "lector" }
   ]
   ```

   Si omites `password`, se genera una aleatoria y se muestra una sola vez.
2. Ejecuta `node scripts/usuarios.mjs usuarios.local.json > supabase/usuarios.local.sql`.
3. Ejecuta `supabase/usuarios.local.sql` en el SQL Editor (solo contiene hashes) y luego borra ambos archivos.

Los usuarios no distinguen mayúsculas ni tildes: `Audry.muñoz` también entra como `audry.munoz`. Las contraseñas sí distinguen mayúsculas.

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
| `SESSION_SECRET` | 32 caracteres aleatorios o más, para firmar las sesiones |

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Cerrar todas las sesiones:** cambia `SESSION_SECRET`.

## 3. Desarrollo local

```bash
cp .env.example .env.local   # completa los valores
npm install
npm run dev
```

## 4. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio de GitHub.
2. En **Settings → Environment Variables**, agrega `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SESSION_SECRET`. Marca Production y Preview.
3. Despliega. Vercel detecta Next.js automáticamente.

## Estructura

```
src/
  app/
    page.tsx            # verifica la sesión y carga los datos (server)
    login/              # pantalla y acción de ingreso
    historial/          # historial de cambios (solo administradores)
    usuarios/           # gestión de usuarios (solo administradores)
    sesion/expirada/    # limpia una sesión que ya no es válida
    salir/              # cerrar sesión (POST)
    board/actions.ts    # lectura y escritura del tablero (server actions)
  components/
    Dashboard.tsx       # estado del tablero; llama a las server actions
    Gantt.tsx           # diagrama y arrastre para reprogramar
    TaskDrawer.tsx      # crear / editar actividad
    FrentesDrawer.tsx   # gestionar frentes
    ResponsablesDrawer.tsx
  lib/
    auth.ts             # firma y verificación de la sesión
    session.ts          # sesión validada contra seguimiento.usuarios
    credentials.ts      # hash y verificación de contraseñas (scrypt)
    audit.ts            # registro en el historial
    gantt.ts            # tipos y utilidades de fechas
    supabase/           # cliente de servidor (server-only) y tipos
  proxy.ts              # protección de rutas y CSP con nonce
supabase/
  migrations/           # esquema `seguimiento` y seguridad
  seed.sql              # datos iniciales
  data/                 # export original del tablero
```

## Seguridad

- **Sin claves en el navegador.** El navegador nunca recibe la URL de Supabase, ninguna clave ni la librería de Supabase. Todo pasa por *server actions*.
- **Esquema aislado y cerrado.** Todo está en `seguimiento`, con RLS activo sin políticas, y los roles `anon` y `authenticated` no tienen privilegios. Solo el servidor, con la secret key, puede leer o escribir. Aunque alguien obtenga la publishable key, no puede acceder a los datos.
- **Contraseñas hasheadas con scrypt** en `seguimiento.usuarios`. Nunca se guardan ni se muestran en texto plano, salvo una contraseña recién generada, que se muestra una vez al administrador.
- **Sesión firmada (HMAC-SHA256)** en una cookie `httpOnly`, `Secure` en producción y `SameSite=Lax`, con expiración de 12 horas. Cada página y cada acción confirman en la base de datos que el usuario siga activo y que su rol y su contraseña no hayan cambiado; si cambiaron, sus sesiones se cierran de inmediato.
- **Autorización en el servidor:** cada server action y cada página verifican la firma de la sesión y el rol antes de tocar la base de datos.
- **Credenciales:** se comparan en tiempo constante (también para usuarios inexistentes) y el error es genérico. Tras **10 intentos fallidos por IP en 15 minutos**, el ingreso se bloquea temporalmente (se registra en `seguimiento.intentos_ingreso`).
- **Validación** de tipos, formatos (UUID, fechas, colores) y longitudes en el servidor, y restricciones `CHECK` en la base de datos.
- **Cabeceras:** Content-Security-Policy con nonce por petición (`connect-src 'self'`, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Además, se oculta `X-Powered-By`.
- **Historial inmutable:** solo admite insertar, y un trigger impide modificar o borrar registros de `seguimiento.historial`.
- **CSRF:** Next.js rechaza las server actions de otro origen, y el cierre de sesión se hace por POST.

