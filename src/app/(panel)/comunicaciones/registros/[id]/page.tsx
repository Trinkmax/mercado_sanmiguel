import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, FileText, MapPin, UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaHora, hoyISO } from "@/lib/format";
import { categoriasDeRol, type CategoriaCliente } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import {
  HiloRegistro,
  type EventoRegistro,
  type MensajeRegistro,
} from "@/components/comunicaciones/hilo-registro";
import {
  fechasDelHilo,
  LineaEstadoRegistro,
} from "@/components/comunicaciones/linea-estado-registro";
import { MultaRegistro } from "@/components/comunicaciones/multa-registro";
import { ResponderRegistro } from "@/components/comunicaciones/responder-registro";
import {
  estadoMulta,
  etiquetaLugar,
  infoTipoRegistro,
  nombreMensajeSocio,
  nombreRegistro,
  selloEstadoRegistro,
  type TipoRegistro,
} from "@/components/comunicaciones/constantes";

export const metadata = { title: "Registro" };

export default async function RegistroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("admin", "lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("sanciones")
    .select(
      "id, numero, tipo, titulo, detalle, fecha, storage_path, estado, visto_en, socio_leyo_en, ultimo_mensaje_en, multa, multa_vencimiento, multa_sin_efecto_en, multa_sin_efecto_por, multa_sin_efecto_motivo, creado_en, creado_por, cliente_id, clientes(id, codigo, nombre, apodo, categoria), espacios(tipo, numero, medio), cargos(id, estado, monto, monto_pagado, creado_en)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const cliente = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
  if (!cliente) notFound();

  const idsPerfiles = [r.creado_por, r.multa_sin_efecto_por].filter((x): x is string => Boolean(x));
  const [mensajesRes, portalRes, perfilesRes] = await Promise.all([
    supabase
      .from("registro_mensajes")
      .select("id, autor_id, autor_nombre, autor_rol, mensaje, es_descargo, creado_en, adjunto_path")
      .eq("registro_id", r.id)
      .order("creado_en", { ascending: true }),
    supabase.from("v_clientes_segmentos").select("tiene_portal").eq("cliente_id", cliente.id).maybeSingle(),
    idsPerfiles.length > 0
      ? supabase.from("perfiles").select("user_id, nombre").in("user_id", idsPerfiles)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string }[] }),
  ]);
  const nombres = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));

  const paths = [r.storage_path, ...(mensajesRes.data ?? []).map((m) => m.adjunto_path)].filter(
    (p): p is string => Boolean(p)
  );
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const tipo = r.tipo as TipoRegistro;
  const info = infoTipoRegistro(tipo);
  const mensajes: MensajeRegistro[] = (mensajesRes.data ?? []).map((m) => ({
    ...m,
    adjunto_url: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
  }));
  const { descargoEn, respondidoEn } = fechasDelHilo(mensajes);
  const tienePortal = Boolean(portalRes.data?.tiene_portal);
  const puedeGestionar = categoriasDeRol(perfil.rol).includes(cliente.categoria as CategoriaCliente);
  const espacio = Array.isArray(r.espacios) ? r.espacios[0] : r.espacios;
  const cargoRaw = Array.isArray(r.cargos) ? r.cargos[0] : r.cargos;
  const cargo = cargoRaw
    ? { estado: cargoRaw.estado, monto: Number(cargoRaw.monto), monto_pagado: Number(cargoRaw.monto_pagado) }
    : null;
  // Lo que se descontó solo de su saldo a favor: no bloquea "Dejar sin efecto" y vuelve a su
  // cuenta. Mismo criterio que dejar_sin_efecto_multa (0025): lo que imputó
  // aplicar_saldo_favor (origen 'saldo_favor') o, en filas viejas (de antes de 0023, sin
  // creado_en), pagos ANTERIORES a la multa. Una imputación nueva con origen 'cobro' es un
  // cobro de caja para la multa aunque el pago tenga fecha apenas anterior.
  let pagadoConSaldo = 0;
  if (cargoRaw && Number(cargoRaw.monto_pagado) > 0 && cargoRaw.estado !== "anulado") {
    const { data: imps } = await supabase
      .from("imputaciones")
      .select("monto, origen, creado_en, pagos!inner(fecha)")
      .eq("cargo_id", cargoRaw.id);
    const creado = new Date(cargoRaw.creado_en).getTime();
    for (const i of imps ?? []) {
      const pago = Array.isArray(i.pagos) ? i.pagos[0] : i.pagos;
      const filaVieja = i.creado_en === null;
      const anterior = filaVieja && pago ? new Date(pago.fecha).getTime() < creado : false;
      if (i.origen === "saldo_favor" || anterior) pagadoConSaldo += Number(i.monto);
    }
  }
  const multa = r.multa === null ? null : Number(r.multa);
  const eMulta = estadoMulta({ multa, multa_sin_efecto_en: r.multa_sin_efecto_en, cargo });
  const quienSinEfecto = r.multa_sin_efecto_por ? (nombres.get(r.multa_sin_efecto_por) ?? null) : null;
  const eventos: EventoRegistro[] = r.multa_sin_efecto_en
    ? [
        {
          id: "sin-efecto",
          fecha: r.multa_sin_efecto_en,
          texto: `${quienSinEfecto ?? "Alguien del equipo"} dejó sin efecto la multa${
            r.multa_sin_efecto_motivo ? `: ${r.multa_sin_efecto_motivo}` : ""
          }`,
        },
      ]
    : [];
  const docUrl = r.storage_path ? urls.get(r.storage_path) : undefined;
  const esperaRespuesta = r.estado === "descargo";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2 min-h-11">
        <Link href={`/comunicaciones?tab=${info.pestana}`}>
          <ArrowLeft className="size-4" />
          Volver a {info.plural}
        </Link>
      </Button>

      <PageHeader titulo={nombreRegistro(r)} descripcion={r.titulo} className="pb-0">
        <Sello estado={tipo} />
        <Sello estado={selloEstadoRegistro(r)} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          {/* Recorrido y si lo vio */}
          <Card>
            <CardContent className="space-y-4">
              <LineaEstadoRegistro
                tipo={tipo}
                estado={r.estado}
                notificadoEn={r.creado_en}
                descargoEn={descargoEn}
                respondidoEn={respondidoEn}
              />
              <p className="flex items-center gap-2 border-t pt-3 text-sm">
                {!tienePortal ? (
                  <>
                    <UserX className="size-4 text-parcial" strokeWidth={2} />
                    <span className="text-parcial">No tiene usuario del portal: avisale en persona.</span>
                  </>
                ) : r.visto_en ? (
                  <>
                    <Eye className="size-4 text-pagado" strokeWidth={2} />
                    <span>
                      Visto por el socio el{" "}
                      <span className="font-semibold tabular">{formatFechaHora(r.visto_en)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="size-4 text-muted-foreground" strokeWidth={2} />
                    <span className="text-muted-foreground">El socio todavía no lo abrió.</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Qué pasó */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Qué pasó</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.detalle ? (
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.detalle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin detalle.</p>
              )}
              {docUrl ? (
                <Button asChild variant="outline" className="min-h-11">
                  <a href={docUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="size-4" strokeWidth={2} />
                    Ver documento
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* Hilo */}
          <section className="space-y-4" aria-label="Mensajes">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {nombreMensajeSocio(tipo).singular} y respuestas
            </h2>
            <HiloRegistro mensajes={mensajes} eventos={eventos} usuarioId={perfil.user_id} tipo={tipo} />
            {puedeGestionar ? (
              <ResponderRegistro
                registroId={r.id}
                esperaRespuesta={esperaRespuesta}
                nombreSocio={cliente.nombre}
                sinPortal={!tienePortal}
              />
            ) : (
              <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                Este cliente es de Portería: lo gestiona el Jefe de Portería junto al Líder de Procesos.
              </p>
            )}
          </section>
        </div>

        {/* Costado: a quién y la multa */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Para</p>
              <Link href={`/clientes/${cliente.id}`} className="block text-lg font-semibold leading-snug hover:underline">
                {cliente.nombre}
              </Link>
              <p className="text-sm text-muted-foreground">
                Carpeta N° <span className="tabular">{cliente.codigo}</span>
                {cliente.apodo ? ` · ${cliente.apodo}` : ""}
              </p>
              {espacio ? (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="size-4 text-primary" strokeWidth={2} />
                  {etiquetaLugar(espacio)}
                </p>
              ) : null}
              <p className="border-t pt-2 text-sm text-muted-foreground">
                Del <span className="tabular">{formatFecha(r.fecha)}</span> · lo emitió{" "}
                {r.creado_por ? (nombres.get(r.creado_por) ?? "—") : "—"}
              </p>
            </CardContent>
          </Card>

          {eMulta !== "sin_multa" && multa !== null ? (
            <MultaRegistro
              registroId={r.id}
              monto={multa}
              pagado={cargo?.monto_pagado ?? 0}
              pagadoConSaldo={pagadoConSaldo}
              vencimiento={r.multa_vencimiento}
              estado={eMulta}
              sinEfecto={
                r.multa_sin_efecto_en
                  ? { en: r.multa_sin_efecto_en, por: quienSinEfecto, motivo: r.multa_sin_efecto_motivo }
                  : null
              }
              puedeGestionar={puedeGestionar}
              hoy={hoyISO()}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
