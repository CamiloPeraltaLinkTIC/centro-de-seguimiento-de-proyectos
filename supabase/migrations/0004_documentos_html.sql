-- Documentos HTML (presentaciones) además de PDF.
-- Se guardan en el mismo bucket privado como <uuid>.html y el servidor los entrega solo al visor de la app,
-- dentro de un iframe aislado (sandbox, sin acceso a la sesión ni a la app).

update storage.buckets
set allowed_mime_types = array['application/pdf', 'text/html', 'image/jpeg']
where id = 'seguimiento-documentos';

alter table seguimiento.documentos drop constraint if exists documentos_archivo_check;
alter table seguimiento.documentos add constraint documentos_archivo_check check (archivo ~ '^[0-9a-f-]{36}\.(pdf|html)$');
