import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { RegistrarVista } from "@/components/portal/registrar-vista";
import { CajaDescargo } from "@/components/portal/caja-descargo";
import {
  HiloRegistro,
  type EventoRegistro,
  type MensajeRegistro,
} from "@/components/comunicaciones/hilo-registro";
import {
  fechasDelHilo,
  LineaEstadoRegistro,
} from "@/components/comunicaciones/linea-estado-registro";
import {
  estadoMulta,
  etiquetaLugar,
  infoTipoRegistro,
  nombreRegistro,
  saldoMulta,
  SELLO_MULTA,
  type TipoRegistro,
} from "@/components/comunicaciones/constantes";

export const metadata = { title: "Comunicación" };

export default async function RegistroSocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("socio");
  const { id } = await params;
  const supabase = await createClient();

  // La RLS solo devuelve los registros propios: uno ajeno es un 404.
  const { data: r } = await supabase
    .from("sanciones")
    .select(
      "id, numero, tipo, titulo, detalle, fecha, storage_path, estado, multa, multa_vencimiento, multa_sin_efecto_en, creado_en, cargos(estado, monto, monto_pagado), espacios(tipo, numero, medio)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const { data: crudos } = await supabase
    .from("registro_mensajes")
    .select("id, autor_id, autor_nombre, autor_rol, mensaje, es_descargo, creado_en, adjunto_path")
    .eq("registro_id", r.id)
    .order("creado_en", { ascending: true });

  const paths = [r.storage_path, ...(crudos ?? []).map((m) => m.adjunto_path)].filter(
    (p): p is string => Boolean(p)
  );
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const tipo = r.tipo as TipoRegistro;
  const info = infoTipoRegistro(tipo);
  const mensajes: MensajeRegistro[] = (crudos ?? []).map((m) => ({
    ...m,
    adjunto_url: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
  }));
  const { descargoEn, respondidoEn } = fechasDelHilo(mensajes);
  const cargoRaw = Array.isArray(r.cargos) ? r.cargos[0] : r.cargos;
  const cargo = cargoRaw
    ? { estado: cargoRaw.estado, monto: Number(cargoRaw.monto), monto_pagado: Number(cargoRaw.monto_pagado) }
    : null;
  const espacio = Array.isArray(r.espacios) ? r.espacios[0] : r.espacios;
  const multa = r.multa === null ? null : Number(r.multa);
  const datosMulta = { multa, multa_sin_efecto_en: r.multa_sin_efecto_en, cargo };
  const eMulta = estadoMulta(datosMulta);
  const eventos: EventoRegistro[] = r.multa_sin_efecto_en
    ? [{ id: "multa", fecha: r.multa_sin_efecto_en, texto: "La multa quedó sin efecto: no la tenés que pagar" }]
    : [];
  const docUrl = r.storage_path ? urls.get(r.storage_path) : undefined;
  const yaEscribio = mensajes.some((m) => m.autor_rol === "socio");

  return (
    <div className="space-y-6">
      <RegistrarVista tipo="registro" id={r.id} />

      <Button asChild variant="ghost" className="-ml-2 min-h-11">
        <Link href={`/mi-cuenta/comunicaciones?tab=${info.pestana}`}>
          <ArrowLeft className="size-4" />
          Volver a {info.plural}
        </Link>
      </Button>

      <PageHeader titulo={nombreRegistro(r)} descripcion={r.titulo} className="pb-0">
        <Sello estado={tipo} />
      </PageHeader>

      <Card>
        <CardContent className="space-y-4">
          <LineaEstadoRegistro
            tipo={tipo}
            estado={r.estado}
            notificadoEn={r.creado_en}
            descargoEn={descargoEn}
            respondidoEn={respondidoEn}
            paraSocio
          />
          <p className="border-t pt-3 text-sm text-muted-foreground">
            Del <span className="tabular">{formatFecha(r.fecha)}</span>
            {espacio ? ` · ${etiquetaLugar(espacio)}` : ""}
          </p>
          {r.detalle ? (
            <p className="whitespace-pre-line text-base leading-relaxed">{r.detalle}</p>
          ) : null}
          {docUrl ? (
            <Button asChild variant="outline" className="min-h-12 w-full text-base sm:w-auto">
              <a href={docUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="size-5" strokeWidth={2} />
                Ver el documento
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {eMulta !== "sin_multa" && multa !== null ? (
        <section
          aria-label="Multa"
          className={cn(
            "space-y-2 rounded-xl border-2 p-4",
            eMulta === "sin_efecto"
              ? "border-border bg-muted/40"
              : eMulta === "pagada"
                ? "border-pagado/30 bg-pagado-suave"
                : "border-pendiente/30 bg-pendiente-suave"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">Multa</p>
            <Sello estado={SELLO_MULTA[eMulta].estado} texto={SELLO_MULTA[eMulta].texto} />
          </div>
          <Money
            monto={multa}
            className={cn(
              "block text-3xl font-bold",
              eMulta === "sin_efecto" ? "text-muted-foreground line-through" : eMulta === "pagada" ? "text-pagado" : "text-pendiente"
            )}
          />
          <p className="text-[15px]">
            {eMulta === "sin_efecto"
              ? "Quedó sin efecto: no la tenés que pagar."
              : eMulta === "pagada"
                ? "Ya está pagada. ¡Gracias!"
                : eMulta === "parcial"
                  ? (
                    <>
                      Te falta pagar <Money monto={saldoMulta(datosMulta)} className="font-semibold" />. Vence
                      el <span className="tabular">{formatFecha(r.multa_vencimiento)}</span>.
                    </>
                  )
                  : (
                    <>
                      Se sumó a tu cuenta · vence el{" "}
                      <span className="font-semibold tabular">{formatFecha(r.multa_vencimiento)}</span>.
                    </>
                  )}
          </p>
        </section>
      ) : null}

      <section className="space-y-4" aria-label="Mensajes">
        <h2 className="font-display text-lg font-bold tracking-tight">Mensajes</h2>
        <HiloRegistro
          mensajes={mensajes}
          eventos={eventos}
          usuarioId={perfil.user_id}
          tipo={tipo}
          paraSocio
        />
        <CajaDescargo registroId={r.id} tipo={tipo} yaEscribio={yaEscribio} />
      </section>
    </div>
  );
}
