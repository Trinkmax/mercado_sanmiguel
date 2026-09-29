import { ArrowRight } from "lucide-react";
import { formatFraccion, OPCIONES_CUOTAS_MES } from "@/lib/format";
import {
  LABEL_CATEGORIA,
  LABEL_SEGMENTO,
  type CategoriaCliente,
  type Segmento,
} from "@/lib/segmentos";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type {
  CambioFila,
  Datos,
  ReferenciaConcepto,
} from "@/components/aprobaciones/tipos";

/* ---------- Labels humanos de cada campo del payload ---------- */

const LABEL_CAMPO: Record<string, string> = {
  codigo: "N° de carpeta",
  nombre: "Nombre",
  apodo: "Apodo",
  tipo_persona: "Tipo de persona",
  cuit: "CUIT / DNI",
  telefono: "Teléfono",
  email: "Email",
  direccion: "Dirección",
  notas: "Notas",
  cuotas_mes: "Paga el mes en",
  categoria: "Categoría",
  es_socio: "Socio de la cooperativa",
  segmento: "Segmento",
  motivo: "Motivo",
  activo: "Activo",
  cantidad: "Cantidad",
  precio: "Precio",
  orden_imputacion: "Orden de imputación",
  descuento_pronto_pago: "Beneficio por pago en término %",
  tipo: "Tipo",
};

/** Para conceptos, "codigo" es el código corto (EXPP), no el número de carpeta. */
const LABEL_CAMPO_CONCEPTO: Record<string, string> = {
  ...LABEL_CAMPO,
  codigo: "Código",
};

const LABEL_TIPO_PERSONA: Record<string, string> = {
  fisica: "Persona física",
  juridica: "Empresa",
};

const LABEL_TIPO_CONCEPTO: Record<string, string> = {
  recurrente: "Mensual",
  energia: "Energía (kWh)",
  canon_diario: "Canon diario",
  deuda: "Deuda",
  diario: "Por día",
  abono_energia: "Abono de energía",
  eventual: "Eventual",
};

/** Claves internas que no se muestran como "campo" del diff. */
const CLAVES_OCULTAS = new Set([
  "id",
  "org_id",
  "cliente_id",
  "concepto_id",
  "auth_user_id",
  "creado_en",
  "conceptos",
  "ref",
]);

/** Orden de presentación de los campos (los que no están van al final). */
const ORDEN_CAMPOS = [
  "codigo",
  "categoria",
  "nombre",
  "apodo",
  "es_socio",
  "tipo_persona",
  "cuit",
  "telefono",
  "email",
  "direccion",
  "cuotas_mes",
  "notas",
  "tipo",
  "segmento",
  "precio",
  "descuento_pronto_pago",
  "orden_imputacion",
  "cantidad",
  "activo",
];

function labelCampo(campo: string, entidad: CambioFila["entidad"]): string {
  const tabla = entidad === "concepto" ? LABEL_CAMPO_CONCEPTO : LABEL_CAMPO;
  return tabla[campo] ?? campo.replaceAll("_", " ");
}

