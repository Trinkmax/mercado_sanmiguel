-- ============================================================
-- Mercado San Miguel — 0011 Fase 3: esquema (EXPAND)
-- Contrato: docs/FASE3-CONTRATO.md §2, §3 y §5.
--
-- Requiere 0010_fase3_enums.sql aplicada (y commiteada) antes.
-- Se aplica como UNA transacción.
--
-- Regla de esta migración: es ADITIVA. Con la app de fase 2 todavía
-- desplegada no rompe nada:
--   · no se borran columnas, tablas ni funciones que el código actual usa
--     (lo viejo queda deprecado: ver §8 del contrato);
--   · las políticas RLS y los grants de tablas EXISTENTES que restringen
--     accesos NO van acá: van en 0022_fase3_endurecimiento.sql, que se aplica
--     en la misma ventana que el deploy de la fase 3 (después de las
--     0013…0021 de cada módulo);
--   · excepción deliberada: el endurecimiento de `perfiles` (F1) es un
--     arreglo de seguridad (hoy Administración puede desactivar o ascender
--     a cualquiera por PostgREST) y va acá.
-- Las RPC nuevas (stubs) y los cambios de firma van en 0012_fase3_rpcs.sql.
--
-- Regla SQL de toda la fase 3 (contrato §4.0): nunca `x = any ((select f()))`
-- sin cast: Postgres lo toma como ANY(subconsulta) y compara x con un array
-- (ERROR 42883). Usar `x = any ((select f())::tipo[])`.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Clientes: categoría (quién lo gestiona) y socio (C4, G6, G8)
-- ------------------------------------------------------------
alter table public.clientes
  add column if not exists categoria public.categoria_cliente not null default 'puestero',
  add column if not exists es_socio boolean not null default false;

-- G6: los ambulantes no tienen acceso al portal.
alter table public.clientes drop constraint if exists clientes_ambulante_sin_portal;
alter table public.clientes add constraint clientes_ambulante_sin_portal
  check (categoria <> 'ambulante' or auth_user_id is null);

create index if not exists clientes_org_categoria_idx on public.clientes (org_id, categoria);

comment on column public.clientes.categoria is
  'Quién lo gestiona: puestero (Administración; incluye local/galpón/contéiner/cocheras) · quintero y ambulante (Jefe de Portería). El Líder gestiona todo.';
comment on column public.clientes.es_socio is 'Socio de la cooperativa (C4). Segmento "socios" de las circulares.';


-- ------------------------------------------------------------
-- 2. Conceptos: segmento + catálogo final (C6, G5, G9, I1, D4)
--    La base no tiene cargos: se reescribe en caliente.
-- ------------------------------------------------------------
alter table public.conceptos add column if not exists segmento text;
alter table public.conceptos drop constraint if exists conceptos_segmento_check;
alter table public.conceptos add constraint conceptos_segmento_check check (
  segmento is null or segmento in
    ('puesteros','puestos_propios','locales','galpones','conteiners','cocheras','quinteros','ambulantes'));

comment on column public.conceptos.segmento is
  'Segmento de cliente que implica tener este concepto activo (private.segmentos_cliente) y quién lo gestiona: quinteros/ambulantes = Jefe de Portería; el resto = Administración.';

update public.conceptos set segmento = case codigo
    when 'EXME' then 'puesteros'
    when 'EXPP' then 'puestos_propios'
    when 'EXPL' then 'locales'
    when 'EXPG' then 'galpones'
    when 'EXPE' then 'conteiners'
    when 'EXPC' then 'cocheras'
    when 'EXPQ' then 'quinteros'
    else null end;

-- EXME pasa a ser la expensa del puesto común (lo que hasta hoy era EXPP).
update public.conceptos set
  nombre = 'Expensas Cobradas', tipo = 'recurrente', precio = 1080000,
  descuento_pronto_pago = 15, orden_imputacion = 40, activo = true
where codigo = 'EXME';

-- EXPP pasa a ser la expensa de los 4 puestos propios de la cooperativa (supuesto: mismo precio y beneficio).
update public.conceptos set
  nombre = 'Expensas Puestos Propios', tipo = 'recurrente', precio = 1080000,
  descuento_pronto_pago = 15, orden_imputacion = 45, activo = true
where codigo = 'EXPP';

-- G5: la quinta entera, por mes.
update public.conceptos set precio = 330000 where codigo = 'EXPQ';

-- BC: el precio sale de tarifas_transporte (H1). El concepto queda como código de reporte.
update public.conceptos set nombre = 'Bono camioneros (canon de transporte)', precio = 0 where codigo = 'BC';

-- Conceptos nuevos.
insert into public.conceptos
  (org_id, codigo, nombre, tipo, precio, orden_imputacion, descuento_pronto_pago, activo, segmento)
select o.id, v.codigo, v.nombre, v.tipo::public.tipo_concepto, v.precio, v.orden, 0, true, v.segmento
from public.organizaciones o
cross join (values
  ('AMB',  'Ambulantes',               'diario',        15000::numeric, 35, 'ambulantes'::text),
  ('ABEN', 'Abono mensual de energía', 'abono_energia', 15000::numeric, 78, null::text),
  ('MULT', 'Multas',                   'eventual',      0::numeric,     97, null::text)
) as v(codigo, nombre, tipo, precio, orden, segmento)
on conflict (org_id, codigo) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, precio = excluded.precio,
  orden_imputacion = excluded.orden_imputacion, activo = true, segmento = excluded.segmento;


-- ------------------------------------------------------------
-- 3. Plano: puesto propio (C3)
-- ------------------------------------------------------------
alter table public.espacios add column if not exists propio boolean not null default false;
alter table public.espacios drop constraint if exists espacios_propio_solo_puesto;
alter table public.espacios add constraint espacios_propio_solo_puesto check (not propio or tipo = 'puesto');
create index if not exists espacios_propios_idx on public.espacios (org_id) where propio;
comment on column public.espacios.propio is 'Puesto propio de la cooperativa (paga EXPP en vez de EXME). Solo tipo puesto.';


-- ------------------------------------------------------------
-- 4. Medidores: lugar en el plano (C8)
-- ------------------------------------------------------------
alter table public.medidores
  add column if not exists espacio_id uuid references public.espacios(id) on delete set null;
create index if not exists medidores_espacio_idx on public.medidores (espacio_id) where espacio_id is not null;
comment on column public.medidores.ubicacion is
  'Etiqueta legible ("Puesto 58") autocompletada desde el espacio, o texto libre si no está en el plano.';


-- ------------------------------------------------------------
-- 5. Cargos: días cubiertos (ambulantes), lote que los creó, orígenes nuevos
-- ------------------------------------------------------------
alter table public.cargos
  add column if not exists desde date,
  add column if not exists hasta date,
  add column if not exists lote_id uuid;

alter table public.cargos drop constraint if exists cargos_rango_dias;
alter table public.cargos add constraint cargos_rango_dias check (
  (desde is null and hasta is null) or (desde is not null and hasta is not null and hasta >= desde));

