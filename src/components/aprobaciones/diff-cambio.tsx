import { ArrowRight } from "lucide-react";
import { formatFraccion, OPCIONES_CUOTAS_MES } from "@/lib/format";
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
  cuit: "CUIT",
  telefono: "Teléfono",
  email: "Email",
  direccion: "Dirección",
  notas: "Notas",
  cuotas_mes: "Paga el mes en",
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
  juridica: "Persona jurídica",
};

const LABEL_TIPO_CONCEPTO: Record<string, string> = {
  recurrente: "Mensual",
  energia: "Energía",
  canon_diario: "Canon diario",
  deuda: "Deuda",
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
]);

/** Orden de presentación de los campos (los que no están van al final). */
const ORDEN_CAMPOS = [
  "codigo",
  "nombre",
  "apodo",
  "tipo_persona",
  "cuit",
  "telefono",
  "email",
  "direccion",
  "cuotas_mes",
  "notas",
  "tipo",
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
          {opcion ? opcion.label : `${Number(valor)} veces`}
          {opcion ? (
            <span className="text-muted-foreground"> · {opcion.ayuda}</span>
          ) : null}
        </span>
      );
    }
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
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
            <th scope="col" className="px-3 py-2">
              Campo
            </th>
            <th scope="col" className="px-3 py-2">
              Antes
            </th>
            <th scope="col" className="w-8 px-1 py-2">
              <span className="sr-only">pasa a</span>
            </th>
            <th scope="col" className="px-3 py-2">
              Después
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campos.map((campo) => (
            <tr key={campo} className="align-top">
              <th
                scope="row"
                className="px-3 py-2.5 text-left font-medium text-muted-foreground"
              >
                {labelCampo(campo, entidad)}
              </th>
              <td className="px-3 py-2.5 text-muted-foreground">
                <ValorCampo campo={campo} valor={anteriores?.[campo]} />
              </td>
              <td className="px-1 py-2.5 text-center text-muted-foreground">
                <ArrowRight className="inline size-4" strokeWidth={2} />
              </td>
              <td className="px-3 py-2.5 font-medium">
                <ValorCampo campo={campo} valor={datos[campo]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const campos = ordenarCampos(
    Object.keys(datos).filter((k) => !CLAVES_OCULTAS.has(k) && !esVacio(datos[k]))
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
                  <span className="min-w-0 flex-1 truncate">
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
