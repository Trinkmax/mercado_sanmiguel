-- ============================================================
-- 0067 · Un contéiner más en el recinto de contéiners del plano
--
-- Pedido de Franco del 20/11/2026 (audio): "tenemos que agregar un contenedor en el mapita
-- para poder asignarle al cliente ese puesto y ahí nosotros le definimos qué número de puesto
-- es, no es el número de carpeta… no existe en el plano, esto es nuevo".
-- Un cliente nuevo (carpeta 171) ocupa un contéiner que el dibujo no tenía, y todos los
-- lugares del plano ya estaban asignados: no había dónde ubicarlo.
--
-- Entra parado, a la derecha de los tres que ya están en el recinto (donde hay lugar), del
-- mismo tamaño que los de la fila de abajo (34 × 76). Sin número y sin cliente: el número lo
-- definen ellos desde el plano («Editar») y lo asignan como cualquier otro lugar.
-- ============================================================

insert into public.espacios (org_id, tipo, numero, x, y, w, h)
select r.org_id, 'contenedor', null, r.x + 122, r.y + 24, 34, 76
from public.plano_elementos r
where r.tipo = 'recinto'
  and not exists (
    select 1 from public.espacios e
    where e.org_id = r.org_id and e.tipo = 'contenedor'
      and e.x = r.x + 122 and e.y = r.y + 24
  );