-- Red de seguridad: nunca se paga más que el monto del cargo (con beneficio, lo pagado es menos).
alter table public.cargos drop constraint if exists cargos_pagado_tope;
alter table public.cargos add constraint cargos_pagado_tope check (monto_pagado <= monto);

-- diario = AMB cobrado en el acto (cobrar_diario); multa = MULT de un registro (emitir_registro).
alter table public.cargos drop constraint if exists cargos_origen_check;
alter table public.cargos add constraint cargos_origen_check
  check (origen in ('generacion','energia','manual','deuda','diario','multa'));

create index if not exists cargos_diario_idx on public.cargos (cliente_id, hasta)
  where origen = 'diario' and estado <> 'anulado';
create index if not exists cargos_lote_idx on public.cargos (lote_id) where lote_id is not null;


-- ------------------------------------------------------------
-- 6. Pagos: cobro mixto por lote (A1)
--    Un cobro con varios medios = varios pagos con el mismo lote_id y el
--    MISMO numero de recibo. numero sigue siendo identity: la RPC toma un
--    valor de la secuencia y lo inserta en todas las líneas con
--    OVERRIDING SYSTEM VALUE. El default de lote_id mantiene funcionando a
--    registrar_pago (cada pago viejo = un lote de una línea).
-- ------------------------------------------------------------
alter table public.pagos
  add column if not exists lote_id uuid not null default gen_random_uuid(),
  add column if not exists linea smallint not null default 1;
alter table public.pagos drop constraint if exists pagos_linea_check;
alter table public.pagos add constraint pagos_linea_check check (linea between 1 and 6);
create unique index if not exists pagos_lote_linea_unq on public.pagos (lote_id, linea);
create index if not exists pagos_org_numero_idx on public.pagos (org_id, numero);
-- rechazar_cheque / anular_pago buscan por cheque; la policy de storage de comprobantes, por path.
create index if not exists pagos_cheque_idx on public.pagos (cheque_id) where cheque_id is not null;
create index if not exists pagos_comprobante_idx on public.pagos (comprobante_path) where comprobante_path is not null;
comment on column public.pagos.numero is 'N° de recibo. Se repite en todas las líneas (medios) de un mismo lote.';
comment on column public.pagos.lote_id is 'Cobro al que pertenece la línea (pago mixto). El recibo se imprime por lote.';


-- ------------------------------------------------------------
-- 7. Cheques: datos del relevamiento (A2, E1, E2)
-- ------------------------------------------------------------
alter table public.cheques
  add column if not exists cuit text,
  add column if not exists recibido_de text,
  add column if not exists puesto text,
  add column if not exists proveedor text,
  add column if not exists fecha_entregado date,
  add column if not exists entregado_por uuid references auth.users(id),
  add column if not exists entregado_en_cobro boolean not null default false,
  add column if not exists gasto_id uuid references public.gastos(id) on delete set null,
  -- rastro del rechazo (no editable: cheques UPDATE por grant solo toca estado/fechas/notas)
  add column if not exists rechazado_por uuid references auth.users(id),
  add column if not exists rechazado_en timestamptz,
  add column if not exists motivo_rechazo text;

alter table public.cheques alter column titular drop not null;

alter table public.cheques drop constraint if exists cheques_cuit_check;
alter table public.cheques add constraint cheques_cuit_check check (cuit is null or cuit ~ '^[0-9]{11}$');

alter table public.cheques drop constraint if exists cheques_entregado_datos;
alter table public.cheques add constraint cheques_entregado_datos check (
  estado <> 'entregado' or (coalesce(trim(proveedor), '') <> '' and fecha_entregado is not null));

-- Anti-duplicado: el mismo cheque (CUIT + N°) no se carga dos veces.
create unique index if not exists cheques_cuit_numero_unq on public.cheques (org_id, cuit, numero)
  where cuit is not null and estado <> 'rechazado';
create index if not exists cheques_gasto_idx on public.cheques (gasto_id) where gasto_id is not null;

comment on column public.cheques.titular is 'DEPRECADA (fase 3): usar recibido_de. registrar_cobro la llena igual para compatibilidad.';
comment on column public.cheques.banco is 'DEPRECADA (fase 3, A2): ya no se pide.';
comment on column public.cheques.es_tercero is 'DEPRECADA (fase 3): se deriva del CUIT.';
comment on column public.cheques.recibido_de is 'De quién se recibe (default: el nombre del cliente).';
comment on column public.cheques.puesto is 'Snapshot legible de los espacios del cliente al recibirlo ("Puesto 34½ · 52").';
comment on column public.cheques.entregado_en_cobro is
  'true si el cheque se entregó a un proveedor en el mismo acto del cobro: no está en la caja (el arqueo lo descuenta).';


-- ------------------------------------------------------------
-- 8. Cajas: desglose del arqueo (A3, E4, J3) y bitácora
-- ------------------------------------------------------------
alter table public.cajas
  add column if not exists total_cobros numeric,
  add column if not exists total_quintas numeric,
  add column if not exists total_ambulantes numeric,
  add column if not exists total_cheques_entregados numeric,
  add column if not exists total_ajustes numeric,
  add column if not exists total_rendido_quintas numeric,
  add column if not exists total_rendido_ambulantes numeric,
  add column if not exists total_rendido_canon numeric;

comment on column public.cajas.total_quintas is 'Caja de portería: cobros a clientes quinteros (todos los medios).';
comment on column public.cajas.total_ambulantes is 'Caja de portería: cobros a clientes ambulantes (todos los medios).';
comment on column public.cajas.total_rendido_canon is 'Caja de administración: bono camioneros de las cajas de portería integradas.';

alter table public.caja_eventos drop constraint if exists caja_eventos_tipo_check;
alter table public.caja_eventos add constraint caja_eventos_tipo_check check (tipo in (
  'apertura','cierre','solicitud_reapertura','reapertura','rechazo_reapertura',
  'integracion','recibe_rendicion','validacion',
  'gasto_imputado','gasto_revertido','ajuste','ajuste_borrado','canon_anulado',
  'arqueo_recalculado','cierre_forzado','cobro_anulado'));


-- ------------------------------------------------------------
-- 9. Canon de transporte / bono camioneros (H1, H2, G4, G9)
-- ------------------------------------------------------------
create table if not exists public.tarifas_transporte (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 40),
  precio numeric(14,2) not null check (precio >= 0),
  unidad text not null default 'vehiculo' check (unidad in ('vehiculo','dia')),
  icono text not null default 'camion' check (icono in ('camioneta','camion','balancin','equipo','estadia')),
  orden integer not null default 100,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  unique (org_id, nombre)
);
create index if not exists tarifas_transporte_org_idx on public.tarifas_transporte (org_id, orden);

alter table public.tarifas_transporte enable row level security;
drop policy if exists "staff lee tarifas" on public.tarifas_transporte;
create policy "staff lee tarifas" on public.tarifas_transporte for select to authenticated
  using (private.tiene_rol(org_id, array['lider','admin','guardia','porteria','tesoreria','consejo']::public.rol_usuario[]));
