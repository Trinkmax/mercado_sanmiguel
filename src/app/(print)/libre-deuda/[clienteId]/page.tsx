import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, HandCoins } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { ROLES_COBRAN } from "@/lib/roles";
import { categoriasDeRol, LABEL_CATEGORIA, type CategoriaCliente } from "@/lib/segmentos";
import { createClient } from "@/lib/supabase/server";
import { formatNumero, periodoActual } from "@/lib/format";
import { armarLibresDeuda } from "@/lib/libre-deuda";
import { marcarLibresDeuda } from "@/lib/actions/libres-deuda";
import { Button } from "@/components/ui/button";
import { Sello } from "@/components/shared/sello";
import { Money } from "@/components/shared/money";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { HojaLibreDeuda } from "@/components/libre-deuda/hoja-libre-deuda";

export const metadata = { title: "Libre deuda" };

type Props = { params: Promise<{ clienteId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LibreDeudaPage({ params }: Props) {
  // Lo emite quien gestiona al cliente: Administración (puesteros), el Jefe (quinteros y
  // ambulantes) y el Líder (todos). Tesorería no (J4: no ve clientes).
  const perfil = await requireRol("admin", "guardia", "lider");
  const { clienteId } = await params;
  if (!UUID.test(clienteId)) notFound();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, codigo, nombre, cuit, categoria")
    .eq("id", clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!cliente) notFound();

  const categoria = cliente.categoria as CategoriaCliente;
  if (!categoriasDeRol(perfil.rol).includes(categoria)) {
    const quien = categoria === "puestero" || categoria === "empleado" ? "Administración" : "el Jefe de Portería";
    return (
      <div className="space-y-6 py-10">
        <div className="etiqueta">
          <div className="etiqueta-interior space-y-5 py-10 text-center">
            <h1 className="font-display text-2xl font-semibold">El libre deuda lo emite {quien}</h1>
            <p className="text-lg">
              <strong>{cliente.nombre}</strong> es {LABEL_CATEGORIA[categoria].toLowerCase()}: su cuenta la
              lleva {quien}.
            </p>
            <Button asChild variant="outline" size="lg" className="h-13 px-5 text-base">
              <Link href="/clientes">
                <ArrowLeft className="size-5" />
                Volver
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const puedeCobrar = ROLES_COBRAN.includes(perfil.rol);

  const periodo = periodoActual();
  const [{ libres, conDeuda }, configRes] = await Promise.all([
    armarLibresDeuda(supabase, perfil.org_id, [clienteId], periodo),
    supabase.from("configuracion").select("impresion_directa").eq("org_id", perfil.org_id).maybeSingle(),
  ]);
  const autoImprimir = Boolean(configRes.data?.impresion_directa);
  const ld = libres[0];
  const deuda = conDeuda[0]?.deuda ?? 0;

  // Con deuda no hay libre deuda: lo decimos claro y mandamos a cobrar.
  if (!ld) {
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
              {puedeCobrar ? (
                <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
                  <Link href={`/cobranza/${cliente.id}`}>
                    <HandCoins className="size-5" />
                    Cobrar ahora
                  </Link>
                </Button>
              ) : null}
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

  return (
    <>
      <BotonImprimir
        volverA={`/clientes/${cliente.id}`}
        autoImprimir={autoImprimir}
        alImprimir={marcarLibresDeuda.bind(null, [cliente.id], periodo)}
      />
      <HojaLibreDeuda ld={ld} />
    </>
  );
}
