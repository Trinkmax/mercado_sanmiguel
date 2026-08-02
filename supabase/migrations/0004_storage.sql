-- ============================================================
-- Mercado San Miguel — 0004 Storage: carpeta digital de documentos
-- Convención de rutas: {org_id}/clientes/{cliente_id}/{archivo}
--                      {org_id}/gastos/{archivo}
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do nothing;

-- Staff (admin/tesorería/consejo): gestión completa dentro de su organización
create policy "staff gestiona documentos"
on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (select private.rol_actual()) in ('admin','tesoreria','consejo')
)
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (select private.rol_actual()) in ('admin','tesoreria','consejo')
);

-- Socio: ve los documentos de su carpeta
create policy "socio lee sus documentos"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'clientes'
  and (storage.foldername(name))[3] = (select private.cliente_actual()::text)
);

-- Socio: puede subir documentación a su carpeta (no reemplaza ni borra)
create policy "socio sube documentos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'clientes'
  and (storage.foldername(name))[3] = (select private.cliente_actual()::text)
);