drop policy if exists "lider crea tarifas" on public.tarifas_transporte;
create policy "lider crea tarifas" on public.tarifas_transporte for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
drop policy if exists "lider edita tarifas" on public.tarifas_transporte;
create policy "lider edita tarifas" on public.tarifas_transporte for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
revoke all on public.tarifas_transporte from public, anon, authenticated;
grant select, insert, update on public.tarifas_transporte to authenticated;

insert into public.tarifas_transporte (org_id, nombre, precio, unidad, icono, orden)
select o.id, t.nombre, t.precio, t.unidad, t.icono, t.orden
from public.organizaciones o
cross join (values
  ('Camioneta',      6000::numeric,  'vehiculo', 'camioneta', 10),
  ('Chasis',         8000::numeric,  'vehiculo', 'camion',    20),
  ('Balancín',       9000::numeric,  'vehiculo', 'balancin',  30),
  ('Equipo',         12000::numeric, 'vehiculo', 'equipo',    40),
  ('Estadía diaria', 12000::numeric, 'dia',      'estadia',   50)
) as t(nombre, precio, unidad, icono, orden)
on conflict (org_id, nombre) do nothing;

-- canon_camiones: cada ingreso de transporte cobrado por Portería.
-- `tipo` queda DEPRECADA (registrar_canon escribe 'camion' para que el
-- resumen_conceptos viejo lo siga mostrando como BC hasta que M9 lo reescriba).
alter table public.canon_camiones
  add column if not exists numero bigint generated always as identity,
  add column if not exists tarifa_id uuid references public.tarifas_transporte(id),
  add column if not exists tarifa_nombre text,
  add column if not exists unidad text,
  add column if not exists precio_unitario numeric(14,2),
  add column if not exists patente text,
  add column if not exists destino text,
  add column if not exists destino_detalle text,
  add column if not exists espacio_id uuid references public.espacios(id) on delete set null,
  add column if not exists ref uuid,
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_por uuid references auth.users(id),
  add column if not exists anulado_en timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.canon_camiones drop constraint if exists canon_unidad_check;
alter table public.canon_camiones add constraint canon_unidad_check check (unidad is null or unidad in ('vehiculo','dia'));
alter table public.canon_camiones drop constraint if exists canon_patente_check;
alter table public.canon_camiones add constraint canon_patente_check check (patente is null or patente ~ '^[A-Z0-9]{5,8}$');
alter table public.canon_camiones drop constraint if exists canon_destino_check;
alter table public.canon_camiones add constraint canon_destino_check check (
  (destino is null or destino in ('puesto','verdulero','ambulante'))
  and (destino_detalle is null or (destino = 'puesto' and char_length(destino_detalle) <= 20)));
alter table public.canon_camiones drop constraint if exists canon_tarifa_coherente;
alter table public.canon_camiones add constraint canon_tarifa_coherente check (
  tarifa_id is null
  or (tarifa_nombre is not null and precio_unitario is not null and monto = round(precio_unitario * cantidad, 2)));
alter table public.canon_camiones drop constraint if exists canon_anulacion_completa;
alter table public.canon_camiones add constraint canon_anulacion_completa check (
  not anulado or (anulado_en is not null and coalesce(trim(motivo_anulacion), '') <> ''));

create unique index if not exists canon_ref_unq on public.canon_camiones (org_id, ref) where ref is not null;
create index if not exists canon_tarifa_idx on public.canon_camiones (tarifa_id) where tarifa_id is not null;

comment on table public.canon_camiones is
  'Canon de transporte (bono camioneros, código BC) que cobra Portería. Va a la caja de portería (tipo guardia) del día. Se anula, no se borra.';
comment on column public.canon_camiones.tipo is 'DEPRECADA (fase 3): usar tarifa_id / tarifa_nombre.';


-- ------------------------------------------------------------
-- 10. Gastos: descripción opcional, período, fijos replicados, auditoría del pago (E3, E4)
-- ------------------------------------------------------------
alter table public.gastos alter column descripcion drop not null;
alter table public.gastos alter column creado_por set default auth.uid();
alter table public.gastos
  add column if not exists periodo date not null default (date_trunc('month', private.hoy_ar()::timestamp))::date,
  add column if not exists origen_id uuid references public.gastos(id) on delete set null,
  add column if not exists pagado_por uuid references auth.users(id),
  add column if not exists pagado_en timestamptz,
  -- rastro del último "Deshacer pago" (revertir_pago_gasto); no editable por grant
  add column if not exists pago_revertido_por uuid references auth.users(id),
  add column if not exists pago_revertido_en timestamptz,
  add column if not exists pago_revertido_motivo text;

alter table public.gastos drop constraint if exists gastos_periodo_mes;
alter table public.gastos add constraint gastos_periodo_mes
  check (periodo = (date_trunc('month', periodo::timestamp))::date);

-- Un gasto puede pagarse con un cheque de terceros endosado (entregar_cheque).
alter table public.gastos drop constraint if exists gastos_pagado_desde_check;
alter table public.gastos add constraint gastos_pagado_desde_check
  check (pagado_desde is null or pagado_desde in ('caja','tesoreria','cheque'));
alter table public.gastos drop constraint if exists gastos_medio_sin_cheque;
alter table public.gastos drop constraint if exists gastos_medio_cheque;
alter table public.gastos add constraint gastos_medio_cheque
  check (medio_pago is distinct from 'cheque' or pagado_desde = 'cheque');
alter table public.gastos drop constraint if exists gastos_pago_completo;
alter table public.gastos add constraint gastos_pago_completo check (
  estado <> 'pagado' or (fecha_pago is not null and medio_pago is not null and pagado_desde is not null));
alter table public.gastos drop constraint if exists gastos_caja_coherente;
alter table public.gastos add constraint gastos_caja_coherente
  check ((caja_id is not null) = (pagado_desde is not distinct from 'caja'));
-- (gastos_caja_efectivo — "desde caja ⇒ efectivo" — va en 0022: la app vieja permite caja + transferencia.)

create unique index if not exists gastos_origen_unq on public.gastos (origen_id)
  where origen_id is not null and estado <> 'anulado';
create index if not exists gastos_org_periodo_idx on public.gastos (org_id, periodo);

comment on column public.gastos.periodo is 'Mes al que corresponde el gasto (YYYY-MM-01). Criterio de todos los resúmenes.';
comment on column public.gastos.origen_id is 'Gasto fijo del mes anterior del que se replicó (replicar_gastos_fijos).';


-- ------------------------------------------------------------
-- 11. Tesorería: moneda, cuentas, movimientos entre cuentas (J2, J3, J6)
-- ------------------------------------------------------------
alter table public.movimientos_tesoreria
  add column if not exists moneda public.moneda not null default 'ARS',
  add column if not exists cuenta public.cuenta_tesoreria not null default 'banco',
  add column if not exists cuenta_destino public.cuenta_tesoreria,
  add column if not exists grupo_id uuid,
  add column if not exists ref uuid;                -- idempotencia de registrar_ajuste_caja (doble toque)
alter table public.movimientos_tesoreria alter column descripcion drop not null;
alter table public.movimientos_tesoreria alter column creado_por set default auth.uid();

