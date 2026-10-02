-- Portada de cada documento: imagen JPEG de la primera página, usada como fondo de su tarjeta.
-- Se guarda en el mismo bucket privado y la entrega el servidor solo a usuarios con sesión.

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg']
where id = 'seguimiento-documentos';

alter table seguimiento.documentos add column if not exists portada text;
alter table seguimiento.documentos drop constraint if exists documentos_portada_ruta;
alter table seguimiento.documentos add constraint documentos_portada_ruta check (portada is null or portada ~ '^[0-9a-f-]{36}\.jpg$');
