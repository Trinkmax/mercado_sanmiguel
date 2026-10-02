-- ============================================================
-- 0043 · Plano: la quinta 69 es entera; la 68 sigue siendo media.
--
-- Hilera de arriba de la playa de quintas oeste, de izquierda a derecha: 69 (entera,
-- del ancho de la 67), 68 (media) y 67. Para que entre, la playa se estira 10,5 hacia
-- la izquierda (queda libre el espacio hasta el puesto 68 grande, que termina en 412).
-- Idempotente: si la 69 ya es entera, no hace nada.
-- ============================================================

do $$
declare
  v_org constant uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.organizaciones where id = v_org) then return; end if;
  if exists (select 1 from public.espacios
             where org_id = v_org and tipo = 'quinta' and numero = '69' and w = 18) then
    return;
  end if;

  update public.plano_elementos set x = 425.5, w = 298.5
   where org_id = v_org and tipo = 'quinteros' and x = 436 and y = 358 and w = 288;

  update public.espacios set x = 430.5, w = 18, nota = null, actualizado_en = now()
   where org_id = v_org and tipo = 'quinta' and numero = '69' and y = 362;

  update public.espacios set x = 450.5, w = 8.5, nota = 'Media quinta', actualizado_en = now()
   where org_id = v_org and tipo = 'quinta' and numero = '68' and y = 362;
end $$;