alter table public.movimientos_tesoreria drop constraint if exists mov_tes_cuentas;
alter table public.movimientos_tesoreria add constraint mov_tes_cuentas check (
  (tipo in ('deposito','extraccion')) = (cuenta_destino is not null)
  and (tipo <> 'deposito'   or (cuenta = 'efectivo' and cuenta_destino = 'banco'))
  and (tipo <> 'extraccion' or (cuenta = 'banco' and cuenta_destino = 'efectivo')));

-- Los ajustes de tesorería sobre una caja del día (J3) son movimientos con caja_id:
-- siempre tipo ajuste y en pesos.
alter table public.movimientos_tesoreria drop constraint if exists mov_tes_caja_solo_ajuste;
alter table public.movimientos_tesoreria add constraint mov_tes_caja_solo_ajuste
  check (caja_id is null or (tipo = 'ajuste' and moneda = 'ARS'));

create index if not exists mov_tes_caja_idx on public.movimientos_tesoreria (caja_id) where caja_id is not null;
create index if not exists mov_tes_grupo_idx on public.movimientos_tesoreria (grupo_id) where grupo_id is not null;
create unique index if not exists mov_tes_ref_unq on public.movimientos_tesoreria (org_id, ref) where ref is not null;

comment on column public.movimientos_tesoreria.cuenta is
  'Cuenta afectada. impuesto/debito_fiscal/comision/egreso restan; ingreso suma; ajuste suma con su signo; deposito/extraccion restan de cuenta y suman a cuenta_destino.';
comment on column public.movimientos_tesoreria.caja_id is
  'Solo ajustes de tesorería sobre una caja del día (J3): entran en el arqueo de esa caja. Se escriben por registrar_ajuste_caja.';

alter table public.saldos_iniciales add column if not exists moneda public.moneda not null default 'ARS';
-- (el UNIQUE (org_id, medio) → (org_id, medio, moneda) va en 0022: la app vieja hace upsert por (org_id, medio).)


-- ------------------------------------------------------------
-- 12. Circulares: público (D2)
--     null o '{todos}' = todos los clientes (menos ambulantes);
--     si no, UNIÓN de los segmentos elegidos. 'socios' NO es un segmento más:
--     es un FILTRO (intersección) — "únicamente los socios" (D2):
--       {socios}               = todos los socios
--       {quinteros, socios}    = los quinteros que son socios
--     "La vio" = circular_recepciones.
-- ------------------------------------------------------------
alter table public.circulares add column if not exists publico text[];
alter table public.circulares drop constraint if exists circulares_publico_check;
alter table public.circulares add constraint circulares_publico_check check (
  publico is null or (cardinality(publico) > 0 and publico <@
    array['todos','socios','puesteros','puestos_propios','locales','galpones','conteiners','quinteros']::text[]));
comment on column public.circulares.publico is
  'A quién le llega: null o {todos} = todos (menos ambulantes); si no, unión de segmentos (puesteros, puestos_propios, locales, galpones, conteiners, quinteros). socios = filtro: además tiene que ser socio.';
-- La policy de storage "socios leen circulares" (0022) busca la circular por storage_path.
create index if not exists circulares_storage_idx on public.circulares (storage_path) where storage_path is not null;
comment on table public.circular_recepciones is
  '"La vio": obligatorias = confirmó con el botón; informativas = la abrió (registro automático).';


-- ------------------------------------------------------------
-- 13. Registros documentales (tabla sanciones): multa, hilo, visto (D3–D6)
-- ------------------------------------------------------------
alter table public.sanciones
  add column if not exists numero bigint generated always as identity,
  add column if not exists espacio_id uuid references public.espacios(id) on delete set null,
  add column if not exists estado public.estado_registro not null default 'notificado',
  add column if not exists visto_en timestamptz,            -- primera vez que el socio lo abrió ("Visto el…")
  add column if not exists socio_leyo_en timestamptz,       -- última vez que el socio lo abrió ("Respuesta nueva")
  add column if not exists ultimo_mensaje_en timestamptz,
  add column if not exists ref uuid,                        -- idempotencia de emitir_registro (doble toque)
  add column if not exists multa numeric(14,2),
  add column if not exists multa_vencimiento date,
  add column if not exists cargo_id uuid references public.cargos(id) on delete set null,
  add column if not exists multa_sin_efecto_en timestamptz,
  add column if not exists multa_sin_efecto_por uuid references auth.users(id),
  add column if not exists multa_sin_efecto_motivo text;

alter table public.sanciones drop constraint if exists sanciones_multa_check;
alter table public.sanciones add constraint sanciones_multa_check
  check (multa is null or (multa > 0 and tipo in ('apercibimiento','sancion')));
create unique index if not exists sanciones_cargo_unq on public.sanciones (cargo_id) where cargo_id is not null;
create unique index if not exists sanciones_ref_unq on public.sanciones (org_id, ref) where ref is not null;
create index if not exists sanciones_bandeja_idx on public.sanciones (org_id, tipo, estado);

comment on table public.sanciones is
  'Registros documentales del cliente: notificación, apercibimiento o sanción (con multa opcional → cargo MULT). Se escriben por RPC.';

create table if not exists public.registro_mensajes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  registro_id uuid not null references public.sanciones(id) on delete cascade,
  autor_id uuid references auth.users(id),
  autor_rol public.rol_usuario not null,
  autor_nombre text not null default '',
  mensaje text not null check (char_length(trim(mensaje)) between 1 and 4000),
  adjunto_path text,
  es_descargo boolean not null default false,
  creado_en timestamptz not null default now()
);
create index if not exists registro_mensajes_registro_idx on public.registro_mensajes (registro_id, creado_en);
create index if not exists registro_mensajes_adjunto_idx on public.registro_mensajes (adjunto_path) where adjunto_path is not null;

-- El autor lo fija el servidor (mismo trigger que solicitud_mensajes).
drop trigger if exists fijar_autor_registro on public.registro_mensajes;
create trigger fijar_autor_registro before insert on public.registro_mensajes
  for each row execute function private.fijar_autor_mensaje();

alter table public.registro_mensajes enable row level security;
drop policy if exists "leer mensajes de registro" on public.registro_mensajes;
create policy "leer mensajes de registro" on public.registro_mensajes for select to authenticated using (
  private.tiene_rol(org_id, array['admin','consejo','lider']::public.rol_usuario[])
  or exists (select 1 from public.sanciones s
             where s.id = registro_mensajes.registro_id
               and s.cliente_id = (select private.cliente_actual())));
drop policy if exists "escribir mensajes de registro" on public.registro_mensajes;
create policy "escribir mensajes de registro" on public.registro_mensajes for insert to authenticated with check (
  autor_id = (select auth.uid())
  and exists (select 1 from public.sanciones s
              where s.id = registro_mensajes.registro_id
                and s.org_id = registro_mensajes.org_id
                and (private.tiene_rol(s.org_id, array['admin','lider']::public.rol_usuario[])
                     or s.cliente_id = (select private.cliente_actual()))));
revoke all on public.registro_mensajes from public, anon, authenticated;
grant select on public.registro_mensajes to authenticated;
grant insert (org_id, registro_id, mensaje, adjunto_path) on public.registro_mensajes to authenticated;


