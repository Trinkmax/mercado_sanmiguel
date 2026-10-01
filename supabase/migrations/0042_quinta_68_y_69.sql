-- ============================================================
-- 0042 · Plano: la quinta 68 es media quinta; la otra mitad es la 69.
--
-- Se parte el lugar de la 68 (playa de quintas oeste, al lado de la 67) en dos mitades
-- iguales: la 68 a la izquierda y la 69 a la derecha. Cada una se asigna como cualquier
-- quinta; lo que paga cada quintero va por su carpeta (EXPQ con cantidad o porcentaje).
-- Idempotente: si la 69 ya existe, no hace nada.
-- ============================================================

do $$
declare
  v_org constant uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.organizaciones where id = v_org) then return; end if;
  if exists (select 1 from public.espacios where org_id = v_org and tipo = 'quinta' and numero = '69') then
    return;
  end if;

  update public.espacios set w = 8.5, nota = 'Media quinta', actualizado_en = now()
   where org_id = v_org and tipo = 'quinta' and numero = '68' and x = 441 and y = 362;

  insert into public.espacios (org_id, tipo, numero, nota, x, y, w, h)
  values (v_org, 'quinta', '69', 'Media quinta', 450.5, 362, 8.5, 34);
end $$;
