import type { NextRequest } from "next/server";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, periodoActual } from "@/lib/format";
import { DATASETS, esDataset, puedeExportar } from "@/lib/exportar/datasets";
import { construirDataset, ErrorExportacion } from "@/lib/exportar/consultas";
import { generarXlsx } from "@/lib/exportar/xlsx";

/**
 * GET /api/exportar?dataset=<nombre>&periodo=YYYY-MM-01[&cliente=<uuid>]
 * Devuelve una planilla .xlsx con el dataset pedido. Autorización por dataset
 * (ver `src/lib/exportar/datasets.ts`); las consultas pasan por RLS igual.
 * Es dinámico por naturaleza (lee cookies de sesión): no se cachea.
 */

const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function textoPlano(mensaje: string, status: number): Response {
  return new Response(mensaje, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const perfil = await getPerfil();
  if (!perfil) {
    return textoPlano("Tenés que iniciar sesión para descargar planillas.", 401);
  }

  const params = request.nextUrl.searchParams;
  const dataset = (params.get("dataset") ?? "").trim();
  if (!dataset) {
    return textoPlano("Falta indicar qué planilla querés descargar (dataset).", 400);
  }
  if (!esDataset(dataset)) {
    return textoPlano(`No existe la planilla "${dataset}".`, 400);
  }
  if (!puedeExportar(perfil.rol, dataset)) {
    return textoPlano(
      `Tu usuario no tiene permiso para descargar la planilla de ${DATASETS[dataset].label.toLowerCase()}.`,
      403
    );
  }

  const def = DATASETS[dataset];
  const periodoCrudo = (params.get("periodo") ?? "").trim();
  let periodo = periodoActual();
  if (periodoCrudo) {
    if (!/^\d{4}-\d{2}-01$/.test(periodoCrudo)) {
      return textoPlano("El período tiene que venir como AAAA-MM-01 (por ejemplo 2026-08-01).", 400);
    }
    const mes = Number(periodoCrudo.slice(5, 7));
    if (mes < 1 || mes > 12) {
      return textoPlano("El mes del período no es válido.", 400);
    }
    periodo = periodoCrudo;
  }

  // Filtro opcional por cliente (cuenta corriente / pagos de una carpeta).
  const clienteCrudo = (params.get("cliente") ?? "").trim();
  if (clienteCrudo && !/^[0-9a-f-]{36}$/i.test(clienteCrudo)) {
    return textoPlano("El cliente no es válido.", 400);
  }
  const clienteId = clienteCrudo || null;

  try {
    const supabase = await createClient();
    const hojas = await construirDataset(dataset, { supabase, perfil, periodo, clienteId });
    const bytes = await generarXlsx(hojas);

    const sufijo = def.mensual ? periodo.slice(0, 7) : hoyISO();
    const nombreArchivo = `mercado-san-miguel-${dataset}-${sufijo}.xlsx`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": MIME_XLSX,
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ErrorExportacion) {
      return textoPlano(`No pudimos armar la planilla: ${error.message}`, 400);
    }
    console.error("[exportar]", dataset, error);
    return textoPlano(
      "No pudimos armar la planilla por un error inesperado. Probá de nuevo en un rato.",
      500
    );
  }
}