-- ------------------------------------------------------------
-- 14. Solicitudes: puesto del plano, elevación del Jefe, quién resolvió (H3, G11, F5)
-- ------------------------------------------------------------
alter table public.solicitudes
  add column if not exists espacio_id uuid references public.espacios(id) on delete set null,
  add column if not exists elevada_por uuid references auth.users(id),
  add column if not exists elevada_en timestamptz,
  add column if not exists resolucion_de text;
alter table public.solicitudes drop constraint if exists solicitudes_resolucion_de_check;
alter table public.solicitudes add constraint solicitudes_resolucion_de_check
  check (resolucion_de is null or resolucion_de in ('jefe','lider','consejo'));
create index if not exists solicitudes_espacio_idx on public.solicitudes (espacio_id) where espacio_id is not null;
create index if not exists solicitudes_org_origen_estado_idx on public.solicitudes (org_id, origen, estado);


-- ------------------------------------------------------------
-- 15. Personal: sector, horas y planilla de novedades (H4)
-- ------------------------------------------------------------
alter table public.empleados
  add column if not exists sector public.sector_personal not null default 'otro',
  add column if not exists horas_semanales numeric(5,2);
alter table public.empleados drop constraint if exists empleados_horas_semanales_check;
alter table public.empleados add constraint empleados_horas_semanales_check
  check (horas_semanales is null or (horas_semanales > 0 and horas_semanales <= 84));
create index if not exists empleados_org_sector_idx on public.empleados (org_id, sector) where activo;
create index if not exists ingresos_personal_empleado_idx on public.ingresos_personal (empleado_id, ingreso_en)
  where empleado_id is not null;

-- Las horas registradas alimentan la planilla de Novedades (H4): la salida nunca antes de la
-- entrada; quién registró lo pone el servidor (los grants por columna van en 0022).
alter table public.ingresos_personal alter column registrado_por set default auth.uid();
alter table public.ingresos_personal drop constraint if exists ingresos_egreso_valido;
alter table public.ingresos_personal add constraint ingresos_egreso_valido
  check (egreso_en is null or egreso_en >= ingreso_en);
comment on column public.empleados.horas_semanales is
  'Horas por semana según contrato. Si es null se calculan de empleado_horarios.';

create table if not exists public.novedades_personal (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  sector public.sector_personal not null,           -- foto del sector del empleado (lo fija el trigger de M7)
  tipo public.tipo_novedad not null,
  fecha_desde date not null,
  fecha_hasta date,                                  -- solo vacaciones / licencia
  horas numeric(5,2),                                -- llegada tarde (en horas), horas extra, horas del feriado
  justificada boolean,                               -- faltas y llegadas tarde
  detalle text,
  adjunto_path text,
  estado public.estado_novedad not null default 'pendiente',
  cargada_por uuid references auth.users(id) default auth.uid(),
  cargada_en timestamptz not null default now(),
  revisada_por uuid references auth.users(id),
  revisada_en timestamptz,
  motivo_rechazo text,
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  motivo_anulacion text,
  actualizada_en timestamptz not null default now(),
  constraint novedades_rango check (fecha_hasta is null or fecha_hasta >= fecha_desde),
  constraint novedades_hasta_solo_periodos check (fecha_hasta is null or tipo in ('vacaciones','licencia')),
  constraint novedades_horas_rango check (horas is null or (horas > 0 and horas <= 24)),
  constraint novedades_horas_requeridas check (tipo not in ('llegada_tarde','horas_extra') or horas is not null),
  constraint novedades_detalle_otra check (tipo <> 'otra' or coalesce(trim(detalle), '') <> ''),
  constraint novedades_detalle_largo check (detalle is null or char_length(detalle) <= 2000),
  constraint novedades_rechazo_con_motivo check (estado <> 'rechazada' or coalesce(trim(motivo_rechazo), '') <> ''),
  constraint novedades_anulada_con_motivo check (estado <> 'anulada' or coalesce(trim(motivo_anulacion), '') <> '')
);
create index if not exists novedades_org_fecha_idx on public.novedades_personal (org_id, fecha_desde);
create index if not exists novedades_empleado_fecha_idx on public.novedades_personal (empleado_id, fecha_desde);
create index if not exists novedades_pendientes_idx on public.novedades_personal (org_id, sector) where estado = 'pendiente';
create index if not exists novedades_adjunto_idx on public.novedades_personal (adjunto_path) where adjunto_path is not null;


-- ------------------------------------------------------------
-- 16. Configuración: cuotas por defecto de los quinteros (G7)
-- ------------------------------------------------------------
alter table public.configuracion
  add column if not exists cuotas_default_quintero integer not null default 4;
alter table public.configuracion drop constraint if exists configuracion_cuotas_default_quintero_check;
alter table public.configuracion add constraint configuracion_cuotas_default_quintero_check
  check (cuotas_default_quintero between 1 and 31);
comment on column public.configuracion.precio_canon_camion is 'DEPRECADA (fase 3): tarifas_transporte.';
comment on column public.configuracion.precio_canon_ambulante is 'DEPRECADA (fase 3): concepto AMB.';
comment on column public.configuracion.precio_canon_quintero_dia is 'DEPRECADA (fase 3, G9): el quintero por día no existe.';


-- ------------------------------------------------------------
-- 17. Documentos: categoría libre con tope de largo (C7)
-- ------------------------------------------------------------
alter table public.documentos_cliente drop constraint if exists documentos_cliente_categoria_largo;
alter table public.documentos_cliente add constraint documentos_cliente_categoria_largo
  check (char_length(trim(categoria)) between 1 and 60);
-- Autoría del documento: la pone el servidor (0022 saca subido_por del grant de INSERT).
alter table public.documentos_cliente alter column subido_por set default auth.uid();


-- ------------------------------------------------------------
-- 17b. Aprobaciones: altas "aplicadas en el acto, revisar después" (contrato §4.7, decisión D-1)
--      Si el usuario confirma la excepción para ambulantes, solicitar_cambio (M4) aplica
--      el alta del Jefe en el acto y deja el cambio 'aprobado' con revisar_despues = true;
--      el Líder lo ve en Aprobaciones → "Aplicadas por el Jefe" y lo marca revisado.
-- ------------------------------------------------------------
alter table public.cambios_pendientes
  add column if not exists revisar_despues boolean not null default false;
create index if not exists cambios_revisar_despues_idx on public.cambios_pendientes (org_id)
  where revisar_despues and revisado_por is null;


-- ------------------------------------------------------------
-- 18. Helpers privados de fundación (los usa la RLS; ningún módulo los modifica)
-- ------------------------------------------------------------

-- Categorías de cliente que el rol actual gestiona (escritura / cobro).
create or replace function private.categorias_gestionables()
returns public.categoria_cliente[]
language sql stable security definer set search_path = '' as $$
  select case private.rol_actual()
    when 'lider'   then array['puestero','quintero','ambulante']::public.categoria_cliente[]
    when 'admin'   then array['puestero']::public.categoria_cliente[]
    when 'guardia' then array['quintero','ambulante']::public.categoria_cliente[]
    else array[]::public.categoria_cliente[]
  end
