import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Origen de Supabase, permitido solo para que el navegador suba PDFs con un permiso firmado (sin llaves). */
function storageOrigin() {
  try {
    return process.env.SUPABASE_URL ? ` ${new URL(process.env.SUPABASE_URL).origin}` : "";
  } catch {
    return "";
  }
}

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""};
    worker-src 'self' blob:;
    style-src 'self' 'nonce-${nonce}';
    style-src-attr 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data: blob:;
    connect-src 'self'${storageOrigin()};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? "" : "upgrade-insecure-requests;"}
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Presentaciones HTML subidas por los administradores: corren aisladas (`sandbox` sin allow-same-origin = origen propio,
 * sin cookies ni acceso a la app), pueden usar sus propios scripts, estilos y recursos externos, y solo se dejan
 * enmarcar por la app. No pueden enviar formularios ni navegar la página principal.
 */
const PRESENTACION_CSP = `
  sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox;
  default-src 'none';
  script-src 'unsafe-inline' 'unsafe-eval' https: data: blob:;
  style-src 'unsafe-inline' https: data: blob:;
  img-src https: data: blob:;
  font-src https: data: blob:;
  media-src https: data: blob:;
  connect-src https: data: blob:;
  frame-src https:;
  form-action 'none';
  base-uri 'none';
  frame-ancestors 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim();
const PRESENTACION = /^\/documentos\/[0-9a-f-]{36}\/(presentacion|miniatura)$/i;

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = PRESENTACION.test(request.nextUrl.pathname) ? PRESENTACION_CSP : contentSecurityPolicy(nonce);

  // Verificación optimista de la sesión; cada server action y página la vuelve a verificar.
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  let response: NextResponse;
  if (!session && !isLogin) response = NextResponse.redirect(new URL("/login", request.url));
  else if (session && isLogin) response = NextResponse.redirect(new URL("/", request.url));
  else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (!session && request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
