"use client";

import { useId, useState, useTransition } from "react";
import { ChevronDown, Minus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { borrarAjusteCaja, registrarAjusteCaja } from "@/lib/actions/cajas";
import { cn, uuidV4 } from "@/lib/utils";
import { formatARS, formatFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Arqueo } from "@/components/caja/arqueo-tipos";
import type { AjusteCaja } from "@/components/caja/datos";

type Sentido = "falta" | "sobra";
type Cuenta = "efectivo" | "banco";

const ATAJOS: Record<Sentido, string[]> = {
  falta: ["Faltante en el conteo", "Comisión bancaria", "Redondeo"],
  sobra: ["Sobrante en el conteo", "Redondeo"],
};

const LABEL_CUENTA: Record<Cuenta, string> = { efectivo: "en efectivo", banco: "en el banco" };

const nuevoRef = uuidV4;

function MontoAjuste({ monto }: { monto: number }) {
  return (
    <span className={cn("tabular text-lg font-bold", monto < 0 ? "text-pendiente" : "text-pagado")}>
      {monto < 0 ? "−" : "+"}
      {formatARS(Math.abs(monto))}
    </span>
  );
}

/** Borrar un ajuste: pide el motivo (queda en la bitácora con el monto). */
function BotonBorrarAjuste({ ajuste }: { ajuste: AjusteCaja }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const id = useId();

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("Contá por qué lo borrás.");
      return;
    }
    startTransition(async () => {
      const res = await borrarAjusteCaja({ ajusteId: ajuste.id, motivo: limpio });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Ajuste borrado. Quedó anotado en el historial de la caja.");
      setAbierto(false);
      setMotivo("");
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (enviando) return;
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Borrar el ajuste de ${formatARS(Math.abs(ajuste.monto))}`}
        >
          <Trash2 className="size-5" strokeWidth={2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Borrar el ajuste</DialogTitle>
          <DialogDescription className="text-base">
            {ajuste.monto < 0 ? "Faltante" : "Sobrante"} de {formatARS(Math.abs(ajuste.monto))}{" "}
            {LABEL_CUENTA[ajuste.cuenta]}
            {ajuste.descripcion ? ` (${ajuste.descripcion})` : ""}. La cuenta del arqueo vuelve a como estaba y
            el borrado queda en el historial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={id} className="text-base">
            ¿Por qué lo borrás?
          </Label>
          <Textarea
            id={id}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej.: se cargó en la caja equivocada"
            aria-invalid={Boolean(error)}
            className="min-h-20 text-base md:text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={() => setAbierto(false)} disabled={enviando}>
            Volver
          </Button>
          <Button variant="destructive" size="lg" className="h-12 px-5 text-base font-semibold" onClick={confirmar} disabled={enviando}>
            {enviando ? <Spinner className="size-5" /> : <Trash2 className="size-5" strokeWidth={2} />}
            Borrar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Formulario inline de un ajuste: faltó o sobró, dónde, cuánto y por qué. */
function FormAjuste({ cajaId, arqueo, onListo }: { cajaId: string; arqueo: Arqueo; onListo: () => void }) {
  const [sentido, setSentido] = useState<Sentido>("falta");
  const [cuenta, setCuenta] = useState<Cuenta>("efectivo");
  const [montoTexto, setMontoTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState(nuevoRef);
  const [enviando, startTransition] = useTransition();
  const idMonto = useId();
  const idMotivo = useId();

  const monto = Number(montoTexto || 0);
  const firmado = sentido === "falta" ? -monto : monto;
  const antes = cuenta === "efectivo" ? arqueo.efectivo : arqueo.transferencia;
  const despues = antes + firmado;
  const listo = monto > 0 && motivo.trim().length > 0;
  const palabra = sentido === "falta" ? "faltante" : "sobrante";

  function elegirAtajo(a: string) {
    setMotivo(a);
    if (a === "Comisión bancaria") setCuenta("banco");
    if (a.endsWith("en el conteo")) setCuenta("efectivo");
    setError(null);
  }

  function registrar() {
    if (monto <= 0) {
      setError("Poné el monto del ajuste.");
      return;
    }
    if (!motivo.trim()) {
      setError("Contá el motivo del ajuste (tocá uno de los botones o escribilo).");
      return;
    }
    startTransition(async () => {
      const res = await registrarAjusteCaja({ cajaId, cuenta, monto: firmado, motivo: motivo.trim(), ref });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        `${palabra === "faltante" ? "Faltante" : "Sobrante"} de ${formatARS(monto)} anotado. Ahora tiene que haber ${formatARS(despues)} ${LABEL_CUENTA[cuenta]}.`
      );
      setMontoTexto("");
      setMotivo("");
      setError(null);
      setRef(nuevoRef());
      onListo();
    });
  }

  return (
    <div className="space-y-5 rounded-lg border border-dashed p-4">
      <div className="space-y-2">
        <p className="text-base font-medium">¿Qué pasó?</p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={sentido}
          onValueChange={(v) => {
            if (!v) return;
            setSentido(v as Sentido);
            if (ATAJOS.falta.concat(ATAJOS.sobra).includes(motivo)) setMotivo("");
          }}
          className="w-full"
        >
          <ToggleGroupItem value="falta" className="h-14 flex-1 gap-2 text-base">
            <Minus className="size-5" strokeWidth={2.2} />
            Falta plata
          </ToggleGroupItem>
          <ToggleGroupItem value="sobra" className="h-14 flex-1 gap-2 text-base">
            <Plus className="size-5" strokeWidth={2.2} />
            Sobra plata
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <p className="text-base font-medium">¿Dónde?</p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={cuenta}
          onValueChange={(v) => v && setCuenta(v as Cuenta)}
          className="w-full"
        >
          <ToggleGroupItem value="efectivo" className="h-12 flex-1 text-base">
            En el cajón
          </ToggleGroupItem>
          <ToggleGroupItem value="banco" className="h-12 flex-1 text-base">
            En el banco
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor={idMonto} className="text-base">
          ¿Cuánto?
        </Label>
        <Input
          id={idMonto}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej.: 500"
          value={montoTexto}
          onChange={(e) => {
            setMontoTexto(e.target.value.replace(/\D/g, "").slice(0, 10));
            if (error) setError(null);
          }}
          className="h-12 text-lg tabular"
        />
        {monto > 0 ? (
          <p className="text-sm">
            {sentido === "falta" ? "Faltan" : "Sobran"} <strong className="tabular">{formatARS(monto)}</strong>{" "}
            {LABEL_CUENTA[cuenta]}: tiene que haber{" "}
            <span className="tabular text-muted-foreground line-through">{formatARS(antes)}</span> →{" "}
            <strong className="tabular">{formatARS(despues)}</strong>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={idMotivo} className="text-base">
          ¿Por qué?
        </Label>
        <div className="flex flex-wrap gap-2">
          {ATAJOS[sentido].map((a) => (
            <Button
              key={a}
              type="button"
              variant={motivo === a ? "default" : "outline"}
              className="min-h-11 text-sm"
              onClick={() => elegirAtajo(a)}
            >
              {a}
            </Button>
          ))}
        </div>
        <Input
          id={idMotivo}
          value={motivo}
          maxLength={300}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (error) setError(null);
          }}
          placeholder="O escribilo con tus palabras"
          className="h-12 text-base"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
        onClick={registrar}
        disabled={enviando || !listo}
      >
        {enviando ? <Spinner className="size-5" /> : sentido === "falta" ? <Minus className="size-5" /> : <Plus className="size-5" />}
        {monto > 0 ? `Registrar ${palabra} de ${formatARS(monto)}` : `Registrar ${palabra}`}
      </Button>
    </div>
  );
}

/**
 * Ajustes de tesorería sobre la caja (J3): faltantes, sobrantes, comisiones.
 * Entran en la cuenta del arqueo (± Ajustes). Tesorería y el Líder los cargan y
 * borran mientras la caja no esté validada; el resto los ve firmados.
 */
export function AjustesCaja({
  cajaId,
  ajustes,
  arqueo,
  puedeAjustar,
}: {
  cajaId: string;
  ajustes: AjusteCaja[];
  arqueo: Arqueo;
  puedeAjustar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!puedeAjustar && ajustes.length === 0) return null;
  const total = ajustes.reduce((acc, a) => acc + a.monto, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">Ajustes de tesorería</CardTitle>
          <CardDescription>Faltantes, sobrantes y comisiones de esta caja. Entran en la cuenta del arqueo.</CardDescription>
        </div>
        {ajustes.length > 0 ? <MontoAjuste monto={total} /> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {ajustes.length > 0 ? (
          <ul className="divide-y">
            {ajustes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.monto < 0 ? "Faltante" : "Sobrante"} {LABEL_CUENTA[a.cuenta]}
                    {a.descripcion ? <span className="font-normal text-muted-foreground"> — {a.descripcion}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[a.creadoPorNombre ? `Cargó ${a.creadoPorNombre}` : null, formatFechaHora(a.creadoEn)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <MontoAjuste monto={a.monto} />
                {puedeAjustar ? <BotonBorrarAjuste ajuste={a} /> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {puedeAjustar ? (
          <Collapsible open={abierto} onOpenChange={setAbierto}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="lg" className="h-12 gap-2 px-5 text-base">
                <SlidersHorizontal className="size-5" strokeWidth={2} />
                Cargar un ajuste
                <ChevronDown className={cn("size-4 transition-transform", abierto && "rotate-180")} strokeWidth={2} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <FormAjuste cajaId={cajaId} arqueo={arqueo} onListo={() => setAbierto(false)} />
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}