$$;

-- ¿El cliente es de Portería (quintero o ambulante)?
create or replace function private.cliente_de_porteria(p_cliente uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clientes c
    where c.id = p_cliente and c.categoria in ('quintero','ambulante'))
$$;

-- ¿El usuario actual gestiona a este cliente (org + categoría por rol)?
create or replace function private.puede_gestionar_cliente(p_cliente uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clientes c
    where c.id = p_cliente
      and c.org_id = private.org_actual()
      and c.categoria = any (private.categorias_gestionables()))
$$;

-- Storage: ¿la carpeta {org}/clientes/{id} es de un cliente de Portería de mi org?
create or replace function private.carpeta_de_porteria(p_carpeta text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clientes c
    where c.id::text = p_carpeta
      and c.org_id = private.org_actual()
      and c.categoria in ('quintero','ambulante'))
$$;

-- Segmentos NO excluyentes de un cliente (decisiones §1). Espejo TS: src/lib/segmentos.ts.
--   socios (es_socio) · puesteros (EXME) · puestos_propios (EXPP) · locales (EXPL)
--   galpones (EXPG) · conteiners (EXPE) · cocheras (EXPC)   ← por concepto ACTIVO (conceptos.segmento)
--   quinteros / ambulantes                                   ← por clientes.categoria
create or replace function private.segmentos_cliente(p_cliente uuid)
returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct s.seg order by s.seg), '{}'::text[])
  from (
    select co.segmento as seg
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    where cc.cliente_id = p_cliente and cc.activo and co.activo
      and co.segmento in ('puesteros','puestos_propios','locales','galpones','conteiners','cocheras')
    union all
    select case c.categoria when 'quintero' then 'quinteros' when 'ambulante' then 'ambulantes' end
    from public.clientes c
    where c.id = p_cliente and c.categoria in ('quintero','ambulante')
    union all
    select 'socios' from public.clientes c where c.id = p_cliente and c.es_socio
  ) s
$$;

-- ¿Una circular con este público le llega a este cliente? Espejo TS: clienteEnPublico().
--   · los ambulantes nunca (no tienen portal);
--   · 'socios' es FILTRO: si está, el cliente además tiene que ser socio;
--   · 'todos' (o público vacío/null, o solo {socios}) = sin filtro de segmento;
--   · si no, el cliente tiene que tener alguno de los segmentos elegidos.
create or replace function private.cliente_en_publico(p_cliente uuid, p_publico text[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.categoria <> 'ambulante'
       and (c.es_socio or not ('socios' = any (v.p)))
       and ('todos' = any (v.p)
            or cardinality(array_remove(v.p, 'socios')) = 0
            or private.segmentos_cliente(c.id) && array_remove(v.p, 'socios'))
    from public.clientes c
    cross join (select coalesce(p_publico, '{}'::text[]) as p) v
    where c.id = p_cliente), false)
$$;

-- ¿Ese usuario del portal puede entrar (perfil activo)? Para v_clientes_segmentos.tiene_portal.
create or replace function private.tiene_portal_activo(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.perfiles p where p.user_id = p_user and p.activo)
$$;

-- Sectores del personal cuyas novedades ve/carga el rol actual (decisiones §11).
create or replace function private.sectores_novedades()
returns public.sector_personal[]
language sql stable security definer set search_path = '' as $$
  select case private.rol_actual()
    when 'lider'   then array['porteria','limpieza','mantenimiento','administracion','otro']::public.sector_personal[]
    when 'admin'   then array['porteria','limpieza','mantenimiento']::public.sector_personal[]
    when 'guardia' then array['porteria']::public.sector_personal[]
    else array[]::public.sector_personal[]
  end
$$;

-- F1–F3, F5: quién gestiona usuarios de qué rol. Líder = todos; Administración = socios;
-- Jefe de Portería = Portería. Nadie asigna "consejo".
create or replace function private.puede_gestionar_rol(p_org uuid, p_rol public.rol_usuario)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_rol <> 'consejo' and exists (
    select 1 from public.perfiles yo
    where yo.user_id = (select auth.uid()) and yo.activo and yo.org_id = p_org
      and (yo.rol = 'lider'
        or (yo.rol = 'admin'   and p_rol = 'socio')
        or (yo.rol = 'guardia' and p_rol = 'porteria')))
$$;

-- Trigger genérico: el espacio_id tiene que ser de la misma organización que la fila.
create or replace function private.validar_espacio_misma_org()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.espacio_id is not null and not exists (
    select 1 from public.espacios e where e.id = new.espacio_id and e.org_id = new.org_id) then
    raise exception 'Ese lugar del plano no existe. Recargá la página y probá de nuevo';
  end if;
  return new;
end $$;

-- Red de seguridad del cobro (constraint trigger DIFERIDO, se evalúa al commit): lo imputado de un
-- pago nunca supera su monto. Si dos transacciones imputan el mismo crédito (saldo a favor), la
-- segunda falla entera en vez de dejar un cargo "pagado sin plata".
create or replace function private.tg_imputaciones_tope()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_monto numeric;
  v_imputado numeric;
begin
  select p.monto into v_monto from public.pagos p where p.id = new.pago_id;
  select coalesce(sum(i.monto), 0) into v_imputado from public.imputaciones i where i.pago_id = new.pago_id;
  if v_imputado > v_monto + 0.009 then
    raise exception 'No se pudo registrar el cobro: otro movimiento usó la misma plata al mismo tiempo. Probá de nuevo.'
      using detail = format('pago %s: imputado %s > monto %s', new.pago_id, v_imputado, v_monto);
  end if;
  return null;
end $$;

drop trigger if exists imputaciones_tope on public.imputaciones;
create constraint trigger imputaciones_tope
  after insert or update on public.imputaciones
  deferrable initially deferred
  for each row execute function private.tg_imputaciones_tope();

revoke all on function private.tg_imputaciones_tope() from public, anon;
revoke all on function private.categorias_gestionables() from public, anon;
revoke all on function private.cliente_de_porteria(uuid) from public, anon;
revoke all on function private.puede_gestionar_cliente(uuid) from public, anon;
revoke all on function private.carpeta_de_porteria(text) from public, anon;
revoke all on function private.segmentos_cliente(uuid) from public, anon;
revoke all on function private.cliente_en_publico(uuid, text[]) from public, anon;
revoke all on function private.tiene_portal_activo(uuid) from public, anon;
revoke all on function private.sectores_novedades() from public, anon;
revoke all on function private.puede_gestionar_rol(uuid, public.rol_usuario) from public, anon;
revoke all on function private.validar_espacio_misma_org() from public, anon;
grant execute on function private.categorias_gestionables() to authenticated;
grant execute on function private.cliente_de_porteria(uuid) to authenticated;
grant execute on function private.puede_gestionar_cliente(uuid) to authenticated;
grant execute on function private.carpeta_de_porteria(text) to authenticated;
grant execute on function private.segmentos_cliente(uuid) to authenticated;
grant execute on function private.cliente_en_publico(uuid, text[]) to authenticated;
grant execute on function private.tiene_portal_activo(uuid) to authenticated;
grant execute on function private.sectores_novedades() to authenticated;
grant execute on function private.puede_gestionar_rol(uuid, public.rol_usuario) to authenticated;

