import type { NextRequest } from "next/server";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { imagenRecibo, type DatosRecibo } from "@/lib/recibo-imagen";

/**
 * GET /api/recibo-imagen/<pagoId>: el recibo como imagen, para mandarlo por WhatsApp o guardarlo
 * en el celular de un toque (el PDF pide cuatro pasos que casi nadie sabe hacer). `datos_recibo`
 * pasa por los permisos de siempre: el socio solo ve los suyos. No se cachea.
 */

function textoPlano(mensaje: string, status: number): Response {
  return new Response(mensaje, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ pagoId: string }> }): Promise<Response> {
  const perfil = await getPerfil();
  if (!perfil) return textoPlano("Tenés que iniciar sesión para ver el recibo.", 401);
  const { pagoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(pagoId)) return textoPlano("No encontramos ese recibo.", 404);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("datos_recibo", { p_pago: pagoId });
  if (error || !data) return textoPlano("No encontramos ese recibo.", 404);
  return imagenRecibo(data as unknown as DatosRecibo, new URL("/logo.png", request.url).href);
}
