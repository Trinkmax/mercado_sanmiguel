import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEF_TIPO, textoHoras } from "./constantes";

/** Los contadores del mes que devuelve `resumen_novedades` (solo novedades aprobadas). */
export type ContadoresMes = {
  faltas: number;
  faltas_injustificadas: number;
  llegadas_tarde: number;
  horas_tarde: number;
  feriados_trabajados: number;
  horas_feriado: number;
  dias_vacaciones: number;
  dias_licencia: number;
  horas_extra: number;
  otras: number;
};

type Item = { clave: string; icono: LucideIcon; texto: string; destacado?: boolean };

function plural(n: number, uno: string, muchos: string): string {
  return `${n} ${n === 1 ? uno : muchos}`;
}

export function itemsContadores(c: ContadoresMes): Item[] {
  const items: Item[] = [];
  if (c.faltas > 0)
    items.push({
      clave: "faltas",
      icono: DEF_TIPO.falta.icono,
      texto:
        plural(c.faltas, "falta", "faltas") +
        (c.faltas_injustificadas > 0 ? ` (${c.faltas_injustificadas} sin justificar)` : ""),
      destacado: c.faltas_injustificadas > 0,
    });
  if (c.llegadas_tarde > 0)
    items.push({
      clave: "tarde",
      icono: DEF_TIPO.llegada_tarde.icono,
      texto: `${plural(c.llegadas_tarde, "llegada tarde", "llegadas tarde")} · ${textoHoras(c.horas_tarde)}`,
    });
  if (c.feriados_trabajados > 0)
    items.push({
      clave: "feriados",
      icono: DEF_TIPO.feriado_trabajado.icono,
      texto: `${plural(c.feriados_trabajados, "feriado", "feriados")}${c.horas_feriado > 0 ? ` · ${textoHoras(c.horas_feriado)}` : ""} · se paga doble`,
    });
  if (c.dias_vacaciones > 0)
    items.push({
      clave: "vacaciones",
      icono: DEF_TIPO.vacaciones.icono,
      texto: `${plural(c.dias_vacaciones, "día", "días")} de vacaciones`,
    });
  if (c.dias_licencia > 0)
    items.push({
      clave: "licencia",
      icono: DEF_TIPO.licencia.icono,
      texto: `${plural(c.dias_licencia, "día", "días")} de licencia`,
    });
  if (c.horas_extra > 0)
    items.push({ clave: "extra", icono: DEF_TIPO.horas_extra.icono, texto: `${textoHoras(c.horas_extra)} extra` });
  if (c.otras > 0)
    items.push({ clave: "otras", icono: DEF_TIPO.otra.icono, texto: plural(c.otras, "otra novedad", "otras novedades") });
  return items;
}

/** Contadores con ícono (solo los que no son cero) o "Sin novedades". */
export function Contadores({ contadores, className }: { contadores: ContadoresMes; className?: string }) {
  const items = itemsContadores(contadores);
  if (items.length === 0)
    return <p className={cn("text-sm text-muted-foreground", className)}>Sin novedades aprobadas</p>;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Novedades aprobadas del mes">
      {items.map(({ clave, icono: Icono, texto, destacado }) => (
        <li
          key={clave}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-sm",
            destacado ? "border-foreground/30 font-semibold" : "border-border text-foreground/85"
          )}
        >
          <Icono className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
          {texto}
        </li>
      ))}
    </ul>
  );
}
