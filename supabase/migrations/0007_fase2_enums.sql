-- ============================================================
-- Mercado San Miguel — 0007 Fase 2: valores nuevos de enums
-- Va en una migración aparte: Postgres no permite USAR un valor
-- de enum recién agregado dentro de la misma transacción.
--
-- Roles nuevos:
--   lider    → Líder de Procesos (aprueba cambios, personal, reportes,
--              solicitudes ↔ consejo). Hereda todo lo que veía "consejo".
--   porteria → Portería (personal de puerta): registra ingresos de personal
--              y genera solicitudes. NO cobra. El que cobra es el Jefe de
--              Portería, que sigue siendo el rol `guardia` (se renombra el
--              label visible, no el valor, para no romper RPC/RLS).
-- ============================================================

alter type public.rol_usuario add value if not exists 'lider';
alter type public.rol_usuario add value if not exists 'porteria';

-- Caja de portería rendida e integrada a la caja mayor (administración).
-- Flujo: abierta → cerrada (rinde portería) → integrada (admin) → validada (tesorería).
alter type public.estado_caja add value if not exists 'integrada' after 'cerrada';

-- Registros documentales del cliente: notificación, sanción, apercibimiento.
-- (Las circulares son masivas y viven en su propia tabla.)
alter type public.tipo_sancion add value if not exists 'apercibimiento';

-- Tesorería: débito fiscal (IVA) como movimiento propio, además de impuesto y comisión.
alter type public.tipo_mov_tesoreria add value if not exists 'debito_fiscal' after 'impuesto';
