"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { formatARS, labelPeriodo, parseMonto, sanitizarMonto } from "@/lib/format";
import { crearGasto } from "@/lib/actions/gastos";
import { comprimirImagen } from "@/lib/imagen";
import { MIME_PERMITIDOS, TAMANO_MAX_SUBIDA } from "@/lib/storage";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  mensajePesoAdjunto,
} from "@/components/comunicaciones/adjuntos";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SelectorRubro } from "@/components/gastos/selector-rubro";
import {
  SelectorOrigen,
  origenCompleto,
  origenInicial,
} from "@/components/gastos/selector-origen";
import { avisarPago } from "@/components/gastos/acciones-gasto";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { delDia, type CajaElegible, type OrigenPago, type Rubro } from "@/components/gastos/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

const AYUDA_TIPO = {
  fijo: "Se repite todos los meses: el mes que viene lo traés con un toque, cambiando solo el monto.",
  variable: "Es solo de este mes: no se trae al mes siguiente.",
} as const;

/** "Cargar gasto" del mes elegido: descripción opcional y, si ya se pagó, de dónde salió la plata. */
export function DialogNuevoGasto({
  rubros,
  frecuentes,
  periodo,
  cajas,
  hoy,
  preferirCaja,
  cajaPreseleccionadaId = null,
}: {
  rubros: Rubro[];
  frecuentes: string[];
  /** "YYYY-MM-01": el mes al que corresponde el gasto (el que se está mirando). */
  periodo: string;
  cajas: CajaElegible[];
  hoy: string;
  preferirCaja: boolean;
  /** Viene de la caja (`/gastos?caja=…`): arranca en "¿Ya lo pagaste? Sí" con esa caja elegida. */
  cajaPreseleccionadaId?: string | null;
}) {
  const router = useRouter();
  const cajaElegida = cajaPreseleccionadaId
    ? cajas.find((c) => c.id === cajaPreseleccionadaId) ?? null
    : null;
  const [abierto, setAbierto] = useState(false);
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [tipo, setTipo] = useState<"fijo" | "variable" | null>(null);
  const [monto, setMonto] = useState("");
  const [yaPagado, setYaPagado] = useState(Boolean(cajaElegida));
  const [origen, setOrigen] = useState<OrigenPago>(() =>
    origenInicial({ cajas, preferirCaja, cajaPreseleccionadaId, hoy })
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // Clave del formulario: la MISMA hasta que se guarde bien (un corte de red no la
  // renueva, así el reintento no carga el gasto dos veces).
  const refForm = useRef<string | null>(null);

  const montoNumero = parseMonto(monto);

  function reiniciar() {
    setRubro(null);
    setTipo(null);
    setMonto("");
    setYaPagado(Boolean(cajaElegida));
    setOrigen(origenInicial({ cajas, preferirCaja, cajaPreseleccionadaId, hoy }));
    setError(null);
    refForm.current = null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rubro) {
      setError("Elegí el rubro del gasto.");
      return;
    }
    if (montoNumero <= 0) {
      setError("Poné el monto del gasto.");
      return;
    }
    if (!tipo) {
      setError("Elegí si se repite todos los meses.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const factura = fd.get("factura");
    if (factura instanceof File && factura.size > 0 && !MIME_PERMITIDOS.includes(factura.type)) {
      setError("La factura tiene que ser un PDF o una foto (JPG, PNG o WEBP). Elegí otro archivo.");
      return;
    }
    refForm.current ??= uuidV4();
    fd.set("ref", refForm.current);
    fd.set("rubro_id", rubro.id);
    fd.set("tipo", tipo);
    fd.set("monto", String(montoNumero));
    fd.set("periodo", periodo);
    if (yaPagado) {
      fd.set("pagar_origen", origen.origen);
      fd.set("pagar_medio", origen.origen === "caja" ? "efectivo" : origen.medio);
      if (origen.origen === "caja" && origen.caja?.id) fd.set("pagar_caja", origen.caja.id);
      if (origen.origen === "tesoreria") fd.set("pagar_fecha", origen.fecha);
    }
    setError(null);
    startTransition(async () => {
      // La foto de la factura se achica antes de mandarla (una foto de tablet pesa 3–8 MB); lo
      // que se manda no puede pasar de 4 MB (tope por pedido en Vercel).
      if (factura instanceof File && factura.size > 0) {
        const chica = await comprimirImagen(factura);
        if (chica.size > TAMANO_MAX_SUBIDA) {
          setError(mensajePesoAdjunto(chica.size));
          return;
        }
        fd.set("factura", chica, chica.name);
      } else {
        fd.delete("factura");
      }
      const res = await llamarAccion(() => crearGasto(fd));
      if (!res.ok) {
        // Se queda todo como estaba (y con la misma clave) para tocar de nuevo.
        setError(res.error);
        return;
      }
      setAbierto(false);
      reiniciar();
      if (res.data.errorPago) {
        toast.warning(`El gasto quedó cargado, pero no se pudo pagar: ${res.data.errorPago}`);
      } else if (res.data.pago) {
        avisarPago(res.data.pago, hoy, (href) => router.push(href));
      } else if (res.data.repetido) {
        toast.info(
          res.data.estado === "pagado"
            ? "Ese gasto ya estaba cargado y pagado (del intento anterior): no se repitió."
            : "Ese gasto ya estaba cargado (del intento anterior): no se cargó dos veces."
        );
      } else {
        toast.success(`Cargaste ${formatARS(montoNumero)} en ${labelPeriodo(periodo)}.`);
      }
    });
  }

  const listo =
    Boolean(rubro) && Boolean(tipo) && montoNumero > 0 && (!yaPagado || origenCompleto(origen, hoy));

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        if (v) {
          // La caja elegida sale de la URL (?caja=) y Next conserva este estado al cambiar solo
          // la URL: al abrir se vuelve a tomar la de ahora, para no pagar desde una caja que
          // ya se dejó (la clave del formulario no se toca).
          setYaPagado(Boolean(cajaElegida));
          setOrigen(origenInicial({ cajas, preferirCaja, cajaPreseleccionadaId, hoy }));
          setError(null);
        }
        setAbierto(v);
        if (!v) reiniciar();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 px-6 text-base font-semibold">
          <Plus className="size-5" strokeWidth={2} />
          Cargar gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">Cargar gasto de {labelPeriodo(periodo)}</DialogTitle>
          <DialogDescription className="text-sm">
            {cajaElegida
              ? `Si salió del cajón, queda pagado con la caja ${delDia(cajaElegida.fecha, hoy)}.`
              : "Anotalo una sola vez. Si todavía no lo pagaste, lo pagás después desde la lista."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base">Rubro</Label>
            <SelectorRubro
              rubros={rubros}
              frecuentes={frecuentes}
              valor={rubro}
              onCambiar={(r) => {
                setRubro(r);
                setError(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-monto" className="text-base">
              Monto
            </Label>
            <Input
              id="gasto-monto"
              inputMode="decimal"
              autoComplete="off"
              className="h-13 text-xl font-semibold tabular"
              placeholder="0"
              value={monto}
              onChange={(e) => {
                setMonto(sanitizarMonto(e.target.value).slice(0, 15));
                setError(null);
              }}
            />
            <p className="min-h-5 text-base font-semibold tabular text-muted-foreground">
              {montoNumero > 0 ? formatARS(montoNumero) : "Los centavos van con coma: 1234,50"}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-base font-medium">¿Se repite todos los meses?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["fijo", "variable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    "min-h-12 rounded-lg border text-base font-medium transition-colors",
                    tipo === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-accent"
                  )}
                >
                  {t === "fijo" ? "Sí, es fijo" : "No, es variable"}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {tipo ? AYUDA_TIPO[tipo] : "Los fijos se traen al mes siguiente con un toque; los variables no."}
            </p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="gasto-descripcion" className="text-base">
              Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="gasto-descripcion"
              name="descripcion"
              className="h-12 text-base"
              maxLength={200}
              placeholder={rubro ? `Si la dejás vacía dice «${rubro.nombre}»` : "Si la dejás vacía usamos el nombre del rubro"}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gasto-vencimiento" className="text-base">
                Vence <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="gasto-vencimiento" name="vencimiento" type="date" className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gasto-factura" className="text-base">
                Factura <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="gasto-factura"
                name="factura"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="h-12 pt-3 text-sm"
                onChange={(e) => {
                  const pesado = errorPesoAdjunto(e.target.files?.[0]);
                  if (pesado) e.target.value = "";
                  setError(pesado);
                }}
              />
              <p className="text-sm text-muted-foreground">PDF o foto. {AYUDA_PESO_ADJUNTO}</p>
            </div>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="group flex min-h-11 items-center gap-1.5 text-base font-medium text-primary">
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" strokeWidth={2} />
              Agregar una nota
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Label htmlFor="gasto-notas" className="sr-only">
                Nota
              </Label>
              <Textarea id="gasto-notas" name="notas" rows={2} maxLength={500} className="text-base" />
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-4 rounded-xl border p-4">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span className="text-base font-medium">¿Ya lo pagaste?</span>
              <Switch checked={yaPagado} onCheckedChange={setYaPagado} aria-label="¿Ya lo pagaste?" />
            </label>
            {yaPagado ? (
              <SelectorOrigen
                valor={origen}
                onCambiar={setOrigen}
                cajas={cajas}
                monto={montoNumero}
                hoy={hoy}
                idBase="nuevo-gasto"
              />
            ) : null}
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo cargar el gasto" /> : null}

          <Button
            type="submit"
            size="lg"
            className="h-auto min-h-13 w-full py-2.5 text-base leading-snug font-semibold whitespace-normal"
            disabled={pendiente || !listo}
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            {yaPagado
              ? `Cargar y pagar ${montoNumero > 0 ? formatARS(montoNumero) : ""}`.trim()
              : `Cargar gasto${montoNumero > 0 ? ` de ${formatARS(montoNumero)}` : ""}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
