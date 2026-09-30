import Link from "next/link";
import { Bell, ChevronRight, Gavel, Megaphone, MessageSquareWarning, UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { esperaDescargo, registroSinVer, respuestaNueva } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { PESTANAS_PORTAL, type PestanaPortal } from "@/components/portal/constantes";
import {
  getCircularesSocio,
  getClienteSocio,
  getRegistrosSocio,
  getResumenComunicaciones,
  type RegistroPortal,
} from "@/components/portal/datos-portal";
import {
  estadoMulta,
  saldoMulta,
  SELLO_MULTA,
  selloEstadoRegistro,
} from "@/components/comunicaciones/constantes";

export const metadata = { title: "Comunicaciones" };

const ICONO: Record<PestanaPortal, typeof Bell> = {
  circulares: Megaphone,
  notificaciones: Bell,
  apercibimientos: MessageSquareWarning,
  sanciones: Gavel,
};

export default async function ComunicacionesSocioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const perfil = await requireRol("socio");
  const { tab } = await searchParams;
  const pestana = PESTANAS_PORTAL.find((p) => p.valor === tab) ?? PESTANAS_PORTAL[0];

  const cliente = await getClienteSocio(perfil.user_id);
  if (!cliente) {
    return (
      <EmptyState
        icono={UserX}
        titulo="Tu usuario no está vinculado a un puesto"
        descripcion="Consultá en administración para que te asocien a tu carpeta."
      />
    );
  }

  const [circulares, registros, resumen] = await Promise.all([
    getCircularesSocio(perfil.user_id),
    getRegistrosSocio(perfil.user_id),
    getResumenComunicaciones(perfil.user_id),
  ]);

  const deLaPestana = pestana.tipo ? registros.filter((r) => r.tipo === pestana.tipo) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Comunicaciones"
        descripcion="Lo que te manda la cooperativa: circulares para todos y avisos para vos."
        className="pb-0"
      />

      {/* Pestañas grandes: 2×2 en el celular, una fila en tablet */}
      <nav
        aria-label="Tipo de comunicación"
        data-tour="socio-comunicaciones-pestanas"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {PESTANAS_PORTAL.map((p) => {
          const Icono = ICONO[p.valor];
          const activa = p.valor === pestana.valor;
          const nuevas = resumen.nuevas[p.valor];
          return (
            <Link
              key={p.valor}
              href={`/mi-cuenta/comunicaciones?tab=${p.valor}`}
              aria-current={activa ? "page" : undefined}
              data-tour={`socio-comunicaciones-pestana-${p.valor}`}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-[15px] font-semibold transition-colors",
                activa
                  ? "border-primary bg-accent text-foreground ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-accent/60 active:bg-accent"
              )}
            >
              <Icono className="size-5 shrink-0 text-primary" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              {nuevas > 0 ? (
                <span
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-parcial px-1.5 text-sm font-bold tabular text-primary-foreground"
                  aria-label={`${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"}`}
                >
                  {nuevas}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {pestana.valor === "circulares" ? (
        <section className="space-y-4" aria-label="Circulares">
          {circulares.length === 0 ? (
            <EmptyState icono={Megaphone} titulo={pestana.vacioTitulo} descripcion={pestana.vacioTexto} />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {circulares.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/mi-cuenta/circulares/${c.id}`}
                    data-tour="socio-comunicaciones-circular"
                    className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium leading-snug">
                        Circular N° <span className="tabular">{c.numero}</span> · {c.titulo}
                      </span>
                      <span className="text-sm tabular text-muted-foreground">
                        {formatFecha(c.fecha)}
                      </span>
                    </span>
                    {c.recibida_en ? (
                      <Sello estado="recibida" texto={c.obligatoria ? "Confirmada" : "Leída"} />
                    ) : (
                      <Sello estado="nueva_comunicacion" />
                    )}
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            Las circulares son avisos: no se responden. ¿Tenés una duda?{" "}
            <Link href="/mi-cuenta/solicitudes/nueva" className="font-semibold text-primary underline-offset-4 hover:underline">
              Hacé una solicitud
            </Link>
            .
          </p>
        </section>
      ) : (
        <section aria-label={pestana.label}>
          {deLaPestana.length === 0 ? (
            <EmptyState
              icono={ICONO[pestana.valor]}
              titulo={pestana.vacioTitulo}
              descripcion={pestana.vacioTexto}
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {deLaPestana.map((r) => (
                <FilaRegistro key={r.id} r={r} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function FilaRegistro({ r }: { r: RegistroPortal }) {
  // Un solo sello de "qué hacer" + el de la multa si tiene. Primero lo NUEVO, igual que el
  // contador de la pestaña: si nunca lo abrió es "Nueva" (aunque ya le hayan escrito); si le
  // escribieron después de la última vez que lo abrió, "Respuesta nueva" (aunque todavía
  // espere su descargo). Si no, "Tenés que responder" (también lo avisa Mi cuenta).
  const aviso = registroSinVer(r)
    ? "nueva_comunicacion"
    : respuestaNueva(r)
      ? "respuesta_nueva"
      : esperaDescargo(r)
        ? "a_responder"
        : null;
  const multa = estadoMulta(r);
  const saldo = saldoMulta(r);
  return (
    <li>
      <Link
        href={`/mi-cuenta/comunicaciones/${r.id}`}
        data-tour="socio-comunicaciones-registro"
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="line-clamp-2 block font-medium leading-snug">{r.titulo}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="tabular">N° {r.numero}</span>
            <span aria-hidden>·</span>
            <span className="tabular">{formatFecha(r.fecha)}</span>
            {multa !== "sin_multa" ? (
              <>
                <span aria-hidden>·</span>
                {multa === "sin_efecto" || multa === "pagada" ? (
                  <Sello estado={SELLO_MULTA[multa].estado} texto={SELLO_MULTA[multa].texto} />
                ) : (
                  <span>
                    Multa <Money monto={saldo} className="font-semibold text-pendiente" />
                  </span>
                )}
              </>
            ) : null}
          </span>
        </span>
        <Sello estado={aviso ?? selloEstadoRegistro(r)} className="shrink-0" />
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
      </Link>
    </li>
  );
}
