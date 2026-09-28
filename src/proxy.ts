import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esFallaPasajera } from "@/lib/sesion";

const RUTAS_PUBLICAS = ["/login"];

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No ejecutar código entre createServerClient y getClaims: mantiene la sesión fresca.
  // getClaims valida la firma del token acá mismo (claves asimétricas del proyecto):
  // no le pega a Supabase Auth en cada pedido y cada prefetch como getUser, y solo
  // llama para renovar el token cuando está por vencer.
  const { data, error } = await supabase.auth.getClaims();
  const hayUsuario = Boolean(data?.claims?.sub);

  const esPublica = RUTAS_PUBLICAS.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta)
  );

  if (!hayUsuario && !esPublica) {
    // Falla pasajera (red cortada, Supabase lento): NO se echa a nadie al login.
    // La página lo vuelve a intentar y, si sigue sin conexión, muestra "Reintentar".
    if (error && esFallaPasajera(error)) return respuesta;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Tenía sesión y se venció o la cerraron: el login explica qué pasó.
    const teniaSesion = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
    if (teniaSesion) url.searchParams.set("motivo", "sesion");
    return NextResponse.redirect(url);
  }

  // Con sesión en /login NO se redirige acá: lo decide login/page.tsx con el perfil.
  // Si el usuario fue desactivado (o es del Consejo) con la sesión abierta, redirigir
  // a "/" armaba un bucle /login → / → /login. El login avisa y deja entrar con otro.

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
