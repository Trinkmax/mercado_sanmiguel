-- ============================================================
-- 0051 · Conceptos de ingreso sin cliente (tipo 'ingreso').
--
-- Pedido del 25/10/2026 (audio de Administración): "tenemos que crear un concepto que no
-- se le asigna a ningún cliente, sino que es un concepto general de ingreso que es por
-- venta de vacíos [y tarimas]". El concepto y su cobro van en 0053.
--
-- Va sola: un valor nuevo de un enum tiene que quedar confirmado antes de usarse.
-- ============================================================

alter type public.tipo_concepto add value if not exists 'ingreso';
