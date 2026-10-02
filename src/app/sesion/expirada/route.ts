import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Limpia una cookie de sesión que ya no es válida (usuario desactivado, contraseña o rol cambiados).
 * Si la sesión sigue siendo válida no hace nada, así que no sirve para cerrar la sesión de otro.
 */
export async function GET(request: NextRequest) {
  if (await getSession()) return NextResponse.redirect(new URL("/", request.url));
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