drop trigger if exists medidores_valida_espacio on public.medidores;
create trigger medidores_valida_espacio before insert or update of espacio_id on public.medidores
  for each row execute function private.validar_espacio_misma_org();
drop trigger if exists solicitudes_valida_espacio on public.solicitudes;
create trigger solicitudes_valida_espacio before insert or update of espacio_id on public.solicitudes
  for each row execute function private.validar_espacio_misma_org();
drop trigger if exists canon_valida_espacio on public.canon_camiones;
create trigger canon_valida_espacio before insert or update of espacio_id on public.canon_camiones
  for each row execute function private.validar_espacio_misma_org();
drop trigger if exists sanciones_valida_espacio on public.sanciones;
create trigger sanciones_valida_espacio before insert or update of espacio_id on public.sanciones
  for each row execute function private.validar_espacio_misma_org();


-- ------------------------------------------------------------
-- 19. Novedades: RLS (tabla nueva)
-- ------------------------------------------------------------
alter table public.novedades_personal enable row level security;
drop policy if exists "leer novedades" on public.novedades_personal;
create policy "leer novedades" on public.novedades_personal for select to authenticated using (
  private.es_miembro(org_id) and sector = any ((select private.sectores_novedades())::public.sector_personal[]));
drop policy if exists "cargar novedades" on public.novedades_personal;
create policy "cargar novedades" on public.novedades_personal for insert to authenticated with check (
  private.es_miembro(org_id)
  and sector = any ((select private.sectores_novedades())::public.sector_personal[])
  and cargada_por = (select auth.uid()));
drop policy if exists "editar novedades pendientes" on public.novedades_personal;
create policy "editar novedades pendientes" on public.novedades_personal for update to authenticated
  using (
    sector = any ((select private.sectores_novedades())::public.sector_personal[]) and estado = 'pendiente'
    and (cargada_por = (select auth.uid())
         or private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[])))
  with check (sector = any ((select private.sectores_novedades())::public.sector_personal[]) and estado = 'pendiente');
drop policy if exists "borrar novedades pendientes" on public.novedades_personal;
create policy "borrar novedades pendientes" on public.novedades_personal for delete to authenticated using (
  sector = any ((select private.sectores_novedades())::public.sector_personal[]) and estado = 'pendiente'
  and (cargada_por = (select auth.uid())
       or private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[])));
revoke all on public.novedades_personal from public, anon, authenticated;
grant select, delete on public.novedades_personal to authenticated;
grant insert (org_id, empleado_id, tipo, fecha_desde, fecha_hasta, horas, justificada, detalle, adjunto_path)
  on public.novedades_personal to authenticated;
grant update (tipo, fecha_desde, fecha_hasta, horas, justificada, detalle, adjunto_path)
  on public.novedades_personal to authenticated;


-- ------------------------------------------------------------
-- 20. Perfiles: DNI de login y gestión de usuarios (F1–F5)  [arreglo de seguridad]
-- ------------------------------------------------------------
alter table public.perfiles
  add column if not exists dni text,
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  -- rastro de "Quitar acceso": lo escribe el trigger proteger_perfiles (no está en ningún grant)
  add column if not exists desactivado_por uuid references auth.users(id) on delete set null,
  add column if not exists desactivado_en timestamptz;
-- Autoría del alta: la pone el servidor (no está en el grant de INSERT).
alter table public.perfiles alter column creado_por set default auth.uid();
alter table public.perfiles drop constraint if exists perfiles_dni_formato;
alter table public.perfiles add constraint perfiles_dni_formato check (dni is null or dni ~ '^[0-9]{7,8}$');
create unique index if not exists perfiles_dni_unq on public.perfiles (dni) where dni is not null;
comment on column public.perfiles.dni is 'Usuario de login (solo dígitos, único global). El email pasa a ser técnico si no hay uno real.';

drop policy if exists "editar perfiles" on public.perfiles;
drop policy if exists "insertar perfiles" on public.perfiles;
drop policy if exists "borrar perfiles" on public.perfiles;
drop policy if exists "gestionar perfiles" on public.perfiles;
drop policy if exists "alta de perfiles" on public.perfiles;
create policy "gestionar perfiles" on public.perfiles for update to authenticated
  using (private.puede_gestionar_rol(org_id, rol))
  with check (private.puede_gestionar_rol(org_id, rol));
create policy "alta de perfiles" on public.perfiles for insert to authenticated
  with check (private.puede_gestionar_rol(org_id, rol));
-- Sin DELETE para usuarios: se desactiva. El borrado real queda para el service role.
-- OJO: esto protege la TABLA. Las acciones de M8 que usan auth.admin.* (service role:
-- resetear contraseña, banear sesión) tienen que pasar antes por
-- public.autorizar_gestion_usuario() con el cliente del usuario (contrato §4.11).
revoke insert, update, delete, truncate on public.perfiles from authenticated;
revoke all on public.perfiles from anon;
grant insert (user_id, org_id, nombre, rol, activo, dni) on public.perfiles to authenticated;
grant update (nombre, activo, dni, rol) on public.perfiles to authenticated;

-- Trigger endurecido: solo el Líder cambia roles; socio ↔ equipo prohibido; "consejo"
-- no se asigna; siempre queda al menos un Líder activo; deja rastro de quién quitó el
-- acceso. El service role (auth.uid() nulo) puede todo lo demás: lo usan los reseteos y
-- los datos de migración.
create or replace function private.proteger_perfiles()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.org_id <> old.org_id then
    raise exception 'No se puede mover un perfil de organización';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el usuario de un perfil';
  end if;
  -- Rastro de "Quitar acceso" / "Devolver acceso" (también si lo hace el service role).
  if old.activo and not new.activo then
    new.desactivado_por := v_uid;
    new.desactivado_en := now();
  elsif not old.activo and new.activo then
    new.desactivado_por := null;
    new.desactivado_en := null;
  else
    new.desactivado_por := old.desactivado_por;
    new.desactivado_en := old.desactivado_en;
  end if;
  new.creado_por := old.creado_por;
  if v_uid is null then
    return new;
  end if;
  if old.user_id = v_uid and new.rol <> old.rol then
    raise exception 'No podés cambiar tu propio rol';
  end if;
  if old.user_id = v_uid and not new.activo then
    raise exception 'No podés desactivarte a vos mismo';
  end if;
  if new.rol <> old.rol then
    if private.rol_actual() is distinct from 'lider' then
      raise exception 'Solo el Líder de Procesos cambia roles';
    end if;
    if new.rol = 'consejo' then
      raise exception 'El rol Consejo ya no se asigna';
    end if;
    if (old.rol = 'socio') <> (new.rol = 'socio') then
      raise exception 'Un socio no puede pasar a ser del equipo (ni al revés): creá otro usuario';
    end if;
  end if;
  if old.rol = 'lider' and old.activo and (not new.activo or new.rol <> 'lider')
     and not exists (
       select 1 from public.perfiles o
       where o.org_id = old.org_id and o.rol = 'lider' and o.activo and o.user_id <> old.user_id) then
    raise exception 'Tiene que quedar al menos un Líder de Procesos activo';
  end if;
  return new;