function ordenarCampos(campos: string[]): string[] {
  return [...campos].sort((a, b) => {
    const ia = ORDEN_CAMPOS.indexOf(a);
    const ib = ORDEN_CAMPOS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function esVacio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === "";
}

/** Un valor del payload, formateado según el campo. */
export function ValorCampo({
  campo,
  valor,
}: {
  campo: string;
  valor: unknown;
}) {
  if (esVacio(valor)) return <span className="text-muted-foreground">—</span>;

  switch (campo) {
    case "precio":
      return <Money monto={Number(valor)} className="font-medium" />;
    case "descuento_pronto_pago":
      return <span className="tabular">{Number(valor)} %</span>;
    case "cantidad":
      return <span className="tabular font-medium">{formatFraccion(Number(valor))}</span>;
    case "cuotas_mes": {
      const opcion = OPCIONES_CUOTAS_MES.find((o) => o.valor === Number(valor));
      return (
        <span>
          {opcion ? opcion.label : `${Number(valor)} veces por mes`}
          {opcion ? (
            <span className="text-muted-foreground"> · {opcion.ayuda}</span>
          ) : null}
        </span>
      );
    }
    case "categoria":
      return (
        <span className="font-medium">
          {LABEL_CATEGORIA[String(valor) as CategoriaCliente] ?? String(valor)}
        </span>
      );
    case "es_socio":
      return <span className="font-medium">{valor === true || valor === "true" ? "Sí" : "No"}</span>;
    case "segmento":
      return <span>{LABEL_SEGMENTO[String(valor) as Segmento] ?? String(valor)}</span>;
    case "activo":
      return <Sello estado={valor ? "activo" : "inactivo"} />;
    case "tipo_persona":
      return <span>{LABEL_TIPO_PERSONA[String(valor)] ?? String(valor)}</span>;
    case "tipo":
      return <span>{LABEL_TIPO_CONCEPTO[String(valor)] ?? String(valor)}</span>;
    case "codigo":
      return typeof valor === "number" ? (
        <span className="tabular font-medium">N.º {valor}</span>
      ) : (
        <Codigo codigo={String(valor)} />
      );
    case "orden_imputacion":
      return <span className="tabular">{Number(valor)}</span>;
    default:
      return <span className="whitespace-pre-line">{String(valor)}</span>;
  }
}

/* ---------- Diff de una modificación: Campo | Antes | Después ---------- */

/**
 * Los campos que cambia una modificación, con su nombre ("Apodo", "Teléfono"…), en el orden de
 * la tabla. Sirve para el encabezado del pedido: el resumen lo escribe quien lo pide y puede
 * no nombrarlos todos.
 */
export function camposQueCambian(cambio: Pick<CambioFila, "accion" | "entidad" | "datos">): string[] {
  if (cambio.accion !== "modificacion") return [];
  return ordenarCampos(Object.keys(cambio.datos).filter((k) => !CLAVES_OCULTAS.has(k))).map((c) =>
    labelCampo(c, cambio.entidad)
  );
}

/** "apodo, teléfono y dirección" (respeta siglas como "CUIT / DNI"). */
export function enumerarCampos(labels: string[]): string {
  const bajas = labels.map((l) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l));
  if (bajas.length <= 1) return bajas.join("");
  return `${bajas.slice(0, -1).join(", ")} y ${bajas.at(-1)}`;
}

/** Columnas: en celular el nombre del campo va arriba y Antes → Después abajo, a lo ancho. */
const COLUMNAS_DIFF =
  "grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_1.5rem_minmax(0,1fr)] sm:gap-x-3";

function TablaDiff({
  entidad,
  datos,
  anteriores,
}: {
  entidad: CambioFila["entidad"];
  datos: Datos;
  anteriores: Datos | null;
}) {
  const campos = ordenarCampos(
    Object.keys(datos).filter((k) => !CLAVES_OCULTAS.has(k))
  );
  if (campos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este cambio no modifica ningún dato.
      </p>
    );
  }
  // Grilla en vez de <table>: en el celular la tabla de 4 columnas partía los valores
  // ("351 300-" / "4455"). Los roles mantienen la lectura de tabla.
  return (
    <div role="table" aria-label="Qué cambia" className="overflow-hidden rounded-lg border text-sm">
      <div role="rowgroup">
        <div
          role="row"
          className={`${COLUMNAS_DIFF} border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground`}
        >
          <span role="columnheader" className="max-sm:sr-only">
            Campo
          </span>
          <span role="columnheader">Antes</span>
          <span role="columnheader">
            <span className="sr-only">pasa a</span>
          </span>
          <span role="columnheader">Después</span>
        </div>
      </div>
      <div role="rowgroup" className="divide-y">
        {campos.map((campo) => (
          <div key={campo} role="row" className={`${COLUMNAS_DIFF} gap-y-1 px-3 py-2.5`}>
            <span role="rowheader" className="col-span-3 font-medium text-muted-foreground sm:col-span-1">
              {labelCampo(campo, entidad)}
            </span>
            <span role="cell" className="min-w-0 break-words text-muted-foreground">
              <ValorCampo campo={campo} valor={anteriores?.[campo]} />
            </span>
            <span role="cell" aria-hidden className="pt-0.5 text-center text-muted-foreground">
              <ArrowRight className="inline size-4" strokeWidth={2} />
            </span>
            <span role="cell" className="min-w-0 font-medium break-words">
              <ValorCampo campo={campo} valor={datos[campo]} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Alta: lista de campos + conceptos ---------- */

function ListaAlta({
  entidad,
  datos,
  conceptosPorId,
}: {
  entidad: CambioFila["entidad"];
  datos: Datos;
  conceptosPorId: Record<string, ReferenciaConcepto>;
}) {
  // Al ambulante se le cobra por día: ni cuotas ni tipo de persona dicen nada en su alta.
  const ocultasAmbulante = datos.categoria === "ambulante" ? ["cuotas_mes", "tipo_persona"] : [];
  const campos = ordenarCampos(
    Object.keys(datos).filter(
      (k) => !CLAVES_OCULTAS.has(k) && !esVacio(datos[k]) && !ocultasAmbulante.includes(k)
    )
  );
  const conceptos = Array.isArray(datos.conceptos)
    ? (datos.conceptos as { concepto_id?: string; cantidad?: number | string }[])
    : [];

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {campos.map((campo) => (
          <div key={campo} className="contents">
            <dt className="text-muted-foreground sm:text-right">
              {labelCampo(campo, entidad)}
            </dt>
            <dd className="font-medium">
              <ValorCampo campo={campo} valor={datos[campo]} />
            </dd>
          </div>
        ))}
      </dl>
      {conceptos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Conceptos que se le asignan</p>
          <ul className="divide-y rounded-lg border">
            {conceptos.map((c, i) => {
              const ref = c.concepto_id ? conceptosPorId[c.concepto_id] : undefined;
              return (
                <li key={`${c.concepto_id ?? i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Codigo codigo={ref?.codigo ?? "?"} />
                  <span className="min-w-0 flex-1 break-words">
                    {ref?.nombre ?? "Concepto desconocido"}
                  </span>
                  <span className="tabular font-medium">
                    × {formatFraccion(Number(c.cantidad ?? 1))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Diff completo según entidad + acción ---------- */

/**
 * Muestra, en lenguaje de mostrador, qué cambia si se aprueba:
 * - modificación → tabla Campo | Antes | Después (solo las claves presentes);
 * - alta → lista de campos (+ conceptos con código × cantidad);
 * - baja → una frase.
 */
export function DiffCambio({
  cambio,
  conceptosPorId,
}: {
  cambio: CambioFila;
  conceptosPorId: Record<string, ReferenciaConcepto>;
}) {
  const { entidad, accion, datos, datos_anteriores } = cambio;

  if (accion === "baja") {
    const quien =
      entidad === "cliente"
        ? (cambio.cliente?.nombre ?? String(datos_anteriores?.nombre ?? "el cliente"))
        : entidad === "concepto"
          ? `el concepto ${cambio.concepto?.codigo ?? ""} ${cambio.concepto?.nombre ?? ""}`.trim()
          : `${cambio.concepto?.codigo ?? "el concepto"} ${cambio.concepto?.nombre ?? ""} de ${cambio.cliente?.nombre ?? "este cliente"}`.trim();
    return (
      <p className="rounded-lg bg-pendiente-suave/60 px-4 py-3 text-sm font-medium text-pendiente">
        Se da de baja a {quien}.
        {entidad === "cliente"
          ? " Deja de generar cargos; su historial se conserva."
          : entidad === "cliente_concepto"
            ? " Deja de generarse desde el próximo período."
            : " No se genera más para ningún cliente."}
      </p>
    );
  }

  if (accion === "alta") {
    if (entidad === "cliente_concepto" && datos.activo === false) {
      // "Eximir del abono": un alta del concepto que nace sin facturarse.
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Queda eximido de</span>
          <Codigo codigo={cambio.concepto?.codigo ?? "?"} />
          <span className="font-medium">{cambio.concepto?.nombre ?? "Concepto"}</span>
          {cambio.cliente ? (
            <span className="text-muted-foreground">· {cambio.cliente.nombre}</span>
          ) : null}
          <span className="basis-full text-muted-foreground">
            No se le genera más desde la próxima facturación.
          </span>
        </div>
      );
    }
    if (entidad === "cliente_concepto") {
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Se agrega</span>
          <Codigo codigo={cambio.concepto?.codigo ?? "?"} />
          <span className="font-medium">{cambio.concepto?.nombre ?? "Concepto"}</span>
          <span className="tabular font-medium">
            × {formatFraccion(Number(datos.cantidad ?? 1))}
          </span>
          {cambio.cliente ? (
            <span className="text-muted-foreground">
              a {cambio.cliente.nombre}
            </span>
          ) : null}
          {!esVacio(datos.notas) ? (
            <span className="basis-full text-muted-foreground">
              Notas: {String(datos.notas)}
            </span>
          ) : null}
        </div>
      );
    }
    return <ListaAlta entidad={entidad} datos={datos} conceptosPorId={conceptosPorId} />;
  }

  // modificación
  return <TablaDiff entidad={entidad} datos={datos} anteriores={datos_anteriores} />;
}
