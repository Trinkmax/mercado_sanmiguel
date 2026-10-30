"use client";

import { useState } from "react";
import { CalendarArrowUp, CalendarCheck } from "lucide-react";
import { fechaLocal, formatARS, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { DescripcionCargo } from "@/components/cobranza/descripcion-cargo";

/** El cargo de un concepto de la carpeta que ya se generó en el mes en curso. */
export type CargoDelMes = {
  descripcion: string;
  monto: number;
  pagado: number;
};

/** Qué cambia en el mes en curso (ya generado) si el cambio de la carpeta rige desde ya. */
export type ImpactoDelMes = {
  /** El mes en curso, "2026-10-01". */
  periodo: string;
  /** Lo que ya se le generó este mes de ese concepto (null = no se le generó: no lo tenía). */
  cargo: CargoDelMes | null;
  /** Lo que le tocaría este mes con la carpeta nueva (0 = nada). */
  montoNuevo: number;
};

/**
 * Pedido del 29/10/2026 («si cambio un concepto, que me impacte en el mes vigente»): si el mes
 * en curso ya está generado y el cambio cambia lo que le toca este mes, se pregunta desde cuándo
 * rige. Sin mes generado, o si este mes queda igual, no hay nada que preguntar (null).
 */
export function impactoDelMes(
  mesGenerado: string | null,
  cargo: CargoDelMes | null,
  montoNuevo: number
): ImpactoDelMes | null {
  if (!mesGenerado) return null;
  if (Math.abs((cargo?.monto ?? 0) - montoNuevo) < 0.005) return null;
  return { periodo: mesGenerado, cargo, montoNuevo };
}

/** "octubre" */
function nombreMes(periodo: string): string {
  return fechaLocal(periodo).toLocaleDateString("es-AR", { month: "long" });
}

/** Lo que pasa con el mes en curso si rige desde ya (lo hace la base al aplicarse el cambio, 0057). */
function textoDesdeEsteMes(i: ImpactoDelMes): string {
  const mes = nombreMes(i.periodo);
  const pagado = i.cargo?.pagado ?? 0;
  if (i.cargo && i.montoNuevo > 0) {
    const sobra = Math.round((pagado - i.montoNuevo) * 100) / 100;
    return `Corrige el de ${mes}: ${formatARS(i.cargo.monto)} → ${formatARS(i.montoNuevo)}.${
      sobra > 0.009
        ? ` De lo que ya pagó (${formatARS(pagado)}), ${formatARS(sobra)} le quedan a favor.`
        : pagado > 0.009
          ? ` Lo que ya pagó (${formatARS(pagado)}) pasa al corregido.`
          : ""
    }`;
  }
  if (i.cargo) {
    return `Anula el de ${mes} (${formatARS(i.cargo.monto)}): no lo paga.${
      pagado > 0.009 ? ` Lo que ya pagó (${formatARS(pagado)}) le queda a favor.` : ""
    }`;
  }
  return `Se le carga ${mes}: ${formatARS(i.montoNuevo)}.`;
}

/** Para el aviso de que salió bien: "Octubre: corregido a $ 34.000". */
export function textoMesCorregido(i: ImpactoDelMes): string {
  const mes = nombreMes(i.periodo);
  const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);
  if (i.cargo && i.montoNuevo > 0) return `${Mes}: corregido a ${formatARS(i.montoNuevo)}.`;
  if (i.cargo) return `${Mes}: anulado, no lo paga.`;
  return `${Mes}: se le cargó ${formatARS(i.montoNuevo)}.`;
}

/**
 * «¿Desde cuándo rige?»: dos opciones del mismo peso (un arreglo de un error rige desde este
 * mes; un cambio de verdad, como dejar la cochera el 29, desde el que viene). Cada una dice qué
 * pasa con el mes en curso. Con `impacto` null, cerrado.
 */
export function DialogoRigeDesde({
  impacto,
  concepto,
  directo,
  pendiente,
  onElegir,
  onCancelar,
}: {
  impacto: ImpactoDelMes | null;
  /** "Alquiler Cocheras" */
  concepto: string;
  /** El Líder aplica en el acto; los demás mandan a aprobación. */
  directo: boolean;
  pendiente: boolean;
  /** El primer mes en que rige ("2026-10-01" o "2026-11-01"). */
  onElegir: (desde: string) => void;
  onCancelar: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  if (!impacto) return null;
  const mes = nombreMes(impacto.periodo);
  const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);
  const queViene = sumarMeses(impacto.periodo, 1);
  const opciones = [
    { desde: impacto.periodo, titulo: `Desde ${mes}`, detalle: textoDesdeEsteMes(impacto), icono: CalendarCheck },
    {
      desde: queViene,
      titulo: `Desde ${nombreMes(queViene)}`,
      detalle: impacto.cargo
        ? `${Mes} queda como se generó (${formatARS(impacto.cargo.monto)}).`
        : `${Mes} no se le cobra.`,
      icono: CalendarArrowUp,
    },
  ];

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !pendiente) onCancelar();
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">¿Desde cuándo rige el cambio?</DialogTitle>
          <DialogDescription className="text-base">
            {Mes} ya está generado
            {impacto.cargo ? (
              <>
                : se le generó{" "}
                <span className="font-semibold text-foreground">
                  <DescripcionCargo texto={impacto.cargo.descripcion} />
                </span>{" "}
                por <span className="font-semibold text-foreground tabular">{formatARS(impacto.cargo.monto)}</span>.
              </>
            ) : (
              <> y no tenía {concepto}.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3" role="group" aria-label="Desde cuándo rige">
          {opciones.map((o) => {
            const Icono = o.icono;
            return (
              <Button
                key={o.desde}
                type="button"
                variant="outline"
                disabled={pendiente}
                onClick={() => {
                  setElegido(o.desde);
                  onElegir(o.desde);
                }}
                className="h-auto min-h-16 w-full items-start justify-start gap-3 px-4 py-3 text-left whitespace-normal"
              >
                {pendiente && elegido === o.desde ? (
                  <Spinner className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <Icono className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2} />
                )}
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{o.titulo}</span>
                  <span className="block text-sm font-normal text-muted-foreground">{o.detalle}</span>
                </span>
              </Button>
            );
          })}
        </div>

        {!directo ? (
          <p className="text-sm text-muted-foreground">
            Se aplica cuando lo apruebe el Líder de Procesos: si elegís {mes}, ahí se corrige.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" className="h-12 px-5 text-base" onClick={onCancelar} disabled={pendiente}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