end $$;
-- (el trigger proteger_perfiles BEFORE UPDATE ya existe y apunta a esta función)

-- Datos: F5 — el Consejo sale de la UI; F4 — DNIs de los usuarios demo (a confirmar los reales).
update public.perfiles set activo = false where rol = 'consejo';
update public.perfiles p set dni = v.dni
from (values
  ('b0000000-0000-4000-8000-000000000006'::uuid, '20111111'),  -- lider     (Franco Delucchi)
  ('b0000000-0000-4000-8000-000000000001'::uuid, '20222222'),  -- admin     (Marta Núñez)
  ('b0000000-0000-4000-8000-000000000003'::uuid, '20333333'),  -- tesoreria (Silvia Camaño)
  ('b0000000-0000-4000-8000-000000000002'::uuid, '20444444'),  -- guardia   (Jorge Ferreyra)
  ('b0000000-0000-4000-8000-000000000007'::uuid, '20555555'),  -- porteria  (Luis Aguirre)
  ('b0000000-0000-4000-8000-000000000005'::uuid, '20666666')   -- socio     (Roberto Juárez)
) as v(user_id, dni)
where p.user_id = v.user_id and p.dni is null;


-- ------------------------------------------------------------
-- 21. Vistas
-- ------------------------------------------------------------

-- Segmentos de cada cliente (listado de Clientes C1–C4, público de circulares D2).
-- security_invoker: cada rol ve solo los clientes que su RLS le deja ver.
create or replace view public.v_clientes_segmentos with (security_invoker = true) as
select
  c.org_id,
  c.id as cliente_id,
  c.codigo,
  c.nombre,
  c.apodo,
  c.categoria,
  c.es_socio,
  c.activo,
  -- "lo ve en el portal": usuario vinculado Y perfil activo (Quitar acceso no infla los conteos).
  -- private.tiene_portal_activo es definer: la RLS de perfiles no deja ver perfiles de socios a todos.
  private.tiene_portal_activo(c.auth_user_id) as tiene_portal,
  private.segmentos_cliente(c.id) as segmentos
from public.clientes c;
revoke all on public.v_clientes_segmentos from public, anon, authenticated;
grant select on public.v_clientes_segmentos to authenticated;

-- Avance del mes por cliente (G5): la ÚNICA cuenta de "2 de 4 · Falta $165.000".
-- La consumen Cobrar (M1), el inicio del Jefe (M8) y el mapa del Jefe (M9); nadie la recalcula.
--   · cargos del mes no anulados de origen generacion/energia (la cuenta mensual: recurrentes,
--     ABEN y consumo). Quedan afuera los diarios (AMB), las multas, la deuda anterior (RD) y los
--     cargos manuales;
--   · falta = lo exigible HOY (con beneficio si está en término);
--   · cuotas_cubiertas = cuotas cubiertas POR PLATA: floor((total − falta) / (total / cuotas)),
--     tope cuotas − 1 mientras falte algo;
--   · cuota_sugerida = total / cuotas (redondeado), y la última cuota = lo que falta exacto.
create or replace view public.v_avance_mes with (security_invoker = true) as
with base as (
  select
    c.org_id,
    c.cliente_id,
    c.periodo,
    sum(c.monto) as total,
    sum(c.monto_pagado) as pagado,
    sum(case when c.estado in ('pendiente','parcial') then greatest(
          case when private.hoy_ar() <= c.vencimiento
               then round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
               else c.monto end - c.monto_pagado, 0)
        else 0 end) as falta
  from public.cargos c
  where c.estado <> 'anulado' and c.origen in ('generacion','energia')
  group by c.org_id, c.cliente_id, c.periodo
), cub as (
  select
    b.*,
    cl.cuotas_mes as cuotas,
    case when b.falta <= 0.009 then cl.cuotas_mes
         else least(cl.cuotas_mes - 1,
                    coalesce(floor((b.total - b.falta) / nullif(b.total / cl.cuotas_mes, 0)), 0))::integer
    end as cuotas_cubiertas
  from base b
  join public.clientes cl on cl.id = b.cliente_id
)
select
  org_id, cliente_id, periodo, total, pagado, falta, cuotas, cuotas_cubiertas,
  case when falta <= 0.009 then 0::numeric
       when cuotas - cuotas_cubiertas <= 1 then falta
       else least(falta, round(total / cuotas, 2)) end as cuota_sugerida
from cub;
revoke all on public.v_avance_mes from public, anon, authenticated;
grant select on public.v_avance_mes to authenticated;

-- Deuda por cliente + semáforo (B3). Se agregan columnas AL FINAL (compatible).
--   deuda_vencida       = lo que ya venció (sin beneficio)
--   vencido_desde       = vencimiento más viejo impago
--   proximo_vencimiento = próximo vencimiento en término
create or replace view public.v_deuda_clientes with (security_invoker = true) as
select
  org_id,
  cliente_id,
  sum(case when private.hoy_ar() <= vencimiento
        then round(monto * (1 - descuento_pronto_pago / 100.0), 2)
        else monto end - monto_pagado) as deuda,
  count(*) as cargos_pendientes,
  min(periodo) as periodo_mas_viejo,
  coalesce(sum(monto - monto_pagado) filter (where vencimiento < private.hoy_ar()), 0) as deuda_vencida,
  min(vencimiento) filter (where vencimiento < private.hoy_ar()) as vencido_desde,
  min(vencimiento) filter (where vencimiento >= private.hoy_ar()) as proximo_vencimiento
from public.cargos
where estado in ('pendiente','parcial')
group by org_id, cliente_id;


-- ------------------------------------------------------------
-- 22. Storage: adjuntos de novedades ({org}/novedades/…) para el Jefe de Portería.
--     Administración y el Líder ya entran por "staff gestiona documentos".
-- ------------------------------------------------------------
drop policy if exists "jefe sube adjuntos de novedades" on storage.objects;
create policy "jefe sube adjuntos de novedades" on storage.objects for insert to authenticated with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'novedades'
  and (select private.rol_actual()) = 'guardia');
drop policy if exists "jefe lee adjuntos de novedades" on storage.objects;
create policy "jefe lee adjuntos de novedades" on storage.objects for select to authenticated using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'novedades'
  and (select private.rol_actual()) = 'guardia'
  and exists (select 1 from public.novedades_personal n where n.adjunto_path = objects.name));
-- Borra solo lo que subió él y mientras la novedad siga pendiente (lo aprobado es evidencia).
drop policy if exists "jefe borra sus adjuntos de novedades" on storage.objects;
create policy "jefe borra sus adjuntos de novedades" on storage.objects for delete to authenticated using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'novedades'
  and (select private.rol_actual()) = 'guardia'
  and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.novedades_personal n
                  where n.adjunto_path = objects.name and n.estado <> 'pendiente'));
