import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, HandCoins } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatNumero, hoyISO, saldoCargo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/shared/marca";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { BotonImprimir } from "@/components/shared/boton-imprimir";

export const metadata = { title: "Libre deuda" };

type Props = { params: Promise<{ clienteId: string }> };

export default async function LibreDeudaPage({ params }: Props) {
  await requireRol("admin", "tesoreria", "consejo");
  const { clienteId } = await params;
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, codigo, nombre, cuit")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) notFound();

  const [cargosRes, itemsRes] = await Promise.all([
    supabase
      .from("cargos")
      .select("estado, monto, monto_pagado, descuento_pronto_pago, vencimiento")
      .eq("cliente_id", clienteId)
      .in("estado", ["pendiente", "parcial"]),
    supabase
      .from("cliente_conceptos")
      .select("cantidad, activo, conceptos(codigo, nombre)")
      .eq("cliente_id", clienteId)
      .eq("activo", true),
  ]);

  const deuda = (cargosRes.data ?? []).reduce(
    (acc, c) => acc + saldoCargo(c),
    0
  );

  // Con deuda no hay libre deuda: lo decimos claro y mandamos a cobrar.
  if (deuda > 0) {
    return (
      <div className="space-y-6 py-10">
        <div className="etiqueta">
          <div className="etiqueta-interior space-y-6 py-10 text-center">
            <Sello grande estado="debe" texto="Debe" className="mx-auto" />
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
                No podemos emitir el libre deuda
              </h1>
              <p className="text-lg">
                <strong>{cliente.nombre}</strong> (carpeta N°{" "}
                {formatNumero(cliente.codigo)}) debe hoy{" "}
                <Money monto={deuda} className="font-bold text-pendiente" />.
              </p>
              <p className="text-muted-foreground">
                Cuando salde todo, el libre deuda sale al toque desde su ficha.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
                <Link href={`/cobranza/${cliente.id}`}>
                  <HandCoins className="size-5" />
                  Cobrar ahora
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-13 px-5 text-base">
                <Link href={`/clientes/${cliente.id}`}>
                  <ArrowLeft className="size-5" />
                  Volver a la ficha
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const conceptos = (itemsRes.data ?? [])
    .map((i) => ({
      codigo: i.conceptos?.codigo ?? "?",
      nombre: i.conceptos?.nombre ?? "Concepto",
      cantidad: Number(i.cantidad),
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  return (
    <>
      <BotonImprimir volverA={`/clientes/${cliente.id}`} />

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-8 p-8">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
            <Marca />
            <div className="text-right text-sm text-muted-foreground">
              <p>Malagueño, Córdoba</p>
              <p>Emitido el {formatFecha(hoyISO())}</p>
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-6">
            <h1 className="font-display text-5xl font-bold uppercase tracking-wide">
              Libre deuda
            </h1>
            <Sello grande estado="pagado" texto="Libre deuda" />
          </div>

          <section className="space-y-1">
            <p className="text-2xl font-semibold">{cliente.nombre}</p>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <Codigo codigo={`N° ${cliente.codigo}`} />
              {cliente.cuit ? <span>CUIT {cliente.cuit}</span> : null}
            </div>
          </section>

          <p className="text-lg leading-relaxed">
            No registra deudas con la Cooperativa Mercado San Miguel al{" "}
            <strong>{formatFecha(hoyISO())}</strong>.
          </p>

          {conceptos.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Conceptos que abona
              </h2>
              <ul className="space-y-2">
                {conceptos.map((c) => (
                  <li key={c.codigo} className="flex items-center gap-3">
                    <Codigo codigo={c.codigo} />
                    <span className="flex-1">{c.nombre}</span>
                    <span className="text-muted-foreground tabular">
                      × {formatNumero(c.cantidad)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="pt-16">
            <div className="mx-auto w-64 border-t border-foreground pt-2 text-center text-sm">
              Administración
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Comprobante interno — sin validez fiscal
          </p>
        </div>
      </div>
    </>
  );
}
