import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, supabaseEnv } from "./config";

/**
 * Refresca la sesión de Supabase y redirige a /login si no hay usuario.
 * `requestHeaders` permite propagar cabeceras (p. ej. el nonce de la CSP) a la página.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        // Las cookies del request viajan en la cabecera "cookie": se copia para que la página vea la sesión renovada.
        requestHeaders.set("cookie", request.cookies.toString());
        response = next();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, { ...options, ...cookieOptions });
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!data?.claims && !isLogin) return redirect("/login");
  if (data?.claims && isLogin) return redirect("/");
  return response;
}
